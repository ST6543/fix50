/**
 * FIX50 — Slimme signalen (fase A van het AI-plan, docs/AI-SLIMMER-PLAN.md).
 *
 * Deterministische signalen-laag: rekent trends en afwijkingen uit de bestaande
 * data (tankbeurten, onderhoudsforecast, GPS-metingen) en geeft een lijst
 * `Insight[]` terug. Geen AI nodig — de cijfers komen altijd uit de data; een
 * latere AI-laag (fase B) kan deze signalen verwoorden en prioriteren.
 *
 * Zuivere functies: geen netwerk, geen RN — unit-getest.
 */
import { formatKmPerLiter, type FuelStats } from '@/services/fuel';
import type { WeekForecastItem } from '@/services/maintenance';
import type { NotificationType, PerformanceRun, UUID } from '@/types';

export type InsightSeverity = 'info' | 'let op' | 'risico';
export type InsightKind = 'verbruik' | 'onderhoud' | 'performance' | 'tuning';

/** Eén signaal dat op Home getoond kan worden. */
export interface Insight {
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** Onderbouwing: de meetwaarden waarop dit berust (DB-first principe). */
  evidence: string;
}

/** Verbruiksignaal pas bij minimaal deze afstand tussen twee beurten. */
export const MIN_FUEL_DISTANCE_KM = 30;
/** "Let op" als de beurt >15% onzuiniger is dan het gewogen gemiddelde. */
export const FUEL_WORSE_RATIO = 0.85;
/** "Info" bij >15% zuiniger. */
export const FUEL_BETTER_RATIO = 1.15;
/** Pas waarschuwen als ook de vorige beurt al afweek (geen winter-ruis). */
export const FUEL_CONFIRM_COUNT = 2;
/** Maximale seizoenscorrectie op het verbruik (dec/jan/feb = +12%). */
export const WINTER_FUEL_BONUS = 0.12;
/** Prestatie-daling pas bij >0,3 s verschil op 0–50. */
export const PERF_DROP_S = 0.3;
/** Setup-vergelijking pas bij ≥15% verschil in gemiddelde 0–50. */
export const SETUP_DIFF_REL = 0.15;
/** Meet-trend vergelijk de laatste N metingen met N oudere van dezelfde setup. */
export const RUN_TREND_COUNT = 3;
/** Trend pas bij >0,25 s verschil tussen de twee groepen. */
export const RUN_TREND_DIFF_S = 0.25;

/**
 * Seizoenscorrectie: koud weer (dec–feb, NL) kost een brommer gemakkelijk
 * 10–15% verbruik. De ruwe ratio (eigen verbruik / gemiddelde) van een
 * winterbeurt wordt daarom méér gewaardeerd (×(1+bonus)): een gezonde
 * scooter zit in de winter rond raw ≈ 0,89 en mag niet als defect
 * gezien worden. Een écht defect (raw ≈ 0,7) blijft onder de drempel.
 */
export function winterCorrection(filledAtIso: string): number {
  const month = Number(filledAtIso.slice(5, 7));
  return month === 12 || month === 1 || month === 2 ? 1 + WINTER_FUEL_BONUS : 1;
}

/**
 * Verbruikstrend: vergelijk de laatste tankbeurten met een baseline van
 * oudere beurten (km per liter, de "1 op X"-waarde). Een baseline van het
 * totaalgemiddelde werkt niet: slechte beurten trekken het gemiddelde omlaag
 * en verwateren zo hun eigen afwijking. Een enkele afwijkende beurt is nog
 * geen signaal (ruis, weer, rijstijl) — pas als FUEL_CONFIRM_COUNT beurten
 * achter elkaar afwijken volgt een waarschuwing. Verbetering mag wél met
 * één beurt, want daar is geen actie nodig. Beurten met een te korte
 * tussenafstand (< MIN_FUEL_DISTANCE_KM) zijn te onnauwkeurig en tellen niet.
 * Returns null zolang het verbruik stabiel is of de data te mager is.
 */
