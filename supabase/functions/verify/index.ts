/**
 * Edge Function: verify
 * Publieke verificatiepagina voor het FIX50-onderhoudsboekje.
 *
 * GET /functions/v1/verify?voertuig=<kenteken of DOC-xxxxxx-NL>
 *
 * Toont: voertuig, authenticiteitscodering, km-stand en de laatste 5 beurten —
 * rechtstreeks uit de database. Geen auth: alleen niet-gevoelige apparaatdata.
 * De pagina bewijst dat een geprint boekje bij een echt FIX50-dossier hoort.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Deterministische zelfde hash-logica als src/lib/pdf.ts (authenticityCode). */
function authenticityCode(scooterId: string, isoDate: string): string {
  const seed = scooterId.replace(/-/g, '');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const part = String(hash % 10000).padStart(4, '0');
  const year = isoDate.slice(0, 4) || String(new Date().getFullYear());
  return `FX50-${part}-${year}-X`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nlDate(iso: string): string {
  const date = iso.slice(0, 10);
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

const PAGE_CSS = `
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0b0d10; color: #e6e8eb; margin: 0; padding: 40px 16px; }
  .card { max-width: 640px; margin: 0 auto; background: #121417; border: 1px solid #252830; border-radius: 14px; padding: 28px; }
  .brand { color: #ff6b00; font-weight: 800; letter-spacing: 1px; font-size: 13px; text-transform: uppercase; }
  h1 { font-size: 22px; margin: 6px 0 4px; letter-spacing: -0.3px; }
  .sub { color: #9ba1ab; font-size: 14px; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  td { padding: 9px 4px; border-bottom: 1px solid #1f2228; vertical-align: top; }
  td.k { color: #9ba1ab; width: 40%; }
  td b { color: #e6e8eb; }
  .ok { display: inline-block; background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.35); border-radius: 999px; padding: 4px 12px; font-size: 12.5px; font-weight: 600; }
  .err { display: inline-block; background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.35); border-radius: 999px; padding: 4px 12px; font-size: 12.5px; font-weight: 600; }
  .muted { color: #6b7280; font-size: 12px; margin-top: 16px; }
`;

function page(body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>FIX50 — Verificatie</title><style>${PAGE_CSS}</style></head>
<body><div class="card">${body}</div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

Deno.serve(async (req: Request) => {
  if (SUPABASE_URL === '' || SERVICE_ROLE_KEY === '') {
    return page('<span class="err">Server niet geconfigureerd</span>', 500);
  }

  const url = new URL(req.url);
  const voertuig = (url.searchParams.get('voertuig') ?? '').trim();
  if (voertuig === '') {
    return page(
      `<span class="err">Geen voertuig opgegeven</span>
       <h1>Verificatie mislukt</h1>
       <p class="sub">Gebruik de link of QR-code op het onderhoudsboekje.</p>`,
      400,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Zoek op kenteken (case-insensitief) of op documentnummer-basis.
  const plate = voertuig.toUpperCase();
  const isDoc = /^DOC-/.test(plate);
  const docBase = isDoc ? plate.replace(/^DOC-/, '').replace(/-NL$/, '') : null;

  let query = admin
    .from('scooters')
    .select('id, name, brand, model, year, license_plate, current_km, updated_at');
  query = isDoc && docBase ? query.ilike('id', `${docBase}%`) : query.ilike('license_plate', plate);
  const { data: scooters, error } = await query.limit(1);

  if (error) {
    return page('<span class="err">Databasefout</span><h1>Verificatie mislukt</h1>', 500);
  }
  const scooter = scooters?.[0];
  if (!scooter) {
    return page(
      `<span class="err">Niet gevonden</span>
       <h1>Dit voertuig staat niet in FIX50</h1>
       <p class="sub">Er is geen FIX50-dossier gevonden bij "${escapeHtml(voertuig)}". Het boekje kan niet geverifieerd worden.</p>`,
      404,
    );
  }

  const { data: records } = await admin
    .from('maintenance_records')
    .select('done_at, km_at_service, custom_name, item_id, parts, notes, cost_cents')
    .eq('scooter_id', scooter.id)
    .order('done_at', { ascending: false })
    .limit(5);

  const { data: items } = await admin
    .from('maintenance_items')
    .select('id, name')
    .in('id', (records ?? []).map((r) => r.item_id).filter(Boolean) as string[]);

  const nameOf = (r: { custom_name: string | null; item_id: string | null }) =>
    r.custom_name ?? items?.find((i) => i.id === r.item_id)?.name ?? 'Onderhoud';

  const rows = (records ?? [])
    .map(
      (r) => `<tr>
        <td>${escapeHtml(nlDate(r.done_at))}</td>
        <td>${r.km_at_service !== null ? escapeHtml(r.km_at_service.toLocaleString('nl-NL')) + ' km' : '—'}</td>
        <td><b>${escapeHtml(nameOf(r))}</b></td>
        <td>${r.cost_cents !== null ? '€ ' + escapeHtml((r.cost_cents / 100).toFixed(2).replace('.', ',')) : '—'}</td>
      </tr>`,
    )
    .join('');

  const generatedIso = new Date().toISOString();
  const code = authenticityCode(scooter.id, generatedIso);
  const model = [scooter.brand, scooter.model, scooter.year].filter(Boolean).join(' ');

  return page(`
    <span class="ok">✓ Geverifieerd FIX50-dossier</span>
    <h1>${escapeHtml(model || scooter.name)}</h1>
    <p class="sub">Dit voertuig is geregistreerd in FIX50 en het onderhoudsboekje komt overeen met de data hieronder.</p>
    <table>
      <tr><td class="k">Kenteken</td><td><b>${escapeHtml((scooter.license_plate ?? '—').toUpperCase())}</b></td></tr>
      <tr><td class="k">Huidige km-stand</td><td><b>${escapeHtml(scooter.current_km.toLocaleString('nl-NL'))} km</b></td></tr>
      <tr><td class="k">Laatste update</td><td>${escapeHtml(nlDate(scooter.updated_at))}</td></tr>
      <tr><td class="k">Authenticiteitscodering</td><td><b>${escapeHtml(code)}</b></td></tr>
    </table>
    <p style="margin:18px 0 6px; font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:0.6px; color:#9ba1ab;">Laatste 5 beurten</p>
    ${records && records.length > 0 ? `<table>${rows}</table>` : '<p class="sub">Nog geen beurten geregistreerd.</p>'}
    <p class="muted">Geverifieerd op ${escapeHtml(nlDate(generatedIso))} · FIX50 — digitaal onderhoudsboekje. Komt de km-stand hier niet overeen met het boekje? Neem contact op met de verkoper.</p>
  `);
});
