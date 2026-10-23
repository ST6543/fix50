/** Tests voor de slimme signalen-module (fase A AI-plan). */
import {
  buildInsights,
  detectFuelTrend,
  detectOverdueMaintenance,
  detectPerformanceDrop,
  detectSetupComparison,
} from '../src/lib/insights';
import { computeFuelStats } from '../src/services/fuel';
import type { WeekForecastItem } from '../src/services/maintenance';
import type { FuelLog, PerformanceRun } from '../src/types';

function makeFuelLog(partial: Partial<FuelLog> & { id: string; odometer_km: number; liters: number; filled_at: string }): FuelLog {
  return {
    scooter_id: 's1',
    price_per_liter_cents: null,
    total_cents: null,
    station: null,
    notes: null,
    created_at: '',
    ...partial,
  };
}

function makeRun(partial: Partial<PerformanceRun> & { id: string; setup_id: string | null; started_at: string; t0_50_s: number | null }): PerformanceRun {
  return {
    scooter_id: 's1',
    ended_at: null,
    duration_s: null,
    distance_m: 400,
    max_speed_kmh: 62,
    avg_speed_kmh: null,
    t0_80_s: null,
    t50_80_s: null,
    gps_quality: 'goed',
    points: [],
    notes: null,
    created_at: '',
    ...partial,
  };
}

function makeForecastItem(partial: Partial<WeekForecastItem> & { id: string; name: string; overdue: boolean }): WeekForecastItem {
  const schedule = { id: partial.id, scooter_id: 's1', item_id: 'i1', interval_km: 3000, interval_months: 12, enabled: true, last_done_km: null, last_done_at: null, next_due_km: null, next_due_at: null, created_at: '', updated_at: '' };
  const item = { id: 'i1', name: partial.name, category: '', interval_km_min: null, interval_km_max: null, interval_months_min: null, interval_months_max: null, applies_2t: true, applies_4t: true, applies_injectie: true, description: null, active: true };
  return { schedule, item, weeksUntilDue: null, dueLabel: 'nu aan de beurt', ...partial };
}