export function detectFuelTrend(stats: FuelStats): Insight | null {
  const points = stats.points;
  if (points.length < 2 || stats.avgKmPerLiter === null || stats.avgKmPerLiter <= 0) return null;

  const latest = points[points.length - 1]!;
  if (latest.distanceKm < MIN_FUEL_DISTANCE_KM) return null;

  // Alleen beurten met genoeg tussenafstand zijn bruikbaar.
  const qualifying = points.filter((p) => p.distanceKm >= MIN_FUEL_DISTANCE_KM);
  const recent = qualifying.slice(-FUEL_CONFIRM_COUNT);
  const baselinePoints = qualifying.slice(0, -FUEL_CONFIRM_COUNT);
  if (recent.length < FUEL_CONFIRM_COUNT || baselinePoints.length === 0) return null;

  // Baseline = afstands-gewogen gemiddelde van de oudere beurten.
  const baseKm = baselinePoints.reduce((sum, p) => sum + p.distanceKm, 0);
  const baseLiters = baselinePoints.reduce((sum, p) => sum + (p.distanceKm * p.lPer100km) / 100, 0);
  if (baseKm <= 0 || baseLiters <= 0) return null;
  const baselineKmPerLiter = baseKm / baseLiters;

  // Seizoenscorrectie: winterbeurten mogen tot 12% slechter zijn zonder alarm.
  const ratioOf = (p: (typeof qualifying)[number]) =>
    (p.kmPerLiter / baselineKmPerLiter) * winterCorrection(p.filledAtIso);
  const allWorse = recent.every((p) => ratioOf(p) < FUEL_WORSE_RATIO);

  const correctedRatio = ratioOf(latest);
  const evidence = `laatste beurt ${formatKmPerLiter(latest.kmPerLiter)} over ${latest.distanceKm.toLocaleString('nl-NL')} km · eerder gemiddeld ${formatKmPerLiter(baselineKmPerLiter)}`;

  if (allWorse) {
    const dropPct = Math.round((1 - correctedRatio) * 100);
    return {
      kind: 'verbruik',
      severity: 'let op',
      title: 'Verbruik verslechterd',
      detail: `Je rijdt nu ${formatKmPerLiter(latest.kmPerLiter)} i.p.v. eerder gemiddeld ${formatKmPerLiter(baselineKmPerLiter)} (${dropPct}% onzuiniger, ${FUEL_CONFIRM_COUNT} beurten op rij). Vaak voorkomende oorzaken: verstopt luchtfilter, versleten bougie of een gewijzigde sproeierinstelling.`,
      evidence,
    };
  }
  if (correctedRatio > FUEL_BETTER_RATIO) {
    const gainPct = Math.round((correctedRatio - 1) * 100);
    return {
      kind: 'verbruik',
      severity: 'info',
      title: 'Verbruik verbeterd',
      detail: `De laatste beurt zat ${gainPct}% zuiniger dan je eerdere gemiddelde (${formatKmPerLiter(latest.kmPerLiter)} t.o.v. ${formatKmPerLiter(baselineKmPerLiter)}). Mooi resultaat.`,
      evidence,
    };
  }
  return null;
}

/**
 * Onderhoud: taken die al voorbij hun verwachte moment zijn.
 * "Binnenkort"-taken laten we bewust aan de Verwachting-kaart op Home.
 */
export function detectOverdueMaintenance(forecast: WeekForecastItem[]): Insight | null {
  const overdue = forecast.filter((f) => f.overdue);
  if (overdue.length === 0) return null;

  const names = overdue.map((f) => f.item.name);
  const rest = names.length - 2;
  const listed = rest > 0 ? names.slice(0, 2).join(', ') : names.join(' en ');
  return {
    kind: 'onderhoud',
    severity: 'risico',
    title: `${names.length} ${names.length === 1 ? 'onderhoudstaak' : 'onderhoudstaken'} te laat`,
    detail:
      rest > 0
        ? `${listed} en ${rest} meer ${rest === 1 ? 'taak' : 'taken'} zijn over het interval heen. Plan ze zo snel mogelijk in.`
        : `${listed} ${names.length > 1 ? 'zijn' : 'is'} over het interval heen. Plan ${names.length > 1 ? 'ze' : 'dit'} zo snel mogelijk in.`,
    evidence: names.join(', '),
  };
}

/** Groepeer metingen per setup en bereken het gemiddelde 0–50 per groep. */
function avgT050PerSetup(runs: PerformanceRun[]): Map<UUID, { avg: number; count: number }> {
  const groups = new Map<UUID, { sum: number; count: number }>();
  for (const r of runs) {
    if (r.t0_50_s === null || r.setup_id === null) continue;
    const g = groups.get(r.setup_id) ?? { sum: 0, count: 0 };
    g.sum += r.t0_50_s;
    g.count += 1;
    groups.set(r.setup_id, g);
  }
  const out = new Map<UUID, { avg: number; count: number }>();
  for (const [id, g] of groups) out.set(id, { avg: g.sum / g.count, count: g.count });
  return out;
}

/**
 * Setup-vergelijking: welke setup is gemiddeld sneller op 0–50?
 * Vereist minimaal 2 setups met elk ≥2 metingen en ≥15% verschil.
 */
