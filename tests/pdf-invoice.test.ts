/** Tests voor het FIX50-factuurdocument (zuivere HTML-builder). */
import { buildInvoiceHtml, invoiceNumberFor } from '../src/lib/pdf';

const scooter = {
  id: 'a1b2c3d4-1111-2222-3333-444455556666',
  name: 'Mijn Aerox',
  brand: 'Yamaha',
  model: 'Aerox',
  year: 2021,
  license_plate: 'fdx-42-k',
  fuel_system: '2T',
  current_km: 12450,
};

const ISSUED = '2026-10-05T09:30:00.000Z';

function invoice(overrides: Partial<Parameters<typeof buildInvoiceHtml>[0]> = {}) {
  return buildInvoiceHtml({
    scooter,
    ownerName: 'Stefan',
    invoiceNumber: 'F50-20261005-6666',
    issuedAtIso: ISSUED,
    generatedAtIso: ISSUED,
    lines: [
      {
        description: 'Oliewissel',
        detail: 'Oliefilter, 1L 10W-40',
        doneAtIso: '2026-10-05T09:00:00.000Z',
        km: 12450,
        amountCents: 2450,
      },
      {
        description: 'Remblokjes',
        detail: null,
        doneAtIso: '2026-03-01T09:00:00.000Z',
        km: 9800,
        amountCents: 1890,
      },
    ],
    ...overrides,
  });
}

describe('invoiceNumberFor', () => {
  it('maakt een stabiel nummer per scooter en dag', () => {
    const a = invoiceNumberFor(scooter.id, '2026-10-05T09:30:00.000Z');
    const b = invoiceNumberFor(scooter.id, '2026-10-05T23:59:00.000Z');
    const c = invoiceNumberFor(scooter.id, '2026-10-06T09:30:00.000Z');
    expect(a).toBe('F50-20261005-6666');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('buildInvoiceHtml (factuur, particulier)', () => {
  it('bevat nummer, datum, voertuig, regels en het totaal', () => {
    const html = invoice();

    expect(html).toContain('Factuur');
    expect(html).toContain('F50-20261005-6666');
    expect(html).toContain('05-10-2026'); // factuurdatum
    expect(html).toContain('Yamaha Aerox 2021');
    expect(html).toContain('FDX-42-K'); // kenteken uppercased
    expect(html).toContain('Stefan');
    expect(html).toContain('Oliewissel');
    expect(html).toContain('Remblokjes');
    expect(html).toContain('Oliefilter, 1L 10W-40');
    expect(html).toContain('€ 24,50');
    expect(html).toContain('€ 18,90');
    expect(html).toContain('€ 43,40'); // totaal
    expect(html).toContain('2 regels');
    // Chronologisch: de maart-regel staat vóór de oktober-regel in de tabel.
    expect(html.indexOf('Remblokjes')).toBeLessThan(html.indexOf('Oliewissel'));
  });

  it('blijft particulier: geen btw-regel, geen bedrijfs- of klantblok', () => {
    const html = invoice();
    expect(html).toContain('Particuliere administratie');
    expect(html).toContain('geen officiële fiscale factuur');
    expect(html).not.toContain('Subtotaal');
    expect(html).not.toContain('21%');
    expect(html).not.toContain('KVK');
    expect(html).not.toContain('BTW-id');
    // Geen publieke verify-link op een privéfactuur.
    expect(html).not.toContain('/functions/v1/verify');
  });

  it('telt regels zonder bedrag niet mee en zegt dat eerlijk', () => {
    const html = invoice({
      lines: [
        {
          description: 'Ketting smeren',
          detail: null,
          doneAtIso: '2026-10-01T09:00:00.000Z',
          km: 12000,
          amountCents: null,
        },
        {
          description: 'Bougie',
          detail: null,
          doneAtIso: '2026-10-02T09:00:00.000Z',
          km: 12100,
          amountCents: 1250,
        },
      ],
    });

    expect(html).toContain('€ 12,50');
    expect(html).toContain('1 van 2');
    expect(html).toContain('Regels zonder bedrag tellen niet mee');
  });

  it('werkt zonder regels en toont dan een lege staat', () => {
    const html = invoice({ lines: [] });
    expect(html).toContain('Nog geen onderhoud geregistreerd');
    expect(html).toContain('€ 0,00');
    expect(html).toContain('0 regels');
  });

  it('escapet gebruikersinvoer in de regelomschrijving', () => {
    const html = invoice({
      lines: [
        {
          description: '<script>alert(1)</script>',
          detail: 'A & B',
          doneAtIso: '2026-10-05T09:00:00.000Z',
          km: 12450,
          amountCents: 100,
        },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
  });
});
