/**
 * Server-side port van kernsignalen uit src/lib/insights.ts (pure functies, fase A+C).
 *
 * De nacht-cron herrekent de diagnosevriendelijke signalen zonder dat de app
 * open staat en maakt notificaties met exact dezelfde titles/dedupe-keys als
 * de client-push (`sig:<kind>:<title>:<week>`), zodat beide lagen elkaar
 * nooit dubbel melden. Drempelwaarden zijn kopieën van de client-constanten
 * (docs/AI-SLIMMER-PLAN.md): bij het wijzigen van de client eerst dit bestand
 * meebewegen.
 */

export interface SignalRow {
  kind: 'verbruik' | 'performance' | 'tuning';
  severity: 'let op' | 'risico';
  title: string;
  detail: string;
}

export interface FuelPoint {
  odometer_km: number;
  liters: number;
  filled_at: string;
}

export interface RunPoint {
  setup_id: string | null;
  t0_50_s: number | null;
  started_at: string;
}

const MIN_FUEL_DISTANCE_KM = 30;
const FUEL_WORSE_RATIO = 0.85;
const FUEL_CONFIRM_COUNT = 2;
const WINTER_FUEL_BONUS = 0.12;
const PERF_DROP_S = 0.3;
const RUN_TREND_COUNT = 3;
const RUN_TREND_DIFF_S = 0.25;

function winterCorrection(filledAtIso: string): number {
  const month = Number(filledAtIso.slice(5, 7));
  return month === 12 || month === 1 || month === 2 ? 1 + WINTER_FUEL_BONUS : 1;
}

/**
 * Verbruikstrend: laatste FUEL_CONFIRM_COUNT beurten (met ≥30 km tussenafstand)
 * minstens 15% onzuiniger dan een afstandsgebalanceerde baseline van oudere
 * beurten. Zelfde reken-procestoer als detectFuelTrend in de app.
 */
export function detectFuelTrendServer(logs: FuelPoint[]): SignalRow | null {
  const sorted = [...logs]
    .sort((a, b) => a.filled_at.localeCompare(b.filled_at))
    .filter((p, i, arr) => i === 0 || p.odometer_km > arr[i - 1].odometer_km)
    .map((p, i, arr) => {
      const distanceKm = i === 0 ? 0 : p.odometer_km - arr[i - 1].odometer_km;
      return { distanceKm, liters: p.liters, filledAtIso: p.filled_at };
    })
    .filter((p) => p.distanceKm >= MIN_FUEL_DISTANCE_KM && p.liters > 0)
    .map((p) => ({ ...p, kmPerLiter: p.distanceKm / p.liters }));

  if (sorted.length < FUEL_CONFIRM_COUNT + 1) return null;

  const recent = sorted.slice(-FUEL_CONFIRM_COUNT);
  const baseline = sorted.slice(0, -FUEL_CONFIRM_COUNT);
  if (baseline.length === 0) return null;

  const baseKm = baseline.reduce((s, p) => s + p.distanceKm, 0);
  const baseLiters = baseline.reduce((s, p) => s + (p.distanceKm / p.kmPerLiter), 0);
  if (baseKm <= 0 || baseLiters <= 0) return null;
  const baselineKmPerLiter = baseKm / baseLiters;

  const ratioOf = (p: (typeof sorted)[number]) =>
    (p.kmPerLiter / baselineKmPerLiter) * winterCorrection(p.filledAtIso);
  const allWorse = recent.every((p) => ratioOf(p) < FUEL_WORSE_RATIO);
  if (!allWorse) return null;

  const latest = recent[recent.length - 1];
  const dropPct = Math.round((1 - ratioOf(latest)) * 100);
  return {
    kind: 'verbruik',
    severity: 'let op',
    title: 'Verbruik verslechterd',
    detail: `Je rijdt nu 1 op ${latest.kmPerLiter.toFixed(1).replace('.', ',')} i.p.v. eerder gemiddeld 1 op ${baselineKmPerLiter.toFixed(1).replace('.', ',')} (${dropPct}% onzuiniger, ${FUEL_CONFIRM_COUNT} beurten op rij). Vaak voorkomende oorzaken: verstopt luchtfilter, versleten bougie of een gewijzigde sproeierinstelling.`,
  };
}

/**
 * Prestatie-daling: laatste meting van een setup trager dan de beste van die
 * setup (≥0,3 s), net als detectPerformanceDrop in de app.
 */
export function detectPerformanceDropServer(runs: RunPoint[]): SignalRow | null {
  const groups = new Map<string, RunPoint[]>();
  for (const r of runs) {
    if (r.t0_50_s === null || r.t0_50_s === undefined) continue;
    const key = r.setup_id ?? 'geen';
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  let worst: { gap: number } | null = null;
  for (const groupRuns of groups.values()) {
    if (groupRuns.length < 2) continue;
    const best = Math.min(...groupRuns.map((r) => r.t0_50_s!));
    const latest = groupRuns.reduce((a, b) => (b.started_at.localeCompare(a.started_at) > 0 ? b : a));
    const gap = latest.t0_50_s! - best;
    if (gap > PERF_DROP_S && (!worst || gap > worst.gap)) worst = { gap };
  }
  if (!worst) return null;

  return {
    kind: 'performance',
    severity: 'let op',
    title: 'Trager dan je beste meting',
    detail: `Je laatste timing was ${worst.gap.toFixed(2).replace('.', ',')} s langzamer dan je beste meting van deze setup. Denk aan bandenspanning, koppelingsrollen of het weer.`,
  };
}

/**
 * Meet-trend: gemiddelde van de laatste 3 metingen vs 3 oudere per setup,
 * ≥0,25 s verschil — dezelfde aanhoudende-verslechtering-regel als fase C.
 */
export function detectRunTrendServer(runs: RunPoint[]): SignalRow | null {
  const groups = new Map<string, RunPoint[]>();
  for (const r of runs) {
    if (r.t0_50_s === null || r.t0_50_s === undefined) continue;
    const key = r.setup_id ?? 'geen';
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  let worstDiff: number | null = null;
  let worstN = RUN_TREND_COUNT;
  for (const groupRuns of groups.values()) {
    if (groupRuns.length < RUN_TREND_COUNT * 2) continue;
    const ordered = [...groupRuns].sort((a, b) => a.started_at.localeCompare(b.started_at));
    const n = RUN_TREND_COUNT;
    const avgOf = (rs: RunPoint[]) =>
      rs.reduce((s, r) => s + (r.t0_50_s ?? 0), 0) / rs.length;
    const diff = avgOf(ordered.slice(-n)) - avgOf(ordered.slice(0, n));
    if (diff > RUN_TREND_DIFF_S && (worstDiff === null || diff > worstDiff)) {
      worstDiff = diff;
      worstN = n;
    }
  }
  if (worstDiff === null) return null;

  return {
    kind: 'performance',
    severity: 'let op',
    title: 'Metingen worden consistently trager',
    detail: `Gemiddeld over de laatste ${worstN} metingen rij je ${worstDiff.toFixed(2).replace('.', ',')} s trager dan eerder. Dat is een trend, geen losse uitglier — vaak voorkomende oorzaak: versleten koppelingsrollen of bandenspanning.`,
  };
}

/** ISO-weeksleutel, 1-op-1 met isoWeekKey() in de client. */
export function isoWeekKeyServer(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - start.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
