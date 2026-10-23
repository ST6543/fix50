/** Tests voor de Excel-parser (bronbestand in scripts/data). */
import { parseDiagnosisRows, parseMaintenanceRows, stableHash } from '../scripts/lib/parse-excel';

describe('Excel diagnose-parser', () => {
  const rows = parseDiagnosisRows();

  it('importeert alle ~460 diagnose-rijen', () => {
    expect(rows.length).toBeGreaterThanOrEqual(400);
  });

  it('heeft unieke content-hashes (geen duplicaten bij herimport)', () => {
    const hashes = new Set(rows.map((r) => r.content_hash));
    expect(hashes.size).toBe(rows.length);
  });

  it('bevat alle bekende categorieën', () => {
    const cats = new Set(rows.map((r) => r.category));
    for (const c of ['Accu & Elektra', 'Ontsteking', 'Brandstof', 'CVT', 'Remmen']) {
      expect(cats.has(c)).toBe(true);
    }
  });

  it('behoudt originele inhoud (voorbeeld AM6 ontsteking)', () => {
    const row = rows.find((r) => r.problem === 'Geen vonk' && r.engine_type === 'AM6');
    expect(row).toBeDefined();
    expect(row!.solution).toBe('Bougie vervangen');
  });

  it('deriveert keywords en search_text', () => {
    const row = rows[0]!;
    expect(row.keywords.length).toBeGreaterThan(2);
    expect(row.search_text).toContain(row.problem.toLowerCase());
  });
});

describe('Excel onderhoud-parser', () => {
  const items = parseMaintenanceRows();

  it('importeert alle 26 onderhoudsitems', () => {
    expect(items).toHaveLength(26);
  });

  it('parset km-ranges correct', () => {
    const bougie = items.find((i) => i.name === 'Bougie')!;
    expect(bougie.interval_km_min).toBe(2000);
    expect(bougie.interval_km_max).toBe(4000);
  });

  it('parset tijd-intervallen naar maanden', () => {
    const bougie = items.find((i) => i.name === 'Bougie')!;
    expect(bougie.interval_months_min).toBe(12);
  });

  it('zet 2T/4T/Injectie-vlaggen correct', () => {
    const bougie = items.find((i) => i.name === 'Bougie')!;
    expect(bougie.applies_2t).toBe(true);
    expect(bougie.applies_4t).toBe(false);
    const bougie4t = items.find((i) => i.name === 'Bougie (4T)')!;
    expect(bougie4t.applies_4t).toBe(true);
  });
});

describe('stableHash', () => {
  it('is stabiel en case/whitespace-insensitief', () => {
    expect(stableHash(['A', 'b c'])).toBe(stableHash(['a', 'B  C']));
  });
  it('verschilt bij andere inhoud', () => {
    expect(stableHash(['a', 'b'])).not.toBe(stableHash(['a', 'c']));
  });
});