export function detectSetupComparison(
  runs: PerformanceRun[],
  setupNames: Record<UUID, string> = {},
): Insight | null {
  const perSetup = avgT050PerSetup(runs);
  const entries = [...perSetup.entries()].filter(([, v]) => v.count >= 2);
  if (entries.length < 2) return null;

  const sorted = entries.sort((a, b) => a[1].avg - b[1].avg);
  const fastest = sorted[0]!;
  const slowest = sorted[sorted.length - 1]!;
  const rel = (slowest[1].avg - fastest[1].avg) / slowest[1].avg;
  if (rel < SETUP_DIFF_REL) return null;

  const nameOf = (id: UUID) => setupNames[id] ?? `Setup ${id.slice(0, 4)}`;
  const evidence = sorted
    .map(([id, v]) => `${nameOf(id)}: ${v.avg.toFixed(2).replace('.', ',')} s (${v.count} metingen)`)
    .join(' · ');
  return {
    kind: 'tuning',
    severity: 'info',
    title: `Sneller met ${nameOf(fastest[0])}`,
    detail: `Gemiddeld ${fastest[1].avg.toFixed(2).replace('.', ',')} s op 0–50 t.o.v. ${slowest[1].avg.toFixed(2).replace('.', ',')} s met ${nameOf(slowest[0])} (${Math.round(rel * 100)}% verschil).`,
    evidence,
  };
}

/**
 * Meet-trend (fase C): vergelijk het gemiddelde van de laatste RUN_TREND_COUNT
 * metingen met een gelijk aantal oudere metingen van dezelfde setup. Een enkele
 * trage meting is al gedekt door detectPerformanceDrop (laatst vs. beste); hier
 * gaat het om een aanhoudende trend — precies wat fase C bedoelt met
 * "correlaties". Vestigt alleen als er minimaal 2 × RUN_TREND_COUNT geldige
 * metingen zijn, zodat de richting niet op ruis berust.
 */
export function detectRunTrend(
  runs: PerformanceRun[],
  setupNames: Record<UUID, string> = {},
): Insight | null {
  const groups = new Map<UUID, { t: PerformanceRun[] }>();
  for (const r of runs) {
    if (r.t0_50_s === null || r.setup_id === null) continue;
    const g = groups.get(r.setup_id) ?? { t: [] };
    g.t.push(r);
    groups.set(r.setup_id, g);
  }

  let worst: { setupId: UUID; diffS: number; n: number } | null = null;
  for (const [setupId, { t }] of groups) {
    if (t.length < RUN_TREND_COUNT * 2) continue;
    const ordered = [...t].sort((a, b) => a.started_at.localeCompare(b.started_at));
    const n = RUN_TREND_COUNT;
    const older = ordered.slice(0, n);
    const recent = ordered.slice(-n);
    const avgOf = (rs: PerformanceRun[]) => rs.reduce((s, r) => s + (r.t0_50_s ?? 0), 0) / rs.length;
    const diff = avgOf(recent) - avgOf(older);
    if (diff > RUN_TREND_DIFF_S && (!worst || diff > worst.diffS)) {
      worst = { setupId, diffS: diff, n };
    }
  }
  if (!worst) return null;

  const name = setupNames[worst.setupId] ?? 'je actieve setup';
  const pct = Math.round((worst.diffS / (worst.diffS + 2)) * 100);
  return {
    kind: 'performance',
    severity: 'let op',
    title: 'Metingen worden consistently trager',
    detail: `Gemiddeld over de laatste ${worst.n} metingen met ${name} rij je ${worst.diffS.toFixed(2).replace('.', ',')} s trager dan daarvoor. Dat is een trend, geen losse uitglijer — vaak voorkomende oorzaak: versleten koppelingsrollen of bandenspanning.`,
    evidence: `trend +${worst.diffS.toFixed(2).replace('.', ',')} s · ${worst.n} metingen per groep`,
  };
}

/**
 * Prestatie-daling: de laatste meting van een setup trager dan de beste
 * meting van diezelfde setup (met ≥0,3 s verschil).
 */
