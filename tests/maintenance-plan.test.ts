/** Tests voor het onderhoudsplan (zuiver, geen netwerk). */
import {
  addMonthsIso,
  appliesToFuelSystem,
  buildMaintenancePlan,
  groupPlan,
  planDueLong,
  planDueShort,
  summarizePlan,
} from '../src/lib/maintenance-plan';
import type { MaintenanceItem, MaintenanceSchedule } from '../src/types';

const TODAY = new Date('2026-11-26T12:00:00.000Z');

function makeItem(partial: Partial<MaintenanceItem> & { id: string; name: string }): MaintenanceItem {
  return {
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
    ...partial,
  };
}

function makeSchedule(
  partial: Partial<MaintenanceSchedule> & { id: string; item_id: string },
): MaintenanceSchedule {
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

function planOf(schedules: MaintenanceSchedule[], items: MaintenanceItem[], currentKm = 12450) {
  return buildMaintenancePlan({
    items,
    schedules,
    currentKm,
    fuelSystem: '2T',
    today: TODAY,
  });
}

describe('appliesToFuelSystem', () => {
  const only4t = makeItem({
    id: 'i1',
    name: 'Oliefilter',
    applies_2t: false,
    applies_4t: true,
    applies_injectie: false,
  });

  it('kiest op basis van het brandstofsysteem', () => {
    expect(appliesToFuelSystem(only4t, '4T')).toBe(true);
    expect(appliesToFuelSystem(only4t, '2T')).toBe(false);
    expect(appliesToFuelSystem(only4t, 'Injectie')).toBe(false);
  });

  it('geeft zonder bekend systeem geen plan', () => {
    expect(appliesToFuelSystem(only4t, null)).toBe(false);
  });
});

describe('addMonthsIso', () => {
  it('telt maanden op', () => {
    expect(addMonthsIso('2026-11-26', 12)).toBe('2027-11-26');
    expect(addMonthsIso('2026-03-15', 24)).toBe('2028-03-15');
  });

  it('kapt af op de laatste dag van de maand', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('buildMaintenancePlan', () => {
  const bougie = makeItem({
    id: 'i1',
    name: 'Bougie',
    interval_km_min: 5000,
    interval_km_max: 12000,
    interval_months_min: 12,
    interval_months_max: 12,
  });

  it('gebruikt de echte volgende beurt na een registratie', () => {
    const schedule = makeSchedule({
      id: 's1',
      item_id: 'i1',
      interval_km: 5000,
      interval_months: 12,
      last_done_km: 10000,
      next_due_km: 15000,
    });
    const [entry] = planOf([schedule], [bougie]);

    expect(entry!.dueKm).toBe(15000);
    expect(entry!.remainingKm).toBe(2550);
    expect(entry!.status).toBe('gepland');
    expect(entry!.basis).toBe('historie');
  });

  it('rekent zonder historie vanaf de huidige stand', () => {
    const schedule = makeSchedule({ id: 's1', item_id: 'i1', interval_km: 5000 });
    const [entry] = planOf([schedule], [bougie]);

    expect(entry!.dueKm).toBe(17450);
    expect(entry!.remainingKm).toBe(5000);
    expect(entry!.basis).toBe('vanaf nu');
    expect(entry!.interval).toContain('5.000');
  });

  it('markeert een gepasseerde kilometerstand als te laat', () => {
    const schedule = makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 12000 });
    const [entry] = planOf([schedule], [bougie]);

    expect(entry!.status).toBe('te laat');
    expect(entry!.remainingKm).toBe(-450);
    expect(planDueShort(entry!)).toBe('450 km te laat');
  });

  it('zet taken binnen 1.000 km op binnenkort', () => {
    const schedule = makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 13000 });
    const [entry] = planOf([schedule], [bougie]);

    expect(entry!.status).toBe('binnenkort');
    expect(planDueShort(entry!)).toBe('nog 550 km');
  });

  it('valt terug op een maandinterval als er geen km-interval is', () => {
    const remvloeistof = makeItem({
      id: 'i2',
      name: 'Remvloeistof',
      interval_months_min: 24,
      interval_months_max: 24,
    });
    const schedule = makeSchedule({ id: 's2', item_id: 'i2', interval_months: 24 });
    const [entry] = planOf([schedule], [remvloeistof]);

    expect(entry!.dueKm).toBeNull();
    expect(entry!.dueAt).toBe('2028-11-26');
    expect(entry!.basis).toBe('vanaf nu');
    expect(entry!.status).toBe('gepland');
  });

  it('ziet een verstreken datum als te laat', () => {
    const schedule = makeSchedule({
      id: 's1',
      item_id: 'i1',
      interval_months: 12,
      next_due_at: '2026-11-01',
    });
    const [entry] = planOf([schedule], [bougie]);

    expect(entry!.status).toBe('te laat');
    expect(planDueShort(entry!)).toBe('was 1 nov 2026');
  });

  it('slaat uitgeschakelde taken, verkeerde brandstof en lege intervallen over', () => {
    const fourStrokeOnly = makeItem({
      id: 'i3',
      name: 'Oliefilter',
      applies_2t: false,
      applies_injectie: false,
    });
    const noInterval = makeItem({ id: 'i4', name: 'Framecontrole' });
    const schedules = [
      makeSchedule({ id: 's1', item_id: 'i1', interval_km: 5000, enabled: false }),
      makeSchedule({ id: 's2', item_id: 'i3', interval_km: 10000 }),
      makeSchedule({ id: 's3', item_id: 'i4' }),
    ];

    expect(planOf(schedules, [bougie, fourStrokeOnly, noInterval])).toHaveLength(0);
  });

  it('sorteert te laat, dan binnenkort, dan gepland', () => {
    const items = [
      makeItem({ id: 'a', name: 'A', interval_km_min: 1000 }),
      makeItem({ id: 'b', name: 'B', interval_km_min: 1000 }),
      makeItem({ id: 'c', name: 'C', interval_km_min: 1000 }),
    ];
    const schedules = [
      makeSchedule({ id: 'sa', item_id: 'a', next_due_km: 20000 }),
      makeSchedule({ id: 'sb', item_id: 'b', next_due_km: 11000 }),
      makeSchedule({ id: 'sc', item_id: 'c', next_due_km: 13000 }),
    ];

    const plan = planOf(schedules, items);
    expect(plan.map((entry) => entry.status)).toEqual(['te laat', 'binnenkort', 'gepland']);
  });

  it('geeft een lang label met km en stand', () => {
    const schedule = makeSchedule({ id: 's1', item_id: 'i1', next_due_km: 13000 });
    const [entry] = planOf([schedule], [bougie]);

    expect(planDueLong(entry!)).toBe('nog 550 km · bij 13.000 km');
  });
});

