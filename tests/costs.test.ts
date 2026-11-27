/**
 * Kosten per kilometer en per maand. Puur: alleen opgeslagen bedragen en
 * kilometerstanden, geen schattingen.
 */
import {
  MINIMUM_DISTANCE_KM,
  RELIABLE_DISTANCE_KM,
  RELIABLE_ENTRIES,
  buildCostSummary,
  formatCentsPerKm,
  formatMonthLabel,
  fuelCostCents,
} from '@/lib/costs';
import type { FuelLog, MaintenanceRecord } from '@/types';

function fuelLog(partial: Partial<FuelLog> & { id: string; odometer_km: number }): FuelLog {
  return {
    scooter_id: 's1',
    filled_at: '2026-10-01T10:00:00.000Z',
    liters: 5,
    price_per_liter_cents: null,
    total_cents: null,
    station: null,
    notes: null,
    created_at: '',
    ...partial,
  };
}

function record(partial: Partial<MaintenanceRecord> & { id: string }): MaintenanceRecord {
  return {
    scooter_id: 's1',
    item_id: null,
    custom_name: 'Oliewissel',
    done_at: '2026-10-01T10:00:00.000Z',
    km_at_service: null,
    cost_cents: null,
    parts: null,
    notes: null,
    created_at: '',
    ...partial,
  };
}

describe('fuelCostCents', () => {
  it('gebruikt het totaalbedrag, anders liters × literprijs', () => {
    expect(fuelCostCents(fuelLog({ id: 'a', odometer_km: 1000, total_cents: 1999, price_per_liter_cents: 100 }))).toBe(1999);
    expect(fuelCostCents(fuelLog({ id: 'a', odometer_km: 1000, liters: 3.5, price_per_liter_cents: 200 }))).toBe(700);
    expect(fuelCostCents(fuelLog({ id: 'a', odometer_km: 1000 }))).toBeNull();
  });
});