export function detectPerformanceDrop(
  runs: PerformanceRun[],
  setupNames: Record<UUID, string> = {},
): Insight | null {
  const groups = new Map<UUID, PerformanceRun[]>();
  for (const r of runs) {
    if (r.t0_50_s === null || r.setup_id === null) continue;
    const g = groups.get(r.setup_id) ?? [];
    g.push(r);
    groups.set(r.setup_id, g);
  }

  let worst: { gap: number; best: number; latest: PerformanceRun; count: number } | null = null;
  for (const groupRuns of groups.values()) {
    if (groupRuns.length < 2) continue;
    const best = Math.min(...groupRuns.map((r) => r.t0_50_s!));
    const latest = groupRuns.reduce((a, b) => (b.started_at.localeCompare(a.started_at) > 0 ? b : a));
    const gap = latest.t0_50_s! - best;
    if (gap > PERF_DROP_S && (!worst || gap > worst.gap)) {
      worst = { gap, best, latest, count: groupRuns.length };
    }
  }
  if (!worst) return null;

  const name = setupNames[worst.latest.setup_id!] ?? 'je actieve setup';
  return {
    kind: 'performance',
    severity: 'let op',
    title: 'Trager dan je beste meting',
    detail: `Je laatste meting met ${name} was ${worst.latest.t0_50_s!.toFixed(2).replace('.', ',')} s i.p.v. je beste ${worst.best.toFixed(2).replace('.', ',')} s. Denk aan bandenspanning, koppelingsrollen of het weer.`,
    evidence: `beste ${worst.best.toFixed(2).replace('.', ',')} s · laatste ${worst.latest.t0_50_s!.toFixed(2).replace('.', ',')} s (${worst.count} metingen met deze setup)`,
  };
}

const SEVERITY_RANK: Record<InsightSeverity, number> = { risico: 0, 'let op': 1, info: 2 };

/**
 * Fase B: AI-verwoording van de signalen.
 *
 * `fetchAiVerwoording` (services/ai-insights.ts) haalt per signaal-index een
 * verwoording op uit de Edge Function; hier verwezen we die weer terug naar de
 * deterministische signalen. Guardrails:
 * - AI-teksten overschrijven de eigen tekst alleen als ze vol, niet leeg en
 *   niet absurd lang zijn (max 220 tekens — het prompt limiet is 220).
 * - Ontbrekende of ongeldige indexen worden genegeerd: de deterministische
 *   tekst blijft de fallback ("DB-first": elk inzicht houdt zijn evidence).
 */
export interface AiVerwoordingItem {
  index: number;
  title: string;
  detail: string;
}

export const AI_DETAIL_MAX = 220;

export function applyAiVerwoording(
  insights: Insight[],
  verwoording: AiVerwoordingItem[] | null,
): Insight[] {
  if (!verwoording || verwoording.length === 0) return insights;
  return insights.map((ins, index) => {
    const ai = verwoording.find((v) => v.index === index);
    if (!ai) return ins;
    const title = ai.title.trim().slice(0, 120);
    const detail = ai.detail.trim().slice(0, AI_DETAIL_MAX);
    if (title.length < 3 || detail.length < 10) return ins; // te leeg → fallback
    return { ...ins, title, detail };
  });
}

/**
 * Fase C-push-mapping: van een waarschuwingssignaal naar een in-app
 * melding. De `weekKey` zorgt dat een aanhoudend probleem maximaal één keer
 * per week opnieuw meldt (de dedupe-index in de database filtert de rest).
 * Alleen 'let op'/'risico'-signalen worden gemeld — info-signalen staan al
 * op de Home-kaart en pushen zonder actie zou ruis zijn.
 */
export function insightToNotificationPayload(
  insight: Insight,
  weekKey: string,
): { type: NotificationType; title: string; body: string; dedupe_key: string } | null {
  if (insight.severity === 'info') return null;
  const type: NotificationType =
    insight.kind === 'onderhoud' ? 'maintenance' : insight.kind === 'verbruik' ? 'warning' : 'performance';
  return {
    type,
    title: insight.title,
    body: insight.detail,
    dedupe_key: `sig:${insight.kind}:${insight.title}:${weekKey}`,
  };
}

/** ISO-weeksleutel (`2026-W42`) voor de wekelijkse re-meldlimiet. */
export function isoWeekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - start.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Alle signalen gebundeld, urgentste eerst. */
export function buildInsights(input: {
  fuel: FuelStats | null;
  forecast: WeekForecastItem[];
  runs: PerformanceRun[];
  setupNames?: Record<UUID, string>;
}): Insight[] {
  const insights: Insight[] = [];
  const overdue = detectOverdueMaintenance(input.forecast);
  if (overdue) insights.push(overdue);
  if (input.fuel) {
    const trend = detectFuelTrend(input.fuel);
    if (trend) insights.push(trend);
  }
  const drop = detectPerformanceDrop(input.runs, input.setupNames);
  if (drop) insights.push(drop);
  const runTrend = detectRunTrend(input.runs, input.setupNames);
  if (runTrend) insights.push(runTrend);
  const comparison = detectSetupComparison(input.runs, input.setupNames);
  if (comparison) insights.push(comparison);
  return insights.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