describe('groupPlan en summarizePlan', () => {
  const items = [
    makeItem({ id: 'a', name: 'A', interval_km_min: 1000 }),
    makeItem({ id: 'b', name: 'B', interval_km_min: 1000 }),
    makeItem({ id: 'c', name: 'C', interval_km_min: 1000 }),
  ];
  const schedules = [
    makeSchedule({ id: 'sa', item_id: 'a', next_due_km: 11000 }),
    makeSchedule({ id: 'sb', item_id: 'b', next_due_km: 13000 }),
    makeSchedule({ id: 'sc', item_id: 'c', next_due_km: 30000 }),
  ];
  const plan = planOf(schedules, items);

  it('groepeert in drie blokken op urgentie', () => {
    const groups = groupPlan(plan);
    expect(groups.map((group) => group.key)).toEqual(['nu', 'binnenkort', 'gepland']);
    expect(groups[0]!.entries).toHaveLength(1);
    expect(groups[1]!.entries).toHaveLength(1);
    expect(groups[2]!.entries).toHaveLength(1);
  });

  it('telt urgentie en pakt de eerstvolgende taak', () => {
    const summary = summarizePlan(plan);
    expect(summary.total).toBe(3);
    expect(summary.overdue).toBe(1);
    expect(summary.soon).toBe(1);
    expect(summary.next?.item.name).toBe('B');
  });

  it('geeft geen volgende taak als alles te laat is', () => {
    const overduePlan = planOf(
      [makeSchedule({ id: 'sa', item_id: 'a', next_due_km: 9000 })],
      items,
    );
    expect(summarizePlan(overduePlan).next).toBeNull();
  });
});
