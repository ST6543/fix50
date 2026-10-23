/**
 * Rendert beide FIX50-PDF's naar scripts/preview/*.html met realistische
 * voorbeelddata, zodat het dossier-design direct in een browser (Preview-tab)
 * beoordeeld kan worden. Run: npx tsx scripts/pdf-preview.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildMaintenancePassHtml, buildTuningPassHtml } from '../src/lib/pdf';

/** Voorbeeldfoto (inline SVG als data-URI) om de fotokaart in de preview te zien. */
const demoPhoto =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="276" height="208"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b3a55"/><stop offset="1" stop-color="#0c0d0f"/></linearGradient></defs><rect width="276" height="208" fill="url(#g)"/><circle cx="70" cy="150" r="34" fill="none" stroke="#7A7D85" stroke-width="6"/><circle cx="210" cy="150" r="34" fill="none" stroke="#7A7D85" stroke-width="6"/><path d="M46 150c30-52 90-70 150-58l30 14" stroke="#F97316" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M150 62c8-16 34-20 44-6" stroke="#e6e8eb" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`,
  ).toString('base64');

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

const records = [
  { name: 'Oliewissel', doneAtIso: '2026-03-01T09:00:00.000Z', km: 9800, costCents: 1890, parts: 'Oliefilter, 1L 10W-40', notes: null },
  { name: 'Variogewichten', doneAtIso: '2026-05-12T09:00:00.000Z', km: 10900, costCents: 1250, parts: '6,5g rollenset', notes: 'Rollen + koppelingsveertjes' },
  { name: 'Remblokjes', doneAtIso: '2026-10-05T09:00:00.000Z', km: 12450, costCents: 2450, parts: 'Voor + achter', notes: null },
];

mkdirSync('scripts/preview', { recursive: true });

writeFileSync(
  'scripts/preview/maintenance.html',
  buildMaintenancePassHtml({
    scooter,
    ownerName: 'Stefan',
    records,
    fuel: { avgLPer100km: 2.4, totalLiters: 41.6, totalCents: 9150 },
    planning: [
      { item: 'Oliewissel', detail: 'verwacht rond 17.500 km (over ~5.050 km)' },
      { item: 'Varioriem', detail: 'verwacht rond 18.000 km (over ~5.550 km)' },
    ],
    photoSrc: demoPhoto,
    generatedAtIso: '2026-10-07T10:00:00.000Z',
  }),
);

const runs = [
  {
    id: 'e5f6a7b8-1111-2222-3333-444455556666',
    setup_id: 's1',
    started_at: '2026-10-04T15:12:00.000Z',
    t0_50_s: 5.4,
    t0_80_s: null,
    t50_80_s: 8.4,
    max_speed_kmh: 61.2,
    distance_m: 610,
    gps_quality: 'goed',
    points: Array.from({ length: 40 }, (_, i) => ({
      t_ms: i * 350,
      speed_kmh: Math.min(61, Math.round(61 * (1 - Math.exp(-i / 9)) * 100) / 100),
    })),
  },
  {
    id: 'a9b8c7d6-9999-8888-7777-666655554444',
    setup_id: 's1',
    started_at: '2026-09-20T15:00:00.000Z',
    t0_50_s: 6.1,
    t0_80_s: null,
    t50_80_s: 9.2,
    max_speed_kmh: 59.8,
    distance_m: 540,
    gps_quality: 'goed',
    points: [],
  },
];

writeFileSync(
  'scripts/preview/tuning.html',
  buildTuningPassHtml({
    scooter,
    ownerName: 'Stefan',
    setups: [
      {
        id: 's1',
        name: 'Sport 70cc',
        parts: { hoofdsproeier: 92, rollen: '6,5 g', varioriem: 'BGM orig.', uitlaat: 'Tecnigas Next-R', luchtfilter: 'BMC CDA' },
        is_active: true,
      },
    ],
    runs,
    changes: [
      { changed_at: '2026-09-15T10:00:00.000Z', part: 'Hoofdsproeier', old_value: '94', new_value: '92', result: 'Magerder, betere top', km_at_change: 12100 },
      { changed_at: '2026-08-30T10:00:00.000Z', part: 'Rollen', old_value: '7,0 g', new_value: '6,5 g', result: 'Sneller op toerental', km_at_change: 11500 },
    ],
    photoSrc: demoPhoto,
    generatedAtIso: '2026-10-07T10:00:00.000Z',
  }),
);

console.log('scripts/preview/maintenance.html + scripts/preview/tuning.html geschreven.');
