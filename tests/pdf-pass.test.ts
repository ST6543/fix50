/** Tests voor de FIX50-dossier-PDF-builders (zuivere HTML-functies). */
import {
  authenticityCode,
  buildMaintenancePassHtml,
  buildTuningPassHtml,
  docNumber,
  escapeHtml,
  euroCents,
  formatKmPerLiterLabel,
  kmDot,
  kmPerLiterFromL100,
  nlDate,
  pickHeroRun,
  speedChart,
  verifyUrl,
} from '../src/lib/pdf';
import type { TuningPdfInput, TuningPdfRun } from '../src/lib/pdf';

const scooter = {
  id: 'a1b2c3d4-0000-0000-0000-000000000000',
  name: 'Mijn Aerox',
  brand: 'Yamaha',
  model: 'Aerox',
  year: 2021,
  license_plate: 'fdx-42-k',
  fuel_system: '2T',
  engine_code: 'AM6',
  current_km: 12450,
};

function makeRun(partial: Partial<TuningPdfRun> & { id: string }): TuningPdfRun {
  return {
    setup_id: null,
    started_at: '2026-10-01T10:00:00.000Z',
    t0_50_s: 5.4,
    t0_80_s: null,
    t50_80_s: null,
    max_speed_kmh: 61.2,
    distance_m: 420,
    gps_quality: 'goed',
    points: [
      { t_ms: 0, speed_kmh: 0 },
      { t_ms: 1000, speed_kmh: 20 },
      { t_ms: 2000, speed_kmh: 45 },
    ],
    ...partial,
  };
}

describe('format-helpers', () => {
  it('datums, km, euro en html-escaping', () => {
    expect(nlDate('2026-10-05T11:00:00.000Z')).toBe('05-10-2026');
    expect(kmDot(12450)).toBe('12.450');
    expect(euroCents(2450)).toBe('€ 24,50');
    expect(escapeHtml('<b>Rollen & "sproeier"</b>')).toBe(
      '&lt;b&gt;Rollen &amp; &quot;sproeier&quot;&lt;/b&gt;',
    );
    expect(docNumber('a1b2c3d4-…')).toBe('DOC-A1B2C3-NL');
  });

  it('rekent L/100km om naar 1-op-X (km per liter)', () => {
    expect(kmPerLiterFromL100(2.3)).toBeCloseTo(43.478, 3);
    expect(kmPerLiterFromL100(0)).toBe(0);
    expect(formatKmPerLiterLabel(25)).toBe('1 op 25,0');
    expect(formatKmPerLiterLabel(100 / 2.3)).toBe('1 op 43,5');
  });

  it('verify-url verwijst naar de live verify-function', () => {
    expect(verifyUrl('fdx-42-k', scooter.id)).toBe(
      'https://gdjargpxcdgciusycyya.supabase.co/functions/v1/verify?voertuig=FDX-42-K',
    );
    // Zonder kenteken valt het documentnummer terug (stabiel per scooter).
    expect(verifyUrl(null, 'a1b2c3d4-0000-0000-0000-000000000000')).toContain('?voertuig=DOC-A1B2C3-NL');
  });

  it('authenticiteitscode is stabiel per scooter en jaar', () => {
    const a = authenticityCode('a1b2c3d4-0000-0000-0000-000000000000', '2026-10-05');
    const b = authenticityCode('a1b2c3d4-0000-0000-0000-000000000000', '2026-12-31');
    const c = authenticityCode('ffffffff-0000-0000-0000-000000000000', '2026-10-05');
    expect(a).toMatch(/^FX50-\d{4}-2026-X$/);
    expect(a).toBe(b); // zelfde jaar → zelfde code
    expect(a).not.toBe(c); // andere scooter → andere code
  });

  it('speedChart geeft leeg bij <2 punten en een polyline bij genoeg', () => {
    expect(speedChart([{ t_ms: 0, speed_kmh: 10 }])).toBe('');
    expect(speedChart(makeRun({ id: 'x' }).points)).toContain('<polyline');
  });

  it('pickHeroRun kiest de snelste 0–50, anders de nieuwste meting', () => {
    const runs = [
      makeRun({ id: 'r1', t0_50_s: 6.1, started_at: '2026-09-01T10:00:00.000Z' }),
      makeRun({ id: 'r2', t0_50_s: 4.9, started_at: '2026-09-20T10:00:00.000Z' }),
      makeRun({ id: 'r3', t0_50_s: 5.4, started_at: '2026-10-01T10:00:00.000Z' }),
    ];
    expect(pickHeroRun(runs)?.id).toBe('r2');
    const noTimes = [makeRun({ id: 'old', t0_50_s: null, started_at: '2026-01-01T00:00:00.000Z' }), makeRun({ id: 'new', t0_50_s: null, started_at: '2026-10-01T00:00:00.000Z' })];
    expect(pickHeroRun(noTimes)?.id).toBe('new');
    expect(pickHeroRun([])).toBeNull();
  });
});

