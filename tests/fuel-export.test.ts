/** Tests voor tankbeurt-verbruik, kosten-omrekening en CSV-export (zuiver). */
import { computeFuelStats, formatCents, formatKmPerLiter, formatLPer100km } from '../src/services/fuel';
import { buildFuelCsv, buildMaintenanceCsv, buildMaintenanceSummary } from '../src/lib/export';
import { eurosToCents } from '../src/lib/validation';
import type { FuelLog, MaintenanceRecord } from '../src/types';

function makeFuelLog(partial: Partial<FuelLog> & { id: string; odometer_km: number; liters: number }): FuelLog {
  return {
    scooter_id: 's1',
    filled_at: '2026-10-01T10:00:00.000Z',
    price_per_liter_cents: null,
    total_cents: null,
    station: null,
    notes: null,
    created_at: '',
    ...partial,
  };
}

function makeRecord(partial: Partial<MaintenanceRecord> & { id: string }): MaintenanceRecord {
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

describe('computeFuelStats', () => {
  it('berekenent L/100km tussen opeenvolgende beurten', () => {
    const logs = [
      makeFuelLog({ id: 'a', odometer_km: 10000, liters: 5 }),
      makeFuelLog({ id: 'b', odometer_km: 10500, liters: 3.5 }),
    ];
    const stats = computeFuelStats(logs);
    expect(stats.points).toHaveLength(1);
    expect(stats.points[0]!.distanceKm).toBe(500);
    // 3,5 L over 500 km = 0,7 L/100km
    expect(stats.points[0]!.lPer100km).toBeCloseTo(0.7, 5);
    // 0,7 L/100km = 1 op ~142,9 (km per liter)
    expect(stats.points[0]!.kmPerLiter).toBeCloseTo(100 / 0.7, 5);
    // gewogen gemiddeld = zelfde waarde bij één punt
    expect(stats.avgLPer100km).toBeCloseTo(0.7, 5);
    expect(stats.avgKmPerLiter).toBeCloseTo(100 / 0.7, 5);
    expect(stats.totalLiters).toBe(8.5);
    expect(stats.count).toBe(2);
  });

  it('slaagt de eerste beurt over (geen beginstand) en sorteert correct', () => {
    const logs = [
      makeFuelLog({ id: 'late', odometer_km: 11000, liters: 4 }),
      makeFuelLog({ id: 'early', odometer_km: 10000, liters: 6, filled_at: '2026-09-20T10:00:00.000Z' }),
    ];
    const stats = computeFuelStats(logs);
    expect(stats.points).toHaveLength(1);
    expect(stats.points[0]!.distanceKm).toBe(1000);
    expect(stats.points[0]!.lPer100km).toBeCloseTo(0.4, 5);
  });

  it('negeert beurten met dezelfde of lagere stand (typfout)', () => {
    const logs = [
      makeFuelLog({ id: 'a', odometer_km: 10000, liters: 5 }),
      makeFuelLog({ id: 'dup', odometer_km: 10000, liters: 9 }),
      makeFuelLog({ id: 'back', odometer_km: 9900, liters: 2 }),
      makeFuelLog({ id: 'b', odometer_km: 10500, liters: 3.5 }),
    ];
    const stats = computeFuelStats(logs);
    expect(stats.points).toHaveLength(1);
    expect(stats.points[0]!.lPer100km).toBeCloseTo(0.7, 5);
  });

  it('telt kosten via total_cents of prijs per liter', () => {
    const logs = [
      makeFuelLog({ id: 'a', odometer_km: 10000, liters: 5, total_cents: 1100 }),
      makeFuelLog({ id: 'b', odometer_km: 10500, liters: 3.5, price_per_liter_cents: 200 }),
    ];
    const stats = computeFuelStats(logs);
    // 1100 + 3,5×200 = 1100 + 700 = 1800
    expect(stats.totalCents).toBe(1800);
  });

  it('geeft null gemiddelde bij minder dan 2 bruikbare beurten', () => {
    const stats = computeFuelStats([makeFuelLog({ id: 'a', odometer_km: 100, liters: 3 })]);
    expect(stats.points).toHaveLength(0);
    expect(stats.avgLPer100km).toBeNull();
  });
});

describe('formatLPer100km / formatKmPerLiter / formatCents', () => {
  it('Nederlandse decimalen', () => {
    expect(formatLPer100km(2.46)).toBe('2,5 L/100km');
    // "1 op 25" = 25 km per liter
    expect(formatKmPerLiter(25)).toBe('1 op 25,0');
    expect(formatKmPerLiter(24.06)).toBe('1 op 24,1');
    expect(formatCents(1250)).toBe('€12,50');
    expect(formatCents(123456)).toBe('€1.234,56');
  });
});

describe('eurosToCents', () => {
  it('komma, punt en lege invoer', () => {
    expect(eurosToCents('12,50')).toBe(1250);
    expect(eurosToCents('12.5')).toBe(1250);
    expect(eurosToCents('0')).toBe(0);
    expect(eurosToCents('')).toBeNull();
    expect(eurosToCents('abc')).toBeNull();
  });
});

describe('buildFuelCsv', () => {
  it('bouwt CSV met verbruik per beurt in beide richtingen', () => {
    const csv = buildFuelCsv([
      makeFuelLog({ id: 'a', filled_at: '2026-10-01T10:00:00.000Z', odometer_km: 10000, liters: 5 }),
      makeFuelLog({ id: 'b', filled_at: '2026-10-05T10:00:00.000Z', odometer_km: 10500, liters: 3.5, price_per_liter_cents: 219, station: 'Tinq' }),
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('datum;km;liters;l_per_100km;km_per_liter;prijs_per_liter_eur;station');
    expect(lines[1]).toBe('2026-10-01;10000;5,0;;;;');
    // 3,5 L over 500 km: 0,7 L/100km en 1 op 142,9
    expect(lines[2]).toBe('2026-10-05;10500;3,5;0,7;142,9;2,19;Tinq');
  });

  it('gebruikt decimaalkomma en quoted station', () => {
    const csv = buildFuelCsv([
      makeFuelLog({ id: 'b', filled_at: '2026-10-05T10:00:00.000Z', odometer_km: 10500, liters: 3.456, station: 'Tinq; Eindhoven' }),
      makeFuelLog({ id: 'a', filled_at: '2026-10-01T10:00:00.000Z', odometer_km: 10000, liters: 5 }),
    ]);
    // 3,456 L over 500 km = 0,6912 L/100km → 1 op 144,7
    expect(csv).toContain(';3,5;0,7;144,7;');
    expect(csv).toContain('"Tinq; Eindhoven"');
  });
});

describe('buildMaintenanceCsv', () => {
  it('bouwt CSV met header, op datum gesorteerd', () => {
    const csv = buildMaintenanceCsv([
      makeRecord({ id: 'b', done_at: '2026-10-05T09:00:00.000Z', km_at_service: 12500, cost_cents: 2500 }),
      makeRecord({ id: 'a', done_at: '2026-10-01T09:00:00.000Z', km_at_service: 12300 }),
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('datum;naam;km;kosten_eur;onderdelen;notities');
    expect(lines[1]).toContain('2026-10-01;Oliewissel;12300;;');
    expect(lines[2]).toContain('2026-10-05;Oliewissel;12500;25,00');
  });

  it('quote velden met puntkomma of aanhalingstekens', () => {
    const csv = buildMaintenanceCsv([
      makeRecord({ id: 'a', custom_name: 'Rollen; sproeier', notes: 'zei "pas op"' }),
    ]);
    expect(csv).toContain('"Rollen; sproeier"');
    expect(csv).toContain('"zei ""pas op"""');
  });

  it('lost item-namen op via een resolver', () => {
    const csv = buildMaintenanceCsv([makeRecord({ id: 'a', custom_name: null })], () => 'Motorolie');
    expect(csv.split('\n')[1]).toContain(';Motorolie;');

    const summary = buildMaintenanceSummary(
      [makeRecord({ id: 'a', custom_name: null })],
      'Mijn Aerox',
      () => 'Motorolie',
    );
    expect(summary).toContain('- 2026-10-01: Motorolie');
  });
});

describe('buildMaintenanceSummary', () => {
  it('telt totaalkosten en laatste beurten', () => {
    const summary = buildMaintenanceSummary(
      [
        makeRecord({ id: 'a', done_at: '2026-10-01T09:00:00.000Z', cost_cents: 1000, km_at_service: 12300 }),
        makeRecord({ id: 'b', done_at: '2026-10-05T09:00:00.000Z', cost_cents: 2500, km_at_service: 12500 }),
      ],
      'Mijn Aerox',
    );
    expect(summary).toContain('Onderhoudslogboek Mijn Aerox');
    expect(summary).toContain('Aantal registraties: 2');
    expect(summary).toContain('Totale kosten: €35,00');
    expect(summary).toContain('- 2026-10-05: Oliewissel bij 12.500 km · €25,00');
  });

  it('handelt lege historie af', () => {
    const summary = buildMaintenanceSummary([], 'Mijn Aerox');
    expect(summary).toContain('Nog geen onderhoud geregistreerd');
  });
});
