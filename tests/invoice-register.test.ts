/**
 * Factuurregister: eigen nummerreeks en een bevroren snapshot per factuur.
 * De documenttests bewijzen dat opnieuw delen exact hetzelfde document geeft,
 * ook als het brononderhoud later verandert.
 */
import {
  buildInvoiceHtmlFromSnapshot,
  buildInvoiceSnapshot,
  formatInvoiceNumber,
  invoiceLinesFromRecords,
  invoiceSelectionLabel,
  invoiceSequenceYear,
  invoiceSnapshotTotal,
} from '@/lib/invoice-snapshot';
import type { MaintenanceRecord } from '@/types';

function record(
  id: string,
  doneAt: Date,
  costCents: number | null,
  km: number | null = 12000,
): MaintenanceRecord {
  return {
    id,
    scooter_id: 'scooter-1',
    item_id: null,
    custom_name: id,
    done_at: doneAt.toISOString(),
    km_at_service: km,
    cost_cents: costCents,
    parts: null,
    notes: null,
    created_at: doneAt.toISOString(),
  };
}

const scooter = {
  id: 'scooter-1',
  name: 'Aerox',
  brand: 'Yamaha',
  model: 'Aerox',
  year: 2019,
  license_plate: null,
  fuel_system: '2T',
  current_km: 12400,
};

const period = { kind: 'period' as const, fromIso: '2026-11-01', toIso: '2026-11-26' };

describe('nummerreeks', () => {
  it('gebruikt het jaar van uitgifte en vult het volgnummer aan', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('F50-2026-0001');
    expect(formatInvoiceNumber(2026, 42)).toBe('F50-2026-0042');
    expect(formatInvoiceNumber(2027, 1234)).toBe('F50-2027-1234');
  });

  it('houdt opeenvolgende facturen op dezelfde dag uit elkaar', () => {
    expect(formatInvoiceNumber(2026, 7)).not.toBe(formatInvoiceNumber(2026, 8));
  });

  it('leest het reeksjaar uit de uitgiftedatum', () => {
    expect(invoiceSequenceYear('2026-11-26T10:00:00.000Z')).toBe(2026);
    expect(invoiceSequenceYear('geen-datum')).toBe(new Date().getFullYear());
  });
});

describe('invoiceLinesFromRecords', () => {
  it('maakt regels met omschrijving, onderdelen, km en bedrag, oudste eerst', () => {
    const lines = invoiceLinesFromRecords(
      [record('Remblokjes', new Date(2026, 10, 20, 12), 2450), record('Oliewissel', new Date(2026, 10, 2, 9), null)],
      (r) => r.custom_name ?? 'Onderhoud',
    );

    expect(lines.map((l) => l.description)).toEqual(['Oliewissel', 'Remblokjes']);
    expect(lines[1]).toMatchObject({ km: 12000, amountCents: 2450, detail: null });
  });
});

describe('buildInvoiceSnapshot', () => {
  it('legt regels en totaal vast en telt regels zonder bedrag niet mee', () => {
    const snapshot = buildInvoiceSnapshot({
      scooter,
      ownerName: 'Sam',
      issuedAtIso: '2026-11-26T10:00:00.000Z',
      selection: period,
      lines: invoiceLinesFromRecords(
        [record('Oliewissel', new Date(2026, 10, 2, 9), null), record('Remblokjes', new Date(2026, 10, 20, 12), 2450)],
        (r) => r.custom_name ?? 'Onderhoud',
      ),
    });

    expect(snapshot.version).toBe(1);
    expect(snapshot.totalCents).toBe(2450);
    expect(snapshot.lines).toHaveLength(2);
    expect(snapshot.scooter.current_km).toBe(12400);
  });

  it('is een kopie: later gewijzigde bronregels veranderen het snapshot niet', () => {
    const lines = invoiceLinesFromRecords([record('Oliewissel', new Date(2026, 10, 2, 9), 1000)], (r) => r.custom_name!);
    const snapshot = buildInvoiceSnapshot({
      scooter,
      ownerName: 'Sam',
      issuedAtIso: '2026-11-26T10:00:00.000Z',
      selection: period,
      lines,
    });

    lines[0]!.description = 'Aangepast';
    lines[0]!.amountCents = 9999;

    expect(snapshot.lines[0]?.description).toBe('Oliewissel');
    expect(invoiceSnapshotTotal(snapshot)).toBe(1000);
  });
});

describe('opnieuw delen', () => {
  it('geeft byte-voor-byte hetzelfde document uit het opgeslagen snapshot', () => {
    const snapshot = buildInvoiceSnapshot({
      scooter,
      ownerName: 'Sam',
      issuedAtIso: '2026-11-26T10:00:00.000Z',
      selection: period,
      lines: invoiceLinesFromRecords(
        [record('Oliewissel', new Date(2026, 10, 2, 9), 1995), record('Remblokjes', new Date(2026, 10, 20, 12), 2450)],
        (r) => r.custom_name ?? 'Onderhoud',
      ),
    });

    const first = buildInvoiceHtmlFromSnapshot(snapshot, 'F50-2026-0001');
    // Zo komt de rij ook terug uit de database: als JSON.
    const stored = JSON.parse(JSON.stringify(snapshot));
    const again = buildInvoiceHtmlFromSnapshot(stored, 'F50-2026-0001');

    expect(again).toBe(first);
    expect(first).toContain('F50-2026-0001');
    expect(first).toContain('26-11-2026');
    expect(first).toContain('€ 44,45');
  });

  it('neemt het snapshot als bron, niet het actuele onderhoud', () => {
    const snapshot = buildInvoiceSnapshot({
      scooter,
      ownerName: 'Sam',
      issuedAtIso: '2026-11-26T10:00:00.000Z',
      selection: period,
      lines: invoiceLinesFromRecords([record('Oliewissel', new Date(2026, 10, 2, 9), 1995)], (r) => r.custom_name ?? 'Onderhoud'),
    });
    const html = buildInvoiceHtmlFromSnapshot(snapshot, 'F50-2026-0002');

    expect(html).toContain('Oliewissel');
    expect(html).not.toContain('Remblokjes');
    // De stand van uitgifte staat op het document, niet een latere.
    expect(html).toContain('12.400');
  });
});

describe('invoiceSelectionLabel', () => {
  it('noemt de periode of de losse beurt', () => {
    expect(invoiceSelectionLabel(period)).toBe('01-11-2026 t/m 26-11-2026');
    expect(
      invoiceSelectionLabel({ kind: 'period', fromIso: '2026-11-26', toIso: '2026-11-26' }),
    ).toBe('26-11-2026');
    expect(invoiceSelectionLabel({ kind: 'record', recordId: 'record-1' })).toBe('Eén losse beurt');
  });
});
