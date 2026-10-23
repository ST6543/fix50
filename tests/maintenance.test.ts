/** Tests voor onderhoudslogica (buildWeekOverview) — geen netwerk nodig. */
import { buildWeekOverview } from '../src/services/maintenance';
import type { MaintenanceItem, MaintenanceSchedule } from '../src/types';

function makeItem(id: string, name: string): MaintenanceItem {
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

describe('buildWeekOverview', () => {
  const items = [makeItem('i1', 'Ketting smeren'), makeItem('i2', 'Bougie vervangen')];

  it('markeert taken die te laat zijn als overdue', () => {
    const schedules = [
      makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 1000 }),
    ];
    const result = buildWeekOverview(schedules, items, 12450);
    expect(result).toHaveLength(1);
    expect(result[0]!.overdue).toBe(true);
    expect(result[0]!.dueThisWeek).toBe(true);
  });

  it('markeert taken binnen 250 km als deze week', () => {
    const schedules = [makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 12700 })];
    const result = buildWeekOverview(schedules, items, 12450);
    expect(result[0]!.overdue).toBe(false);
    expect(result[0]!.dueThisWeek).toBe(true);
  });

  it('negeert taken ver in de toekomst', () => {
    const schedules = [makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 22000 })];
    const result = buildWeekOverview(schedules, items, 12450);
    expect(result[0]!.dueThisWeek).toBe(false);
  });

  it('tijd-taken in het verleden zijn overdue', () => {
    const past = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const schedules = [makeSchedule({ id: 's1', item_id: 'i2', next_due_at: past })];
    const result = buildWeekOverview(schedules, items, 12450);
    expect(result[0]!.overdue).toBe(true);
  });

  it('sorteert overdue bovenop deze-week', () => {
    const schedules = [
      makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 12700 }), // deze week
      makeSchedule({ id: 's2', item_id: 'i2', next_due_km: 1000 }), // te laat
    ];
    const result = buildWeekOverview(schedules, items, 12450);
    expect(result[0]!.overdue).toBe(true);
    expect(result[1]!.overdue).toBe(false);
  });

  it('slaat uitgeschakelde schedules over', () => {
    const schedules = [makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 1000, enabled: false })];
    expect(buildWeekOverview(schedules, items, 12450)).toHaveLength(0);
  });
});
