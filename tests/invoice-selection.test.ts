/** Tests voor de factuurselectie: periode of één losse onderhoudsbeurt. */
import {
  defaultPeriod,
  filterRecordsByPeriod,
  isoDateToInput,
  parseDateInput,
  selectRecordsForInvoice,
} from '../src/lib/invoice-selection';
import type { MaintenanceRecord } from '../src/types';

function record(id: string, doneAt: Date, costCents: number | null = 1000): MaintenanceRecord {
  return {
    id,
    scooter_id: 'scooter-1',
    item_id: null,
    custom_name: id,
    done_at: doneAt.toISOString(),
    km_at_service: 12000,
    cost_cents: costCents,
    parts: null,
    notes: null,
    created_at: doneAt.toISOString(),
  };
}

const records = [
  record('oktober', new Date(2026, 9, 20, 12)),
  record('begin-november', new Date(2026, 10, 1, 0, 0, 0)),
  record('eind-november', new Date(2026, 10, 26, 23, 59, 59)),
];

describe('parseDateInput', () => {
  it('leest DD-MM-JJJJ en vult leidende nullen aan', () => {
    expect(parseDateInput('05-10-2026')).toBe('2026-10-05');
    expect(parseDateInput('5-1-2026')).toBe('2026-01-05');
  });

  it('weigert onbestaande of verkeerd geformatteerde datums', () => {
    expect(parseDateInput('29-02-2026')).toBeNull();
    expect(parseDateInput('31-04-2026')).toBeNull();
    expect(parseDateInput('2026-10-05')).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });
});

describe('datumvelden', () => {
  it('toont een ISO-datum als DD-MM-JJJJ', () => {
    expect(isoDateToInput('2026-10-05T09:30:00.000Z')).toBe('05-10-2026');
  });

  it('geeft deze maand tot vandaag als standaardperiode', () => {
    expect(defaultPeriod(new Date(2026, 10, 26, 15))).toEqual({
      fromIso: '2026-11-01',
      toIso: '2026-11-26',
    });
  });
});

describe('filterRecordsByPeriod', () => {
  it('neemt de eerste en laatste dag van de periode mee', () => {
    const selected = filterRecordsByPeriod(records, '2026-11-01', '2026-11-26');
    expect(selected.map((r) => r.id)).toEqual(['begin-november', 'eind-november']);
  });

  it('laat beurten buiten de periode weg', () => {
    const selected = filterRecordsByPeriod(records, '2026-10-01', '2026-10-31');
    expect(selected.map((r) => r.id)).toEqual(['oktober']);
  });

  it('geeft niets terug bij een omgekeerde of ongeldige periode', () => {
    expect(filterRecordsByPeriod(records, '2026-11-26', '2026-11-01')).toEqual([]);
    expect(filterRecordsByPeriod(records, 'geen-datum', '2026-11-26')).toEqual([]);
  });
});

describe('selectRecordsForInvoice', () => {
  it('kiest precies één losse beurt', () => {
    const selected = selectRecordsForInvoice(records, { kind: 'record', recordId: 'oktober' });
    expect(selected.map((r) => r.id)).toEqual(['oktober']);
  });

  it('geeft niets terug bij een onbekende beurt', () => {
    expect(selectRecordsForInvoice(records, { kind: 'record', recordId: 'bestaat-niet' })).toEqual(
      [],
    );
  });

  it('kiest de beurten binnen de periode', () => {
    const selected = selectRecordsForInvoice(records, {
      kind: 'period',
      fromIso: '2026-11-01',
      toIso: '2026-11-30',
    });
    expect(selected.map((r) => r.id)).toEqual(['begin-november', 'eind-november']);
  });
});