describe('detectFuelTrend', () => {
  it('waarschuwt pas na 2 opeenvolgende onzuiniger beurten', () => {
    // Historisch 1 op 50; twee beurten 1 op ~33 → 33% slechter, 2× bevestigd.
    const logs = [
      makeFuelLog({ id: 'a', filled_at: '2026-07-01T10:00:00.000Z', odometer_km: 10000, liters: 10 }),
      makeFuelLog({ id: 'b', filled_at: '2026-08-01T10:00:00.000Z', odometer_km: 10500, liters: 10 }),
      makeFuelLog({ id: 'c', filled_at: '2026-09-01T10:00:00.000Z', odometer_km: 11040, liters: 16 }),
      makeFuelLog({ id: 'd', filled_at: '2026-10-01T10:00:00.000Z', odometer_km: 11580, liters: 16 }),
    ];
    const insight = detectFuelTrend(computeFuelStats(logs));
    expect(insight).not.toBeNull();
    expect(insight!.severity).toBe('let op');
    expect(insight!.kind).toBe('verbruik');
    expect(insight!.title).toBe('Verbruik verslechterd');
    expect(insight!.detail).toContain('2 beurten op rij');
    expect(insight!.evidence).toContain('gemiddeld 1 op');
  });

  it('zwijgt bij één enkele afwijkende beurt (ruis/winter)', () => {
    const logs = [
      makeFuelLog({ id: 'a', filled_at: '2026-08-01T10:00:00.000Z', odometer_km: 10000, liters: 10 }),
      makeFuelLog({ id: 'b', filled_at: '2026-09-01T10:00:00.000Z', odometer_km: 10500, liters: 10 }),
      // 540 km op 16 L = 1 op 33,75 → 33% slechter, maar maar 1×
      makeFuelLog({ id: 'c', filled_at: '2026-10-01T10:00:00.000Z', odometer_km: 11040, liters: 16 }),
    ];
    expect(detectFuelTrend(computeFuelStats(logs))).toBeNull();
  });

  it('geeft een positief signaal bij >15% zuiniger rijden (1 beurt volstaat)', () => {
    const logs = [
      makeFuelLog({ id: 'a', filled_at: '2026-07-01T10:00:00.000Z', odometer_km: 10000, liters: 10 }),
      makeFuelLog({ id: 'b', filled_at: '2026-08-01T10:00:00.000Z', odometer_km: 10500, liters: 10 }),
      makeFuelLog({ id: 'c', filled_at: '2026-09-01T10:00:00.000Z', odometer_km: 11000, liters: 10 }),
      // 500 km op 7,5 L = 1 op 66,7 → 33% zuiniger dan de baseline 1 op 50
      makeFuelLog({ id: 'd', filled_at: '2026-10-01T10:00:00.000Z', odometer_km: 11500, liters: 7.5 }),
    ];
    const insight = detectFuelTrend(computeFuelStats(logs));
    expect(insight?.severity).toBe('info');
    expect(insight?.title).toBe('Verbruik verbeterd');
  });

  it('corrigeert voor winter: januari-afwijking tot 12% is geen signaal', () => {
    // Gemiddeld 1 op 50. Januari-beurt: 1 op ~41 (18% slechter) — zonder correctie
    // een waarschuwing, met de 12%-wintercorrectie 1,18/1,12 ≈ 5% → binnen marge.
    // Twee beurten zodat de bevestigingsregel harde data heeft.
    const logs = [
      makeFuelLog({ id: 'a', filled_at: '2026-11-01T10:00:00.000Z', odometer_km: 10000, liters: 10 }),
      makeFuelLog({ id: 'b', filled_at: '2026-12-01T10:00:00.000Z', odometer_km: 10500, liters: 10 }),
      makeFuelLog({ id: 'c', filled_at: '2026-01-05T10:00:00.000Z', odometer_km: 11040, liters: 13.5 }),
      makeFuelLog({ id: 'd', filled_at: '2026-01-20T10:00:00.000Z', odometer_km: 11560, liters: 13.7 }),
    ];
    expect(detectFuelTrend(computeFuelStats(logs))).toBeNull();
  });

  it('zwijgt bij stabiel verbruik of te korte afstanden', () => {
    const stable = [
      makeFuelLog({ id: 'a', filled_at: '2026-08-01T10:00:00.000Z', odometer_km: 10000, liters: 10 }),
      makeFuelLog({ id: 'b', filled_at: '2026-09-01T10:00:00.000Z', odometer_km: 10500, liters: 10 }),
      makeFuelLog({ id: 'c', filled_at: '2026-10-01T10:00:00.000Z', odometer_km: 11000, liters: 10 }),
    ];
    expect(detectFuelTrend(computeFuelStats(stable))).toBeNull();

    // Laatste tussenruimte van maar 10 km (< MIN_FUEL_DISTANCE_KM) → niet bruikbaar
    const shortGap = [
      makeFuelLog({ id: 'a', filled_at: '2026-08-01T10:00:00.000Z', odometer_km: 10000, liters: 10 }),
      makeFuelLog({ id: 'b', filled_at: '2026-09-01T10:00:00.000Z', odometer_km: 10500, liters: 10 }),
      makeFuelLog({ id: 'c', filled_at: '2026-10-01T10:00:00.000Z', odometer_km: 10510, liters: 12 }),
    ];
    expect(detectFuelTrend(computeFuelStats(shortGap))).toBeNull();
  });
});

describe('detectOverdueMaintenance', () => {
  it('geeft een risico-signaal bij te laat onderhoud', () => {
    const items = [
      makeForecastItem({ id: '1', name: 'Oliewissel', overdue: true }),
      makeForecastItem({ id: '2', name: 'V-snaar check', overdue: true }),
      makeForecastItem({ id: '3', name: 'Bougie', overdue: false }),
    ];
    const insight = detectOverdueMaintenance(items);
    expect(insight?.severity).toBe('risico');
    expect(insight?.title).toBe('2 onderhoudstaken te laat');
    expect(insight!.detail).toContain('Oliewissel');
    expect(insight!.detail).toContain('V-snaar check');
    expect(insight!.detail).not.toContain('meer');
  });

  it('vat de rest samen als er meer dan twee taken te laat zijn', () => {
    const items = [
      makeForecastItem({ id: '1', name: 'Oliewissel', overdue: true }),
      makeForecastItem({ id: '2', name: 'V-snaar check', overdue: true }),
      makeForecastItem({ id: '3', name: 'Remvloeistof', overdue: true }),
    ];
    const insight = detectOverdueMaintenance(items);
    expect(insight?.title).toBe('3 onderhoudstaken te laat');
    expect(insight!.detail).toContain('Oliewissel, V-snaar check en 1 meer taak');
  });

  it('zwijgt als alles op schema ligt', () => {
    expect(detectOverdueMaintenance([makeForecastItem({ id: '1', name: 'Bougie', overdue: false })])).toBeNull();
    expect(detectOverdueMaintenance([])).toBeNull();
  });
});