describe('buildCostSummary', () => {
  it('telt onderhoud en brandstof samen en rekent per kilometer', () => {
    const summary = buildCostSummary({
      records: [
        record({ id: 'r1', done_at: '2026-10-01T09:00:00.000Z', km_at_service: 10000, cost_cents: 5000 }),
        record({ id: 'r2', done_at: '2026-10-20T09:00:00.000Z', km_at_service: 11000, cost_cents: 2500 }),
      ],
      fuelLogs: [
        fuelLog({ id: 'f1', filled_at: '2026-10-05T09:00:00.000Z', odometer_km: 10300, total_cents: 1500 }),
        fuelLog({ id: 'f2', filled_at: '2026-10-25T09:00:00.000Z', odometer_km: 11300, liters: 4, price_per_liter_cents: 200 }),
      ],
    });

    expect(summary.fromKm).toBe(10000);
    expect(summary.toKm).toBe(11300);
    expect(summary.distanceKm).toBe(1300);
    expect(summary.maintenanceCents).toBe(7500);
    expect(summary.fuelCents).toBe(2300);
    expect(summary.totalCents).toBe(9800);
    expect(summary.entries).toBe(4);
    // 9800 cent over 1300 km ≈ 7,538 cent/km
    expect(summary.centsPerKm).toBeCloseTo(9800 / 1300, 6);
    expect(summary.validity.level).toBe('goed');
  });

  it('begint bij de eerste registratie met een kilometerstand, ook zonder bedrag', () => {
    const summary = buildCostSummary({
      records: [
        // Eerste registratie: alleen een stand, geen kosten.
        record({ id: 'r0', done_at: '2026-09-01T09:00:00.000Z', km_at_service: 9000 }),
        record({ id: 'r1', done_at: '2026-10-01T09:00:00.000Z', km_at_service: 9500, cost_cents: 2000 }),
      ],
      fuelLogs: [fuelLog({ id: 'f1', filled_at: '2026-10-10T09:00:00.000Z', odometer_km: 10000, total_cents: 1000 })],
    });

    expect(summary.from).toBe('2026-09-01T09:00:00.000Z');
    expect(summary.fromKm).toBe(9000);
    expect(summary.distanceKm).toBe(1000);
    expect(summary.totalCents).toBe(3000);
  });

  it('laat kosten van vóór de eerste kilometerstand buiten de meting', () => {
    const summary = buildCostSummary({
      records: [
        record({ id: 'oud', done_at: '2026-08-01T09:00:00.000Z', cost_cents: 4000 }),
        record({ id: 'start', done_at: '2026-09-01T09:00:00.000Z', km_at_service: 9000 }),
        record({ id: 'nieuw', done_at: '2026-10-01T09:00:00.000Z', km_at_service: 9900, cost_cents: 1000 }),
      ],
    });

    expect(summary.totalCents).toBe(1000);
    expect(summary.distanceKm).toBe(900);
    expect(summary.validity.notes.join(' ')).toContain('vóór de eerste kilometerstand');
  });

  it('telt kosten zonder kilometerstand mee in het totaal, niet in de afstand', () => {
    const summary = buildCostSummary({
      records: [
        record({ id: 'r1', done_at: '2026-09-01T09:00:00.000Z', km_at_service: 9000 }),
        record({ id: 'r2', done_at: '2026-09-15T09:00:00.000Z', cost_cents: 3000 }),
        record({ id: 'r3', done_at: '2026-10-01T09:00:00.000Z', km_at_service: 9600, cost_cents: 1200 }),
      ],
    });

    expect(summary.totalCents).toBe(4200);
    expect(summary.distanceKm).toBe(600);
    expect(summary.validity.level).toBe('indicatief');
    expect(summary.validity.notes.join(' ')).toContain('niet in de afstand');
  });

  it('maakt een maandoverzicht, nieuwste maand eerst', () => {
    const summary = buildCostSummary({
      records: [
        record({ id: 'r1', done_at: '2026-09-10T09:00:00.000Z', km_at_service: 9000, cost_cents: 1000 }),
        record({ id: 'r2', done_at: '2026-10-10T09:00:00.000Z', km_at_service: 10000, cost_cents: 2000 }),
      ],
      fuelLogs: [
        fuelLog({ id: 'f1', filled_at: '2026-10-20T09:00:00.000Z', odometer_km: 10600, total_cents: 900 }),
      ],
    });

    expect(summary.months.map((m) => m.month)).toEqual(['2026-10', '2026-09']);
    const october = summary.months[0]!;
    expect(october.label).toBe('oktober 2026');
    expect(october.maintenanceCents).toBe(2000);
    expect(october.fuelCents).toBe(900);
    expect(october.totalCents).toBe(2900);
    expect(october.entries).toBe(2);
    // Stand 10.000 → 10.600 binnen oktober.
    expect(october.km).toBe(600);
    expect(summary.months[1]!.km).toBeNull();
  });

  it('zegt eerlijk dat er nog te weinig afstand is', () => {
    const summary = buildCostSummary({
      records: [
        record({ id: 'r1', done_at: '2026-10-01T09:00:00.000Z', km_at_service: 10000, cost_cents: 1500 }),
        record({ id: 'r2', done_at: '2026-10-02T09:00:00.000Z', km_at_service: 10020, cost_cents: 500 }),
      ],
    });

    expect(summary.distanceKm).toBe(20);
    expect(summary.validity.level).toBe('onvoldoende');
    expect(summary.validity.label).toContain('20 km');
  });

  it('geeft geen bedrag per kilometer zonder twee standen', () => {
    const summary = buildCostSummary({
      records: [record({ id: 'r1', done_at: '2026-10-01T09:00:00.000Z', cost_cents: 1500 })],
    });

    expect(summary.totalCents).toBe(1500);
    expect(summary.distanceKm).toBeNull();
    expect(summary.centsPerKm).toBeNull();
    expect(summary.validity.level).toBe('onvoldoende');
    expect(summary.validity.label).toContain('twee kilometerstanden');
  });

  it('meldt dat er nog geen kosten zijn', () => {
    const summary = buildCostSummary({
      records: [record({ id: 'r1', done_at: '2026-10-01T09:00:00.000Z', km_at_service: 10000 })],
    });

    expect(summary.totalCents).toBe(0);
    expect(summary.months).toEqual([]);
    expect(summary.validity.label).toBe('Nog geen kosten met een bedrag geregistreerd.');
  });

  it('negeert ongeldige datums', () => {
    const summary = buildCostSummary({
      records: [
        record({ id: 'kapot', done_at: 'geen-datum', km_at_service: 1000, cost_cents: 9999 }),
        record({ id: 'goed', done_at: '2026-10-01T09:00:00.000Z', km_at_service: 5000, cost_cents: 100 }),
      ],
    });

    expect(summary.totalCents).toBe(100);
    expect(summary.fromKm).toBe(5000);
  });

  it('houdt de drempels voor een betrouwbare meting aan', () => {
    expect(RELIABLE_DISTANCE_KM).toBe(300);
    expect(MINIMUM_DISTANCE_KM).toBe(50);
    expect(RELIABLE_ENTRIES).toBe(3);
  });
});

describe('formatCentsPerKm / formatMonthLabel', () => {
  it('Nederlandse notatie', () => {
    expect(formatCentsPerKm(12)).toBe('€0,12/km');
    expect(formatCentsPerKm(7.538)).toBe('€0,08/km');
    expect(formatMonthLabel('2026-11')).toBe('november 2026');
    expect(formatMonthLabel('2026-01')).toBe('januari 2026');
    expect(formatMonthLabel('onbekend')).toBe('onbekend');
  });
});
