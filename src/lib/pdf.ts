/**
 * FIX50 — PDF-HTML-builders volgens het officiële dossier-design.
 * Zuivere functies: geen imports van RN/Expo (alleen de gegenereerde font-data),
 * unit-getest.
 *
 * Twee documenten, rechtstreeks gemodelleerd naar het goedgekeurde
 * FIX50-verkoopdossier:
 *   Pagina 1 — OFFICIEEL ONDERHOUDSBOEKJE (voertuiggegevens, KPI-strip,
 *              historietabel, proactieve planning, authenticiteitsvoet)
 *   Pagina 2 — PERFORMANCE & TUNING RAPPORT (acceleratie-KPI's, GPS-curve,
 *              setup-specificaties, metingen-overzicht, diagnose-conclusie)
 *
 * Design-systeem "werkplaatsdossier": licht papier, strakke Haarlinien,
 * oranje FIX50-caliper als merkstreep, Space Grotesk voor koppen en cijfers,
 * NL-kentekenbadge, donkere tabelkoppen en een stempelvoet met verify-link —
 * zoals een officiële auto-onderneming zijn servicehistorie vastlegt.
 */
import { LOGO_PNG_BASE64, SPACE_GROTESK_BOLD_BASE64, SPACE_GROTESK_REGULAR_BASE64 } from './pdf-brand';