describe('detectSetupComparison', () => {
  it('vergelijkt setups met genoeg metingen en ≥15% verschil', () => {
    const runs = [
      makeRun({ id: '1', setup_id: 'orig', started_at: '2026-09-01T10:00:00.000Z', t0_50_s: 6.0 }),
      makeRun({ id: '2', setup_id: 'orig', started_at: '2026-09-02T10:00:00.000Z', t0_50_s: 6.2 }),
      makeRun({ id: '3', setup_id: 'sport', started_at: '2026-10-01T10:00:00.000Z', t0_50_s: 4.9 }),
      makeRun({ id: '4', setup_id: 'sport', started_at: '2026-10-02T10:00:00.000Z', t0_50_s: 5.1 }),
    ];
    const insight = detectSetupComparison(runs, { orig: 'Origineel', sport: 'Sport 70cc' });
    expect(insight?.severity).toBe('info');
    expect(insight!.title).toBe('Sneller met Sport 70cc');
    expect(insight!.detail).toContain('18%'); // (6,1 − 5,0) / 6,1 ≈ 18%
    expect(insight!.evidence).toContain('Origineel');
  });

  it('vereist 2 setups met elk ≥2 metingen', () => {
    const thin = [
      makeRun({ id: '1', setup_id: 'orig', started_at: '2026-09-01T10:00:00.000Z', t0_50_s: 6.0 }),
      makeRun({ id: '2', setup_id: 'sport', started_at: '2026-10-01T10:00:00.000Z', t0_50_s: 4.9 }),
    ];
    expect(detectSetupComparison(thin, { orig: 'Origineel', sport: 'Sport' })).toBeNull();
    expect(detectSetupComparison([], {})).toBeNull();
  });
});

describe('detectPerformanceDrop', () => {
  it('signaleert een duidelijk tragere laatste meting', () => {
    const runs = [
      makeRun({ id: '1', setup_id: 'sport', started_at: '2026-09-01T10:00:00.000Z', t0_50_s: 5.4 }),
      makeRun({ id: '2', setup_id: 'sport', started_at: '2026-10-01T10:00:00.000Z', t0_50_s: 6.2 }),
    ];
    const insight = detectPerformanceDrop(runs, { sport: 'Sport' });
    expect(insight?.severity).toBe('let op');
    expect(insight!.detail).toContain('6,20');
    expect(insight!.evidence).toContain('beste 5,40');
  });

  it('zwijgt als de laatste meting de beste is', () => {
    const runs = [
      makeRun({ id: '1', setup_id: 'sport', started_at: '2026-09-01T10:00:00.000Z', t0_50_s: 6.2 }),
      makeRun({ id: '2', setup_id: 'sport', started_at: '2026-10-01T10:00:00.000Z', t0_50_s: 5.4 }),
    ];
    expect(detectPerformanceDrop(runs)).toBeNull();
  });
});

describe('buildInsights', () => {
  it('sorteert risico boven let op boven info', () => {
    const forecast = [makeForecastItem({ id: '1', name: 'Oliewissel', overdue: true })];
    const runs = [
      makeRun({ id: '1', setup_id: 'a', started_at: '2026-09-01T10:00:00.000Z', t0_50_s: 6.0 }),
      makeRun({ id: '2', setup_id: 'a', started_at: '2026-10-01T10:00:00.000Z', t0_50_s: 7.0 }),
    ];
    const insights = buildInsights({ fuel: null, forecast, runs });
    expect(insights.map((i) => i.severity)).toEqual(['risico', 'let op']);
  });

  it('geeft een lege lijst zonder data', () => {
    expect(buildInsights({ fuel: null, forecast: [], runs: [] })).toEqual([]);
  });
});