describe('buildMaintenancePassHtml (onderhoudsboekje)', () => {
  it('bevat voertuiggegevens, KPI-strip, chronologische historie en 1-op-X-verbruik', () => {
    const html = buildMaintenancePassHtml({
      scooter,
      ownerName: 'Stefan',
      records: [
        { name: 'Oliewissel', doneAtIso: '2026-10-05T09:00:00.000Z', km: 12450, costCents: 2450, parts: 'Oliefilter, 1L 10W-40', notes: null },
        { name: 'Remblokjes', doneAtIso: '2026-03-01T09:00:00.000Z', km: 9800, costCents: 1890, parts: null, notes: 'Vóór + achter' },
      ],
      fuel: { avgLPer100km: 2.4, totalLiters: 41.6, totalCents: 9150 },
      planning: [{ item: 'Oliewissel', detail: 'verwacht rond 17.500 km (over ~5.050 km)' }],
      generatedAtIso: '2026-10-06T10:00:00.000Z',
    });
    expect(html).toContain('Officieel Onderhoudsboekje');
    expect(html).toContain('Verkoopdossier');
    expect(html).toContain('Yamaha Aerox 2021');
    expect(html).toContain('FDX-42-K'); // kenteken uppercased
    expect(html).toContain('AM6'); // motorcode
    expect(html).toContain('2x'); // totaal beurten
    expect(html).toContain('€ 43,40'); // totaalkosten
    expect(html).toContain('2,4'); // gem. verbruik in L
    expect(html).toContain('1 op 41,7'); // 100/2,4 = 41,7 km per liter
    expect(html).toContain('#001');
    expect(html).toContain('#002');
    // Chronologisch: maart vóór oktober
    expect(html.indexOf('01-03-2026')).toBeLessThan(html.indexOf('05-10-2026'));
    // Proactieve planning uit de FIX50-engine
    expect(html).toContain('Proactieve Onderhoudsplanning');
    expect(html).toContain('verwacht rond 17.500 km');
    // Authenticiteitsvoet met live verify-link
    expect(html).toMatch(/FX50-\d{4}-2026-X/);
    expect(html).toContain('/functions/v1/verify?voertuig=FDX-42-K');
    // XSS in notities wordt ge-escaped
    const xss = buildMaintenancePassHtml({
      scooter,
      ownerName: null,
      records: [{ name: 'X', doneAtIso: '2026-01-01T00:00:00.000Z', km: 1, costCents: null, parts: null, notes: '<script>' }],
      generatedAtIso: '2026-10-06T10:00:00.000Z',
    });
    expect(xss).not.toContain('<script>');
    expect(xss).toContain('&lt;script&gt;');
  });

  it('werkt ook zonder beurten, verbruik en planning', () => {
    const html = buildMaintenancePassHtml({
      scooter,
      ownerName: null,
      records: [],
      generatedAtIso: '2026-10-06T10:00:00.000Z',
    });
    expect(html).toContain('Nog geen onderhoud geregistreerd');
    expect(html).toContain('0x');
    expect(html).not.toContain('Proactieve Onderhoudsplanning');
  });

  it('plaatst de scooterfoto naast de voertuiggegevens (en weg zonder foto)', () => {
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
    const metFoto = buildMaintenancePassHtml({
      scooter,
      ownerName: 'Stefan',
      records: [],
      photoSrc: dataUri,
      generatedAtIso: '2026-10-06T10:00:00.000Z',
    });
    expect(metFoto).toContain('class="veh-photo"');
    expect(metFoto).toContain(dataUri);
    expect(metFoto).toContain('Mijn Aerox'); // caption onder de foto
    const zonderFoto = buildMaintenancePassHtml({
      scooter,
      ownerName: null,
      records: [],
      generatedAtIso: '2026-10-06T10:00:00.000Z',
    });
    expect(zonderFoto).not.toContain('class="veh-photo"');
  });
});

