/**
 * Onderhoudsbaseline bij onboarding: de laatste beurt vult de eerste planning,
 * zodat een nieuwe gebruiker meteen echte vervalstanden en vervaldatums ziet.
 */
import { baselineDueFields } from '@/lib/maintenance-baseline';
import { addMonthsIso, buildMaintenancePlan } from '@/lib/maintenance-plan';
import type { MaintenanceItem, MaintenanceSchedule } from '@/types';

const item: MaintenanceItem = {
  id: 'item-1',
  name: 'Bougie vervangen',
  category: 'ontsteking',
  interval_km_min: 6000,
  interval_km_max: 8000,
  interval_months_min: 12,
  interval_months_max: 12,
  applies_2t: true,
  applies_4t: true,
  applies_injectie: true,
  description: null,
  active: true,
};

function scheduleFrom(due: ReturnType<typeof baselineDueFields>): MaintenanceSchedule {
  return {
    id: 'schedule-1',
    scooter_id: 'scooter-1',
    item_id: item.id,
    interval_km: 6000,
    interval_months: 12,
    enabled: true,
    ...due,
    created_at: '',
    updated_at: '',
  };
}

describe('baselineDueFields', () => {
  it('rekent de volgende stand en datum vanaf de laatste beurt', () => {
    const due = baselineDueFields({
      baseline: { km: 12000, doneAtIso: '2026-03-10' },
      intervalKm: 6000,
      intervalMonths: 12,
    });

    expect(due.last_done_km).toBe(12000);
    expect(due.last_done_at).toBe('2026-03-10T12:00:00.000Z');
    expect(due.next_due_km).toBe(18000);
    expect(due.next_due_at).toBe('2027-03-10');
  });

  it('laat datumvelden leeg als alleen de stand bekend is', () => {
    const due = baselineDueFields({
      baseline: { km: 12000, doneAtIso: null },
      intervalKm: 6000,
      intervalMonths: 12,
    });

    expect(due.next_due_km).toBe(18000);
    expect(due.last_done_at).toBeNull();
    expect(due.next_due_at).toBeNull();
  });

  it('laat km-velden leeg als alleen de datum bekend is', () => {
    const due = baselineDueFields({
      baseline: { km: null, doneAtIso: '2026-03-10' },
      intervalKm: 6000,
      intervalMonths: 12,
    });

    expect(due.last_done_km).toBeNull();
    expect(due.next_due_km).toBeNull();
    expect(due.next_due_at).toBe('2027-03-10');
  });

  it('geeft geen enkel veld zonder baseline of zonder interval', () => {
    const none = { last_done_km: null, last_done_at: null, next_due_km: null, next_due_at: null };

    expect(baselineDueFields({ baseline: null, intervalKm: 6000, intervalMonths: 12 })).toEqual(none);
    expect(
      baselineDueFields({
        baseline: { km: 12000, doneAtIso: '2026-03-10' },
        intervalKm: null,
        intervalMonths: null,
      }),
    ).toEqual({ ...none, last_done_km: 12000, last_done_at: '2026-03-10T12:00:00.000Z' });
  });

  it('negeert een ongeldige stand of datum', () => {
    const due = baselineDueFields({
      baseline: { km: -5, doneAtIso: '10-03-2026' },
      intervalKm: 6000,
      intervalMonths: 12,
    });

    expect(due).toEqual({ last_done_km: null, last_done_at: null, next_due_km: null, next_due_at: null });
  });
});

describe('eerste planning met baseline', () => {
  const today = new Date('2026-11-26T12:00:00.000Z');

  it('toont echte vervalstand en vervaldatum na een bekende beurt', () => {
    const plan = buildMaintenancePlan({
      items: [item],
      schedules: [
        scheduleFrom(
          baselineDueFields({
            baseline: { km: 12000, doneAtIso: '2026-03-10' },
            intervalKm: 6000,
            intervalMonths: 12,
          }),
        ),
      ],
      currentKm: 12450,
      fuelSystem: '2T',
      today,
    });

    expect(plan).toHaveLength(1);
    expect(plan[0]!.dueKm).toBe(18000);
    expect(plan[0]!.dueAt).toBe('2027-03-10');
    expect(plan[0]!.basis).toBe('historie');
    expect(plan[0]!.status).toBe('gepland');
    expect(plan[0]!.remainingKm).toBe(5550);
  });

  it('rekent bij "net gekocht" eerlijk vanaf de huidige stand en vandaag', () => {
    const plan = buildMaintenancePlan({
      items: [item],
      schedules: [scheduleFrom(baselineDueFields({ baseline: null, intervalKm: 6000, intervalMonths: 12 }))],
      currentKm: 12450,
      fuelSystem: '2T',
      today,
    });

    expect(plan[0]!.dueKm).toBe(18450);
    expect(plan[0]!.dueAt).toBe(addMonthsIso('2026-11-26', 12));
    expect(plan[0]!.basis).toBe('vanaf nu');
  });
});
