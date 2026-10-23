/** Tests voor km-schatting en week-voorspelling (zuiver, geen netwerk). */
import { dailyFromWeekly, estimateCurrentKm, kmAnchorLabel, weeklyFromDaily } from '../src/lib/km-estimate';
import { buildWeekForecast, formatWeeks } from '../src/services/maintenance';
import type { MaintenanceItem, MaintenanceSchedule } from '../src/types';

const NOW = new Date('2026-10-03T12:00:00.000Z');
const DAY = 24 * 3600 * 1000;

// Klok bevriezen op de fixture-tijd: de services lezen intern new Date(), en
// zonder freeze faalt de datum-test zodra de echte klok binnen 14 dagen van de
// fixture komt — een signalerende "tijdbom" in de suite.
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW.getTime());
});
afterAll(() => {
  jest.useRealTimers();
});

function makeItem(id: string, name = `Item ${id}`): MaintenanceItem {
  return {
    id,
    name,
    category: 'Algemeen',
    interval_km_min: null,
    interval_km_max: null,
    interval_months_min: null,
    interval_months_max: null,
    applies_2t: true,
    applies_4t: true,
    applies_injectie: true,
    description: null,
    active: true,
  };
}

function makeSchedule(partial: Partial<MaintenanceSchedule> & { id: string; item_id: string }): MaintenanceSchedule {
  return {
    scooter_id: 's1',
    interval_km: null,
    interval_months: null,
    enabled: true,
    last_done_km: null,
    last_done_at: null,
    next_due_km: null,
    next_due_at: null,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('estimateCurrentKm', () => {
  it('geeft de echte stand terug zonder avg_km_per_week', () => {
    const est = estimateCurrentKm(
      { current_km: 12450, avg_km_per_week: null, updated_at: NOW.toISOString() },
      NOW,
    );
    expect(est.estimatedKm).toBe(12450);
    expect(est.isEstimated).toBe(false);
  });

  it('extrapoleert 100 km/week over 7 dagen', () => {
    const est = estimateCurrentKm(
      { current_km: 12000, avg_km_per_week: 100, updated_at: new Date(NOW.getTime() - 7 * DAY).toISOString() },
      NOW,
    );
    expect(est.estimatedKm).toBe(12100);
    expect(est.isEstimated).toBe(true);
    expect(est.addedKm).toBe(100);
    expect(est.capped).toBe(false);
  });

  it('kapt de extrapolatie af op 26 weken', () => {
    const est = estimateCurrentKm(
      { current_km: 10000, avg_km_per_week: 200, updated_at: new Date(NOW.getTime() - 40 * 7 * DAY).toISOString() },
      NOW,
    );
    // 200 * 26 = 5200, niet 200 * 40 = 8000
    expect(est.estimatedKm).toBe(15200);
    expect(est.capped).toBe(true);
  });

  it('kapt negatieve/foute anchors af op de echte stand', () => {
    const est = estimateCurrentKm(
      { current_km: 12000, avg_km_per_week: 100, updated_at: new Date(NOW.getTime() + 3 * DAY).toISOString() },
      NOW,
    );
    // anchor in de toekomst → geen extrapolatie
    expect(est.estimatedKm).toBe(12000);
    expect(est.isEstimated).toBe(false);
  });

  it('gingert onjuiste updated_at weg', () => {
    const est = estimateCurrentKm(
      { current_km: 12000, avg_km_per_week: 100, updated_at: 'geen-datum' },
      NOW,
    );
    expect(est.estimatedKm).toBe(12000);
    expect(est.isEstimated).toBe(false);
  });
});

describe('weeklyFromDaily / dailyFromWeekly', () => {
  it('per dag ×7 naar per week', () => {
    expect(weeklyFromDaily(15)).toBe(105);
    expect(weeklyFromDaily(10.5)).toBe(73.5);
  });

  it('per week ÷7 naar per dag, 1 decimaal', () => {
    expect(dailyFromWeekly(105)).toBe(15);
    expect(dailyFromWeekly(100)).toBe(14.3);
  });

  it('rondetrip is stabiel op 1 decimaal', () => {
    const w = weeklyFromDaily(17);
    expect(dailyFromWeekly(w)).toBe(17);
  });
});

describe('kmAnchorLabel', () => {
  it('geeft null zonder dagen', () => {
    expect(kmAnchorLabel(null)).toBeNull();
  });
  it('vandaag', () => {
    expect(kmAnchorLabel(0)).toBe('vandaag bijgewerkt');
  });
  it('dagen', () => {
    expect(kmAnchorLabel(3)).toBe('3 dagen geleden bijgewerkt');
  });
  it('weken', () => {
    expect(kmAnchorLabel(21)).toBe('3 weken geleden bijgewerkt');
  });
});

describe('formatWeeks', () => {
  it('minder dan een week', () => {
    expect(formatWeeks(0.4)).toBe('minder dan een week');
  });
  it('weken', () => {
    expect(formatWeeks(2.2)).toBe('3 weken');
  });
  it('één week', () => {
    expect(formatWeeks(1)).toBe('1 week');
  });
  it('maanden', () => {
    expect(formatWeeks(6)).toContain('maand');
  });
});

describe('buildWeekForecast', () => {
  const items = [makeItem('i1', 'Variateurrollen'), makeItem('i2', 'Oliewissel'), makeItem('i3', 'Bougie')];

  it('overdue-taken komen als "nu aan de beurt"', () => {
    const result = buildWeekForecast(
      [makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 10000 })],
      items,
      12450,
      100,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.overdue).toBe(true);
    expect(result[0]!.weeksUntilDue).toBe(0);
  });

  it('rekent weken uit met km-per-week', () => {
    const result = buildWeekForecast(
      [makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 12600 })],
      items,
      12450,
      75,
    );
    expect(result[0]!.overdue).toBe(false);
    expect(result[0]!.weeksUntilDue).toBeCloseTo(2, 5);
    expect(result[0]!.dueLabel).toContain('2 weken');
  });

  it('valt terug op km-label zonder weekgemiddelde', () => {
    const result = buildWeekForecast(
      [makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 13450 })],
      items,
      12450,
      null,
    );
    expect(result[0]!.weeksUntilDue).toBeNull();
    expect(result[0]!.dueLabel).toBe('over 1.000 km');
  });

  it('datum-taken zonder km-interval worden op datum ingeschat', () => {
    const future = new Date(NOW.getTime() + 14 * DAY).toISOString().slice(0, 10);
    const result = buildWeekForecast(
      [makeSchedule({ id: 's1', item_id: 'i2', next_due_at: future })],
      items,
      12450,
      100,
    );
    expect(result[0]!.weeksUntilDue).not.toBeNull();
    expect(result[0]!.weeksUntilDue!).toBeGreaterThan(1);
    expect(result[0]!.weeksUntilDue!).toBeLessThan(3);
  });

  it('sorteert op urgentie (overdue eerst, dan weken)', () => {
    const result = buildWeekForecast(
      [
        makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 15000 }), // 25,5 week
        makeSchedule({ id: 's2', item_id: 'i2', next_due_km: 12400 }), // overdue
        makeSchedule({ id: 's3', item_id: 'i3', next_due_km: 12550 }), // 1 week
      ],
      items,
      12450,
      100,
    );
    expect(result.map((r) => r.schedule.id)).toEqual(['s2', 's3', 's1']);
  });

  it('slaat uitgeschakelde schedules over', () => {
    const result = buildWeekForecast(
      [makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 10000, enabled: false })],
      items,
      12450,
      100,
    );
    expect(result).toHaveLength(0);
  });
});