describe('buildTuningPassHtml (performance & tuning rapport)', () => {
  const tuning: TuningPdfInput = {
    scooter,
    ownerName: 'Stefan',
    setups: [
      { id: 's1', name: 'Origineel', parts: { hoofdsproeier: 92, rollen: '6,5g' }, is_active: true },
      { id: 's2', name: 'Sport', parts: { hoofdsproeier: 90 }, is_active: false },
    ],
    runs: [
      makeRun({ id: 'r1', setup_id: 's1', t0_50_s: 6.1, started_at: '2026-09-01T10:00:00.000Z', t50_80_s: 9.2 }),
      makeRun({ id: 'r2', setup_id: 's1', t0_50_s: 5.4, started_at: '2026-09-20T10:00:00.000Z', t50_80_s: 8.4 }),
      makeRun({ id: 'r3', setup_id: 's2', t0_50_s: 4.9, started_at: '2026-10-01T10:00:00.000Z', max_speed_kmh: 71.5 }),
    ],
    changes: [
      { changed_at: '2026-09-15T10:00:00.000Z', part: 'Hoofdsproeier', old_value: '92', new_value: '90', result: 'Magerder, betere top', km_at_change: 12100 },
    ],
    generatedAtIso: '2026-10-06T10:00:00.000Z',
  };

  it('toont KPI-strip met beste tijden, GPS-curve en setup-specificaties', () => {
    const html = buildTuningPassHtml(tuning);
    expect(html).toContain('Performance &amp; Tuning Rapport');
    expect(html).toContain('Tuning Diagnose');
    expect(html).toContain('4,90'); // beste 0–50 (r3)
    expect(html).toContain('8,40'); // beste 50–80 (r2)
    expect(html).toContain('71,5'); // topsnelheid
    expect(html).toContain('<polyline'); // GPS-curve van de hero-run
    expect(html).toContain('Origineel'); // actieve setup
    expect(html).toContain('hoofdsproeier');
    expect(html).toContain('6,5g');
    expect(html).toContain('Metingen-overzicht');
    expect(html).toContain('Wijzigingsregister');
    expect(html).toContain('92 → 90');
    expect(html).toContain('FIX50 Diagnose conclusie');
    expect(html).toContain('Meting ID: LOG-');
    expect(html).toContain('/functions/v1/verify?voertuig=FDX-42-K');
  });

  it('werkt ook zonder metingen en wijzigingen', () => {
    const html = buildTuningPassHtml({ ...tuning, runs: [], changes: [] });
    expect(html).toContain('Nog geen GPS-metingen geregistreerd');
    expect(html).not.toContain('Wijzigingsregister');
    expect(html).not.toContain('Metingen-overzicht');
  });

  it('plaatst de scooterfoto naast de voertuiggegevens (en weg zonder foto)', () => {
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
    const metFoto = buildTuningPassHtml({ ...tuning, photoSrc: dataUri });
    expect(metFoto).toContain('class="veh-photo"');
    expect(metFoto).toContain(dataUri);
    const zonder = buildTuningPassHtml({ ...tuning, photoSrc: null });
    expect(zonder).not.toContain('class="veh-photo"');
  });
});