/** HTML-escaper voor alle gebruikersinvoer. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "2026-10-05T…" → "05-10-2026" (dd-mm-jjjj). */
export function nlDate(iso: string): string {
  const date = iso.slice(0, 10);
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/** 12450 → "12.450". */
export function kmDot(km: number): string {
  return km.toLocaleString('nl-NL');
}

/** 2450 → "€ 24,50". */
export function euroCents(cents: number): string {
  return `€ ${(cents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Documentnummer: stabiel, afgeleid van de scooter-id. */
export function docNumber(scooterId: string): string {
  const base = scooterId.replace(/-/g, '').toUpperCase().slice(0, 6);
  return `DOC-${base}-NL`;
}

/** 2,3 L/100km → 43,5 km per liter ("1 op 43,5"). */
export function kmPerLiterFromL100(lPer100km: number): number {
  return lPer100km > 0 ? 100 / lPer100km : 0;
}

/** Format km-per-liter als "1 op 43,5" (komma als decimaalteken). */
export function formatKmPerLiterLabel(kmPerLiter: number): string {
  return `1 op ${kmPerLiter.toFixed(1).replace('.', ',')}`;
}

/**
 * Authenticiteitscodering, zoals op het verkoopdossier:
 * "FX50-8942-2026-X" — deterministisch uit scooter-id + jaar, dus dezelfde
 * scooter geeft hetzelfde codeerdeel (handig om kopies te herkennen).
 */
export function authenticityCode(scooterId: string, isoDate: string): string {
  const seed = scooterId.replace(/-/g, '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const part = String(hash % 10000).padStart(4, '0');
  const year = isoDate.slice(0, 4) || String(new Date().getFullYear());
  return `FX50-${part}-${year}-X`;
}

// ---------------------------------------------------------------------------
// Design-systeem: "werkplaatsdossier"
// ---------------------------------------------------------------------------

/** Merklogo als kleine data-URL (alleen bijgevoegd als er eentje gegenereerd is). */
const LOGO_SRC = LOGO_PNG_BASE64 ? `data:image/png;base64,${LOGO_PNG_BASE64}` : '';
/** Merklockup: officiële FIX50-logo met huisstijl-strap ernaast. */
function brandLockup(): string {
  return `      <div class="brand-left">
        ${LOGO_SRC ? `<img class="brand-logo" src="${LOGO_SRC}" alt="FIX50" />` : '<div class="brandmark">fix<span class="bfifty">50</span></div>'}
        <div class="brand-strap">Scooter Onderhoud<br/>Tuning · Telemetrie</div>
      </div>`;
}

/**
 * Gedeelde documentstijl (A4): licht papier, ink-lijnen, oranje caliper,
 * Space Grotesk (ingeboden) voor alle koppen en cijfers.
 */
const BASE_CSS = `
  @font-face { font-family: 'FIX50 Grotesk'; src: url(data:font/ttf;base64,${SPACE_GROTESK_REGULAR_BASE64}) format('truetype'); font-weight: 400; font-style: normal; }
  @font-face { font-family: 'FIX50 Grotesk'; src: url(data:font/ttf;base64,${SPACE_GROTESK_BOLD_BASE64}) format('truetype'); font-weight: 700; font-style: normal; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { background: #ffffff; color: #141518; font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.45; }
  .sheet { max-width: 730px; margin: 0 auto; padding: 0 24px 18px; }
  .caliper { height: 5px; background: #F97316; margin: 0 -24px 20px; }

  /* ── Kop / merkband ─────────────────────────────────────────────── */
  .head { border-bottom: 2px solid #141518; padding-bottom: 14px; }
  .brand-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .brand-left { display: flex; align-items: center; gap: 9px; }
  .brand-logo { height: 34px; width: auto; display: block; }
  .brandmark { font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; line-height: 1; }
  .brandmark .bfifty { color: #F97316; }
  .brand-strap { font-size: 7px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #7A7D85; line-height: 1.7; }
  .head-right { text-align: right; }
  .doc-tag { display: inline-block; background: #141518; color: #fff; font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 5px 10px 4px; }
  .head-meta { margin-top: 6px; font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 8.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #7A7D85; white-space: nowrap; }
  .title-row { margin-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .doc-title { font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 25px; font-weight: 700; letter-spacing: -0.2px; line-height: 1.08; }
  .doc-sub { margin-top: 5px; font-size: 10px; color: #7A7D85; }
  /* NL-kentekenbadge: geel bord, Thailand-knop-blauw kader — herkenbaar werkplaatsdetail. */
  .plate { font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 1.2px; color: #141518; background: #FFD400; border: 1.5px solid #141518; border-radius: 3px; padding: 4px 12px 3px; white-space: nowrap; }

  /* ── Sectiekoppen ──────────────────────────────────────────────── */
  .section { margin-top: 20px; }
  .section-head { display: flex; align-items: center; gap: 8px; }
  .section-head .tick { width: 14px; height: 3px; background: #F97316; flex: none; }
  .section-head h2 { font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 11.5px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; white-space: nowrap; }
  .section-head .rule { flex: 1; height: 1px; background: #D9DAD5; }
  .count-chip { flex: none; font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 7.8px; font-weight: 700; letter-spacing: 0.9px; text-transform: uppercase; color: #3F4148; background: #F4F4F0; border: 1px solid #D9DAD5; padding: 3px 8px; white-space: nowrap; }
  .section-sub { margin: 4px 0 9px 22px; font-size: 9px; color: #7A7D85; }

  /* ── KPI-gauge-cluster ─────────────────────────────────────────── */
  .kpis { display: flex; border: 1px solid #D9DAD5; background: #fff; }
  .kpi { flex: 1; min-width: 0; padding: 10px 11px 9px; border-right: 1px solid #E7E8E3; border-top: 2.5px solid #141518; }
  .kpi:last-child { border-right: none; }
  .kpi .lbl { font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 7.5px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase; color: #7A7D85; }
  .kpi .val { margin-top: 5px; font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 19px; font-weight: 700; letter-spacing: -0.3px; line-height: 1; white-space: nowrap; }
  .kpi .val small { font-size: 11px; font-weight: 400; letter-spacing: 0; color: #7A7D85; margin-left: 2px; }
  .kpi .val.accent { color: #F97316; }
  .kpi .sub { margin-top: 5px; font-size: 8.3px; color: #7A7D85; }

  /* ── Technische tabellen (voertuiggegevens, setup) ─────────────── */
  table.tech { width: 100%; border-collapse: collapse; background: #fff; font-size: 11px; }
  table.tech td { border: 1px solid #E7E8E3; padding: 6.5px 11px; }
  table.tech td.k { width: 34%; background: #F4F4F0; font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 8.3px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #3F4148; }
  table.tech strong { font-size: 11.5px; }

  /* ── Historie- en metingentabellen ─────────────────────────────── */
  table.history { width: 100%; border-collapse: collapse; background: #fff; font-size: 9.2px; }
  table.history thead th { background: #141518; color: #fff; font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 700; font-size: 7.4px; letter-spacing: 0.8px; text-transform: uppercase; text-align: left; padding: 6px 7px; white-space: nowrap; }
  table.history td { padding: 6px 7px; border-bottom: 1px solid #E7E8E3; vertical-align: top; }
  table.history td:nth-child(1), table.history td:nth-child(2), table.history td:nth-child(3) { white-space: nowrap; }
  table.history tbody tr:nth-child(even) td { background: #F7F7F3; }
  table.history .ref { font-family: 'FIX50 Grotesk', Helvetica, Arial, sans-serif; color: #7A7D85; font-weight: 700; }
  table.history .num { text-align: right; font-family: 'FIX50 Grotesk', Helvetica, Arial, sans-serif; font-weight: 700; white-space: nowrap; }
  table.history .zelf { display: inline-block; font-size: 7.6px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #3F4148; border: 1px solid #D9DAD5; padding: 1px 6px; }

  /* ── Proactieve planning ──────────────────────────────────────── */
  /* ── Voertuigfoto naast de spec-tabel ─────────────────────── */
  .veh { display: flex; gap: 10px; align-items: stretch; }
  .veh table.tech { flex: 1; min-width: 0; }
  .veh-photo { width: 138px; flex: none; border: 1px solid #D9DAD5; background: #fff; padding: 5px 5px 4px; align-self: flex-start; }
  .veh-photo img { width: 100%; height: 104px; object-fit: cover; display: block; }
  .veh-photo .cap { margin-top: 4px; text-align: center; font-family: 'FIX50 Grotesk', Helvetica, Arial, sans-serif; font-size: 6.8px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #7A7D85; white-space: nowrap; overflow: hidden; }

  .plan { display: flex; flex-wrap: wrap; gap: 8px; }
  .plan-item { width: calc(50% - 4px); border: 1px solid #E7E8E3; border-left: 3px solid #F97316; background: #FBFAF6; padding: 9px 12px; font-size: 10px; }
  .plan-item b { display: block; margin-bottom: 3px; font-family: 'FIX50 Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 8.5px; font-weight: 700; letter-spacing: 0.9px; text-transform: uppercase; color: #141518; }
  .plan-item .d { color: #3F4148; }

  /* ── Snelheidscurve ───────────────────────────────────────────── */
  .spark { margin-top: 8px; border: 1px solid #E7E8E3; background: #fff; display: block; width: 100%; }

  /* ── Diagnose-conclusie ───────────────────────────────────────── */
  .conclusion { border: 1px solid #E7E8E3; background: #F7F7F3; padding: 11px 14px; font-size: 10.5px; }
  .conclusion .line { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px dashed #D9DAD5; }
  .conclusion .line:last-child { border-bottom: none; }
  .conclusion .line b { font-family: 'FIX50 Grotesk', Helvetica, Arial, sans-serif; font-weight: 700; font-size: 10.5px; white-space: nowrap; }

  .muted { color: #7A7D85; }

  /* ── Authenticiteitsvoet (stempel) ────────────────────────────── */
  .foot { margin-top: 24px; border-top: 2px solid #141518; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .foot .col { min-width: 0; }
  .foot .col.left { max-width: 62%; }
  .foot .col.right { text-align: right; }
  .foot .lbl { font-family: 'FIX50 Grotesk', Helvetica, Arial, sans-serif; font-size: 7.4px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #7A7D85; margin-bottom: 5px; }
  .foot a { color: #141518; font-size: 10px; text-decoration: none; border-bottom: 1px solid #D9DAD5; word-break: break-all; }
  .foot .code { font-family: 'FIX50 Grotesk', Helvetica, Arial, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.4px; white-space: nowrap; }
  .foot .meta { margin-top: 4px; font-size: 8.3px; color: #7A7D85; }
  .stamp { display: inline-block; margin-top: 9px; border: 1.5px solid #141518; padding: 3px 9px 2px; font-family: 'FIX50 Grotesk', Helvetica, Arial, sans-serif; font-size: 7.6px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; }
  .stamp .bfifty { color: #F97316; }

  @page { size: A4; margin: 11mm; }
  @media print { body { background: #fff; } .sheet { max-width: none; padding: 0; } .caliper { margin: 0 0 20px; } }
`;

/** Gedeelde kop: caliper, merklockup, doctag + titel + kentekenbadge. */
function pageHead(opts: {
  title: string;
  subtitle: string;
  docTag: string;
  docSub: string;
  scooterId: string;
  plateText: string | null;
}): string {
  const plate = opts.plateText ? opts.plateText.toUpperCase() : docNumber(opts.scooterId);
  return `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"/><title>${escapeHtml(opts.title)}</title><style>${BASE_CSS}</style></head>
<body><div class="sheet">
  <div class="caliper"></div>
  <header class="head">
    <div class="brand-row">
${brandLockup()}
      <div class="head-right">
        <span class="doc-tag">${escapeHtml(opts.docTag)}</span>
        <div class="head-meta">${escapeHtml(opts.docSub)}</div>
      </div>
    </div>
    <div class="title-row">
      <div>
        <h1 class="doc-title">${escapeHtml(opts.title)}</h1>
        <div class="doc-sub">${escapeHtml(opts.subtitle)}</div>
      </div>
      <div class="plate">${escapeHtml(plate)}</div>
    </div>
  </header>`;
}

/**
 * Publieke verify-URL. De Edge Function `verify` serveert een leesbare pagina
 * met codering + km-stand + laatste beurten, rechtstreeks uit de database.
 */
export function verifyUrl(licensePlate: string | null, scooterId: string): string {
  const id = licensePlate ? encodeURIComponent(licensePlate.toUpperCase()) : docNumber(scooterId);
  return `https://gdjargpxcdgciusycyya.supabase.co/functions/v1/verify?voertuig=${id}`;
}

/** Voet met verify-link, authenticiteitscodering en generate-notice. */
function pageFoot(opts: {
  scooterId: string;
  licensePlate: string | null;
  path: 'scooter' | 'tuning';
  generatedAtIso: string;
  leftTitle: string;
  metingId?: string | null;
}): string {
  const year = opts.generatedAtIso.slice(0, 4);
  const verify = verifyUrl(opts.licensePlate, opts.scooterId);
  return `  <div class="foot">
    <div class="col left">
      <div class="lbl">${escapeHtml(opts.leftTitle)}</div>
      <a href="${escapeHtml(verify)}">${escapeHtml(verify)}</a>
      <div class="meta">Gegenereerd door FIX50 App op ${escapeHtml(nlDate(opts.generatedAtIso))}</div>
    </div>
    <div class="col right">
      ${opts.metingId ? `<div class="code">Meting ID: ${escapeHtml(opts.metingId)}</div>` : ''}
      <div class="lbl" style="${opts.metingId ? 'margin-top:6px;' : ''}">Authenticiteitscodering</div>
      <div class="code">FX50-${authenticityCode(opts.scooterId, opts.generatedAtIso).slice(5, 9)}-${year}-X</div>
      <div class="meta">Pagina ${opts.path === 'scooter' ? '1' : '2'} van 2</div>
      <div class="stamp">Officieel Document · <span class="bfifty" style="color:#F97316;">FIX50</span></div>
    </div>
  </div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// 1. OFFICIEEL ONDERHOUDSBOEKJE (verkoopdossier, pagina 1)
// ---------------------------------------------------------------------------

export interface MaintenancePdfRecord {
  /** Weergavenaam (eigen omschrijving of onderdeelnaam). */
  name: string;
  doneAtIso: string;
  km: number | null;
  costCents: number | null;
  parts: string | null;
  notes: string | null;
}

/** Eén regel in de proactieve onderhoudsplanning ("Volgende oliewissel …"). */
export interface MaintenancePdfPlanningItem {
  /** Korte taaknaam, bijv. "Oliewissel". */
  item: string;
  /** Verwachting, bijv. "bij 17.500 km (over ~3.220 km)". */
  detail: string;
}

export interface MaintenancePdfInput {
  scooter: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    year: number | null;
    license_plate: string | null;
    fuel_system: string | null;
    engine_code: string | null;
    current_km: number;
  };
  ownerName: string | null;
  /** Oudste eerst. */
  records: MaintenancePdfRecord[];
  fuel?: { avgLPer100km: number | null; totalLiters: number; totalCents: number } | null;
  /** Volgende taken uit de FIX50-planning (max. 4 getoond). */
  planning?: MaintenancePdfPlanningItem[];
  /** Scooterfoto als data-URI of URL; valt weg wanneer afwezig. */
  photoSrc?: string | null;
  generatedAtIso?: string;
}

/** Officieel onderhoudsboekje — voertuiggegevens, KPI's, historie, planning. */
export function buildMaintenancePassHtml(input: MaintenancePdfInput): string {
  const { scooter, records } = input;
  const generatedAt = input.generatedAtIso ?? new Date().toISOString();
  const sorted = [...records].sort((a, b) => a.doneAtIso.localeCompare(b.doneAtIso));
  const totalCents = sorted.reduce((sum, r) => sum + (r.costCents ?? 0), 0);
  const years = new Set(sorted.map((r) => r.doneAtIso.slice(0, 4)));
  const perYear = years.size > 0 ? Math.round(totalCents / years.size) : 0;

  const modelLine = [scooter.brand, scooter.model, scooter.year ? String(scooter.year) : null]
    .filter(Boolean)
    .join(' ');

  const kmPerLiter =
    input.fuel?.avgLPer100km != null && input.fuel.avgLPer100km > 0
      ? formatKmPerLiterLabel(kmPerLiterFromL100(input.fuel.avgLPer100km))
      : null;

  const historyRows = sorted
    .map((r, i) => {
      const werk = r.notes ? `${escapeHtml(r.name)} — ${escapeHtml(r.notes)}` : escapeHtml(r.name);
      return `
        <tr>
          <td class="ref">#${String(i + 1).padStart(3, '0')}</td>
          <td>${escapeHtml(nlDate(r.doneAtIso))}</td>
          <td class="num">${r.km !== null ? `${escapeHtml(kmDot(r.km))} km` : '—'}</td>
          <td>${werk}</td>
          <td>${escapeHtml(r.parts ?? '—')}</td>
          <td class="num">${r.costCents !== null ? escapeHtml(euroCents(r.costCents)) : '—'}</td>
          <td>${'<span class="zelf">Zelf</span>'}</td>
        </tr>`;
    })
    .join('');

  const planningItems = (input.planning ?? []).slice(0, 4);
  const planningBlock =
    planningItems.length > 0
      ? `
  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>Proactieve Onderhoudsplanning (FIX50 Diagnose Engine)</h2>
      <span class="rule"></span>
    </div>
    <div class="section-sub">Verwachte momenten op basis van intervals en je kilometerstand</div>
    <div class="plan">
    ${planningItems
      .map((p) => `<div class="plan-item"><b>Volgende ${escapeHtml(p.item)}</b><span class="d">${escapeHtml(p.detail)}</span></div>`)
      .join('\n    ')}
    </div>
  </div>`
      : '';

  const photoBlock = input.photoSrc
    ? `<div class="veh-photo"><img src="${escapeHtml(input.photoSrc)}" alt="Scooter" /><div class="cap">${escapeHtml(scooter.name)}</div></div>`
    : '';

  return `${pageHead({
    title: 'Officieel Onderhoudsboekje',
    subtitle: 'Digitaal voertuigdossier & onderhoudshistorie',
    docTag: 'Verkoopdossier',
    docSub: `Gegenereerd: ${nlDate(generatedAt)}`,
    scooterId: scooter.id,
    plateText: scooter.license_plate,
  })}
  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>Voertuiggegevens</h2>
      <span class="rule"></span>
    </div>
    <div class="veh">
    <table class="tech"><tbody>
      <tr><td class="k">Merk &amp; Model</td><td><strong>${escapeHtml(modelLine || scooter.name)}</strong></td></tr>
      ${scooter.year !== null ? `<tr><td class="k">Bouwjaar</td><td>${escapeHtml(String(scooter.year))}</td></tr>` : ''}
      ${scooter.fuel_system ? `<tr><td class="k">Brandstofsysteem</td><td>${escapeHtml(scooter.fuel_system)}</td></tr>` : ''}
      ${scooter.engine_code ? `<tr><td class="k">Motorcode</td><td><strong>${escapeHtml(scooter.engine_code)}</strong></td></tr>` : ''}
      ${scooter.license_plate ? `<tr><td class="k">Kenteken</td><td><strong>${escapeHtml(scooter.license_plate.toUpperCase())}</strong></td></tr>` : ''}
      <tr><td class="k">Huidige stand</td><td><strong style="font-size:12.5px;">${escapeHtml(kmDot(scooter.current_km))} km</strong> <span class="muted" style="font-size:9px;">(geverifieerd door FIX50 App)</span></td></tr>
      <tr><td class="k">Eigenaar / registrant</td><td><strong>${escapeHtml(input.ownerName ?? 'Eigenaar')}</strong></td></tr>
    </tbody></table>
    ${photoBlock}
    </div>
  </div>

  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>Kerncijfers</h2>
      <span class="rule"></span>
    </div>
    <div class="kpis">
      <div class="kpi">
        <div class="lbl">Totaal beurten</div>
        <div class="val">${sorted.length}x</div>
        <div class="sub">volgens FIX50-schema</div>
      </div>
      <div class="kpi">
        <div class="lbl">Totale kosten</div>
        <div class="val">${escapeHtml(euroCents(totalCents))}</div>
        <div class="sub">excl. brandstof</div>
      </div>
      <div class="kpi">
        <div class="lbl">Gem. verbruik</div>
        <div class="val">${input.fuel?.avgLPer100km != null ? `${input.fuel.avgLPer100km.toFixed(1).replace('.', ',')}<small>L/100km</small>` : '—'}</div>
        <div class="sub">${input.fuel?.avgLPer100km != null ? escapeHtml(kmPerLiter ?? '') : 'geen tankbeurten'}</div>
      </div>
      <div class="kpi">
        <div class="lbl">Kosten / jaar</div>
        <div class="val">${years.size > 0 ? escapeHtml(euroCents(perYear)) : '—'}</div>
        <div class="sub">gemiddeld onderhoud</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>Onderhoudshistorie (oudste bovenaan)</h2>
      <span class="rule"></span>
      <span class="count-chip">${sorted.length} beurten · fraudevrij geregistreerd</span>
    </div>
    <div class="section-sub">Zelfregistraties, vastgelegd met datum, stand, onderdelen en kosten</div>
    ${
      sorted.length > 0
        ? `<table class="history">
      <thead><tr><th>Ref</th><th>Datum</th><th>Km-stand</th><th>Werkzaamheden</th><th>Onderdelen / omschrijving</th><th>Kosten</th><th>Door</th></tr></thead>
      <tbody>${historyRows}
      </tbody>
    </table>`
        : `<table class="history"><tbody><tr><td class="muted">Nog geen onderhoud geregistreerd voor dit voertuig.</td></tr></tbody></table>`
    }
  </div>
${planningBlock}
${pageFoot({
  scooterId: scooter.id,
  licensePlate: scooter.license_plate,
  path: 'scooter',
  generatedAtIso: generatedAt,
  leftTitle: 'Scankoppeling Live Verkoopdossier',
})}`;
}

// ---------------------------------------------------------------------------
// 2. PERFORMANCE & TUNING RAPPORT (pagina 2)
// ---------------------------------------------------------------------------

export interface TuningPdfRun {
  id: string;
  setup_id: string | null;
  started_at: string;
  t0_50_s: number | null;
  t0_80_s: number | null;
  t50_80_s: number | null;
  max_speed_kmh: number | null;
  distance_m: number | null;
  gps_quality: string;
  points: { t_ms: number; speed_kmh: number }[];
}

export interface TuningPdfSetup {
  id: string;
  name: string;
  parts: Record<string, string | number | null>;
  is_active: boolean;
}

export interface TuningPdfChange {
  changed_at: string;
  part: string;
  old_value: string | null;
  new_value: string | null;
  result: string | null;
  km_at_change: number | null;
}

export interface TuningPdfInput {
  scooter: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    license_plate: string | null;
    current_km: number;
  };
  ownerName: string | null;
  setups: TuningPdfSetup[];
  /** Alleen metingen van deze scooter. */
  runs: TuningPdfRun[];
  changes?: TuningPdfChange[];
  /** Scooterfoto als data-URI of URL; valt weg wanneer afwezig. */
  photoSrc?: string | null;
  generatedAtIso?: string;
}

/** Tijdsduur "4,32 s" of "—". */
function fmtSeconds(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2).replace('.', ',')} s`;
}

/** Snelheid "63,4 km/u" of "—". */
function fmtSpeed(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1).replace('.', ',')} km/u`;
}

/**
 * Beste "hero"-meting: laagste geldige 0–50-tijd, anders de laatste meting.
 * Zuiver — unit-getest.
 */
export function pickHeroRun(runs: TuningPdfRun[]): TuningPdfRun | null {
  const withT050 = runs.filter((r) => r.t0_50_s !== null);
  if (withT050.length > 0) {
    return withT050.reduce((best, r) => ((r.t0_50_s ?? Infinity) < (best.t0_50_s ?? Infinity) ? r : best));
  }
  return [...runs].sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
}

/** Grote SVG-snelheidscurve met rasterlijnen, vlakvulling en as-labels. */
export function speedChart(points: { t_ms: number; speed_kmh: number }[], width = 700, height = 190): string {
  const clean = points.filter((p) => Number.isFinite(p.t_ms) && Number.isFinite(p.speed_kmh));
  if (clean.length < 2) return '';
  const tMin = clean[0]!.t_ms;
  const tMax = Math.max(clean[clean.length - 1]!.t_ms, tMin + 1);
  const padL = 34;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const baseY = height - padB;
  const vMax = Math.ceil(Math.max(...clean.map((p) => p.speed_kmh), 1) / 10) * 10;
  const x = (t: number) => padL + ((t - tMin) / (tMax - tMin)) * (width - padL - padR);
  const y = (v: number) => padT + (1 - v / vMax) * (baseY - padT);
  const coords = clean.map((p) => `${x(p.t_ms).toFixed(1)},${y(p.speed_kmh).toFixed(1)}`).join(' ');
  const lastX = x(clean[clean.length - 1]!.t_ms).toFixed(1);
  const grid = [0.25, 0.5, 0.75]
    .map(
      (f) =>
        `<line x1="${padL}" y1="${(padT + (1 - f) * (baseY - padT)).toFixed(1)}" x2="${width - padR}" y2="${(padT + (1 - f) * (baseY - padT)).toFixed(1)}" stroke="#E7E8E3" stroke-width="1"/>`,
    )
    .join('');
  const vLabels = [1, 0.5, 0]
    .map((f) => {
      const v = Math.round(vMax * f);
      return `<text x="${padL - 5}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="8" font-weight="bold" fill="#7A7D85" font-family="Space Grotesk, Courier New, monospace">${v}</text>`;
    })
    .join('');
  const tEnd = (tMax - tMin) / 1000;
  return `<svg class="spark" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Snelheidscurve van de GPS-meting">
    ${grid}
    <polygon fill="rgba(249,115,22,0.10)" points="${coords} ${lastX},${baseY} ${padL},${baseY}"/>
    <line x1="${padL}" y1="${baseY}" x2="${width - padR}" y2="${baseY}" stroke="#141518" stroke-width="1.4"/>
    <polyline fill="none" stroke="#F97316" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" points="${coords}"/>
    ${vLabels}
    <text x="${padL}" y="${height - 8}" font-size="8" font-weight="bold" fill="#7A7D85" font-family="Space Grotesk, Courier New, monospace">0s</text>
    <text x="${width - padR}" y="${height - 8}" text-anchor="end" font-size="8" font-weight="bold" fill="#7A7D85" font-family="Space Grotesk, Courier New, monospace">${tEnd.toFixed(1).replace('.', ',')}s</text>
  </svg>`;
}

/** Onderdeel-dictionary → rijen (lege velden weg), tweecolumig gerenderd. */
function specRows(parts: Record<string, string | number | null>): string {
  const entries = Object.entries(parts).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== '',
  );
  if (entries.length === 0) {
    return `<tr><td colspan="4" class="muted">Geen onderdelen vastgelegd voor deze setup.</td></tr>`;
  }
  const half = Math.ceil(entries.length / 2);
  const left = entries.slice(0, half);
  const right = entries.slice(half);
  const row = (l: (typeof entries)[number] | undefined, r: (typeof entries)[number] | undefined) => `
    <tr>
      <td class="k">${l ? escapeHtml(l[0].replace(/_/g, ' ')) : ''}</td><td>${l ? `<strong>${escapeHtml(String(l[1]))}</strong>` : ''}</td>
      <td class="k">${r ? escapeHtml(r[0].replace(/_/g, ' ')) : ''}</td><td>${r ? `<strong>${escapeHtml(String(r[1]))}</strong>` : ''}</td>
    </tr>`;
  return Array.from({ length: half }, (_, i) => row(left[i], right[i])).join('');
}

/** Metingen-overzicht: alle runs, nieuwste eerst, compact. */
function runsTable(runs: TuningPdfRun[]): string {
  const rows = [...runs]
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 12)
    .map(
      (r) => `<tr>
        <td>${escapeHtml(nlDate(r.started_at))}</td>
        <td>${escapeHtml(fmtSeconds(r.t0_50_s))}</td>
        <td>${escapeHtml(fmtSeconds(r.t0_80_s))}</td>
        <td>${escapeHtml(fmtSeconds(r.t50_80_s))}</td>
        <td class="num">${escapeHtml(fmtSpeed(r.max_speed_kmh))}</td>
        <td>${escapeHtml(r.gps_quality)}</td>
      </tr>`,
    )
    .join('');
  return `<table class="history">
    <thead><tr><th>Datum</th><th>0–50</th><th>0–80</th><th>50–80</th><th>Top (GPS)</th><th>GPS</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** Wijzigingsregister, compact (max. 8, nieuwste eerst). */
function changesTable(changes: TuningPdfChange[]): string {
  if (changes.length === 0) return '';
  const rows = [...changes]
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    .slice(0, 8)
    .map(
      (c) =>
        `<tr><td>${escapeHtml(nlDate(c.changed_at))}</td><td><strong>${escapeHtml(c.part)}</strong></td><td>${escapeHtml(c.old_value ?? '—')} → ${escapeHtml(c.new_value ?? '—')}</td><td>${escapeHtml(c.result ?? '')}</td></tr>`,
    )
    .join('');
  return `
  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>Wijzigingsregister</h2>
      <span class="rule"></span>
      <span class="count-chip">${changes.length} wijzigingen</span>
    </div>
    <div class="section-sub">Chronologisch, meest recente eerst</div>
    <table class="history">
      <thead><tr><th>Datum</th><th>Onderdeel</th><th>Wijziging</th><th>Resultaat</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/** Volledig performance- & tuningrapport. */
export function buildTuningPassHtml(input: TuningPdfInput): string {
  const { scooter, setups, runs } = input;
  const generatedAt = input.generatedAtIso ?? new Date().toISOString();
  const modelLine = [scooter.brand, scooter.model].filter(Boolean).join(' ');
  const hero = pickHeroRun(runs);

  const bestT050 = runs.reduce<number | null>(
    (best, r) => (r.t0_50_s !== null && (best === null || r.t0_50_s < best) ? r.t0_50_s : best),
    null,
  );
  const bestT080 = runs.reduce<number | null>(
    (best, r) => (r.t0_80_s !== null && (best === null || r.t0_80_s < best) ? r.t0_80_s : best),
    null,
  );
  const bestT5080 = runs.reduce<number | null>(
    (best, r) => (r.t50_80_s !== null && (best === null || r.t50_80_s < best) ? r.t50_80_s : best),
    null,
  );
  const topSpeed = runs.reduce<number | null>(
    (best, r) => (r.max_speed_kmh !== null && (best === null || r.max_speed_kmh > best) ? r.max_speed_kmh : best),
    null,
  );

  const activeSetup = setups.find((s) => s.is_active) ?? setups[0] ?? null;

  const curveSection = hero
    ? `<div class="section">
      <div class="section-head">
        <span class="tick"></span>
        <h2>Snelheidscurve &amp; acceleratie (GPS-meting)</h2>
        <span class="rule"></span>
      </div>
      <div class="section-sub">Meting van ${escapeHtml(nlDate(hero.started_at))} · GPS ${escapeHtml(hero.gps_quality)}${hero.distance_m !== null ? ` · afstand ${escapeHtml(kmDot(Math.round(hero.distance_m)))} m` : ''}</div>
      ${speedChart(hero.points)}
    </div>`
    : `<div class="section">
      <div class="section-head">
        <span class="tick"></span>
        <h2>Snelheidscurve &amp; acceleratie</h2>
        <span class="rule"></span>
        <span class="count-chip">geen metingen</span>
      </div>
      <div class="conclusion"><span class="muted">Nog geen GPS-metingen geregistreerd voor dit voertuig.</span></div>
    </div>`;

  const runStats =
    runs.length > 0
      ? `<div class="line"><span>Metingen geregistreerd</span><b>${runs.length}</b></div>
         ${bestT050 !== null ? `<div class="line"><span>Snelste 0–50</span><b>${escapeHtml(fmtSeconds(bestT050))}</b></div>` : ''}
         ${bestT5080 !== null ? `<div class="line"><span>Snelste 50–80</span><b>${escapeHtml(fmtSeconds(bestT5080))}</b></div>` : ''}
         ${topSpeed !== null ? `<div class="line"><span>Hoogste topsnelheid (GPS)</span><b>${escapeHtml(fmtSpeed(topSpeed))}</b></div>` : ''}`
      : '<div class="line"><span>Metingen</span><b>geen</b></div>';

  const changesSection = input.changes && input.changes.length > 0 ? changesTable(input.changes) : '';

  const photoBlock = input.photoSrc
    ? `<div class="veh-photo"><img src="${escapeHtml(input.photoSrc)}" alt="Scooter" /><div class="cap">${escapeHtml(scooter.name)}</div></div>`
    : '';

  return `${pageHead({
    title: 'Performance & Tuning Rapport',
    subtitle: 'FIX50 GPS & telemetrie datalogging',
    docTag: 'Tuning Diagnose',
    docSub: hero ? `Testdatum: ${nlDate(hero.started_at)}` : `Gegenereerd: ${nlDate(generatedAt)}`,
    scooterId: scooter.id,
    plateText: scooter.license_plate,
  })}
  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>Voertuig</h2>
      <span class="rule"></span>
    </div>
    <div class="veh">
    <table class="tech"><tbody>
      <tr><td class="k">Voertuigtype / Model</td><td><strong>${escapeHtml(modelLine || scooter.name)}</strong></td></tr>
      ${scooter.license_plate ? `<tr><td class="k">Kenteken</td><td><strong>${escapeHtml(scooter.license_plate.toUpperCase())}</strong></td></tr>` : ''}
      <tr><td class="k">Huidige stand</td><td><strong style="font-size:12.5px;">${escapeHtml(kmDot(scooter.current_km))} km</strong></td></tr>
      <tr><td class="k">Eigenaar / registrant</td><td><strong>${escapeHtml(input.ownerName ?? 'Eigenaar')}</strong></td></tr>
    </tbody></table>
    ${photoBlock}
    </div>
  </div>

  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>Acceleratie &amp; topsnelheid</h2>
      <span class="rule"></span>
    </div>
    <div class="kpis">
      <div class="kpi">
        <div class="lbl">0–50 km/h acceleratie</div>
        <div class="val accent">${bestT050 !== null ? `${bestT050.toFixed(2).replace('.', ',')}<small>sec</small>` : '—'}</div>
        <div class="sub">beste van ${runs.length} meting${runs.length === 1 ? '' : 'en'}</div>
      </div>
      <div class="kpi">
        <div class="lbl">50–80 km/h tussensprint</div>
        <div class="val">${bestT5080 !== null ? `${bestT5080.toFixed(2).replace('.', ',')}<small>sec</small>` : bestT080 !== null ? `${bestT080.toFixed(2).replace('.', ',')}<small>sec</small>` : '—'}</div>
        <div class="sub">${bestT5080 !== null ? '50–80 km/h' : bestT080 !== null ? '0–80 km/h' : 'niet gemeten'}</div>
      </div>
      <div class="kpi">
        <div class="lbl">Echte topsnelheid (GPS)</div>
        <div class="val">${topSpeed !== null ? `${topSpeed.toFixed(1).replace('.', ',')}<small>km/h</small>` : '—'}</div>
        <div class="sub">hoogste GPS-waarde</div>
      </div>
    </div>
  </div>

${curveSection}

  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>Aanwezige tuning &amp; setup-specificaties</h2>
      <span class="rule"></span>
      <span class="count-chip">${setups.length} setups · ${runs.length} metingen</span>
    </div>
    <div class="section-sub">${activeSetup ? `${escapeHtml(activeSetup.name)}${activeSetup.is_active ? ' · actieve setup' : ''}` : 'geen setup geregistreerd'}</div>
    <table class="tech"><tbody>${activeSetup ? specRows(activeSetup.parts) : '<tr><td class="muted">Geen setup geregistreerd.</td></tr>'}</tbody></table>
  </div>

  ${
    runs.length > 0
      ? `
  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>Metingen-overzicht</h2>
      <span class="rule"></span>
    </div>
    <div class="section-sub">Alle GPS-metingen van dit voertuig, nieuwste eerst</div>
    ${runsTable(runs)}
  </div>`
      : ''
  }
${changesSection}
  <div class="section">
    <div class="section-head">
      <span class="tick"></span>
      <h2>FIX50 Diagnose conclusie</h2>
      <span class="rule"></span>
    </div>
    <div class="section-sub">Feitelijke samenvatting van de geregistreerde data</div>
    <div class="conclusion">
      ${runStats}
    </div>
  </div>
${pageFoot({
  scooterId: scooter.id,
  licensePlate: scooter.license_plate,
  path: 'tuning',
  generatedAtIso: generatedAt,
  leftTitle: 'FIX50 Telemetrie Dossier',
  metingId: hero ? `LOG-${hero.id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : null,
})}`;
}
