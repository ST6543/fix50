/**
 * Tuning-voortgang: ontwikkeling van topsnelheid en acceleratie over setups en
 * testritten heen. Alleen echte GPS-metingen; nooit voorspellingen als meting.
 */

export interface RunSlice {
  id: string;
  started_at: string;
  max_speed_kmh: number | null;
  t0_50_s: number | null;
  setup_id: string | null;
  gps_quality: 'goed' | 'matig' | 'slecht';
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface SetupProgress {
  setupId: string;
  name: string;
  runs: number;
  bestTop: number | null;
  avgTop: number | null;
  bestT0_50: number | null;
}

function usable(runs: RunSlice[]): RunSlice[] {
  return runs.filter((r) => r.gps_quality !== 'slecht');
}

function chronological(runs: RunSlice[]): RunSlice[] {
  return [...runs].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/** Topsnelheid per rit, chronologisch. */
export function speedTrend(runs: RunSlice[]): TrendPoint[] {
  return chronological(usable(runs))
    .filter((r) => r.max_speed_kmh !== null)
    .map((r) => ({ label: shortDate(r.started_at), value: r.max_speed_kmh as number }));
}

/** 0–50 tijd per rit, chronologisch (lager is beter). */
export function accelTrend(runs: RunSlice[]): TrendPoint[] {
  return chronological(usable(runs))
    .filter((r) => r.t0_50_s !== null)
    .map((r) => ({ label: shortDate(r.started_at), value: r.t0_50_s as number }));
}

/** Beste (hoogste) gemeten topsnelheid. */
export function bestTopSpeed(runs: RunSlice[]): number | null {
  const values = usable(runs)
    .map((r) => r.max_speed_kmh)
    .filter((v): v is number => v !== null);
  return values.length === 0 ? null : Math.max(...values);
}

/** Beste (laagste) 0–50 tijd. */
export function bestT0_50(runs: RunSlice[]): number | null {
  const values = usable(runs)
    .map((r) => r.t0_50_s)
    .filter((v): v is number => v !== null);
  return values.length === 0 ? null : Math.min(...values);
}

/**
 * Per opstelling de gemeten resultaten. Opstellingen zonder runs blijven staan
 * (met nulls), zodat je ziet welke setup nog getest moet worden.
 */
export function setupProgress(setups: { id: string; name: string }[], runs: RunSlice[]): SetupProgress[] {
  const clean = usable(runs);
  return setups.map((s) => {
    const list = clean.filter((r) => r.setup_id === s.id);
    const tops = list.map((r) => r.max_speed_kmh).filter((v): v is number => v !== null);
    const accels = list.map((r) => r.t0_50_s).filter((v): v is number => v !== null);
    return {
      setupId: s.id,
      name: s.name,
      runs: list.length,
      bestTop: tops.length === 0 ? null : Math.max(...tops),
      avgTop: tops.length === 0 ? null : Number((tops.reduce((a, b) => a + b, 0) / tops.length).toFixed(1)),
      bestT0_50: accels.length === 0 ? null : Math.min(...accels),
    };
  });
}

/** Verschil tussen de eerste en laatste meting van een reeks (positief = gestegen). */
export function development(points: TrendPoint[]): number | null {
  if (points.length < 2) return null;
  return Number((points[points.length - 1]!.value - points[0]!.value).toFixed(1));
}
