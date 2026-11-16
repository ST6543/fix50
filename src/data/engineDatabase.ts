/**
 * Fix50 Engine Database — technische dossiers per blokfamilie.
 *
 * Harde regel: een ontbrekende fabriekswaarde blijft onbekend. Elke waarde die
 * hier staat heeft een bron; waarden zonder bron staan er niet in. Forumkennis
 * wordt nooit als fabrieksinstelling gepresenteerd.
 *
 * `source` is de bron zoals die in het dossier getoond wordt. `verified`:
 * - 'fabriek': fabriekshandleiding of servicemanual.
 * - 'leverancier': documentatie van de onderdelenleverancier (bijv. Jasil).
 * - 'praktijk': meerdere gebruikersmetingen, geen fabriekswaarde.
 * - 'onbekend': bewust leeg — nog niet gecontroleerd.
 */

export type EngineSourceKind = 'fabriek' | 'leverancier' | 'praktijk' | 'onbekend';

export interface SourcedValue<T> {
  value: T | null;
  source: string | null;
  kind: EngineSourceKind;
}

export interface GearboxGear {
  gear: number;
  /** Tandwielpaar zoals in de bron, bijv. "36/12". */
  pair: string;
  /** ingaand/uitgaand als verhouding. */
  ratio: number;
}

export interface GearboxDossier {
  id: string;
  label: string;
  /** Aantal versnellingen; null = onbekend. */
  gears: GearboxGear[];
  source: string | null;
  kind: EngineSourceKind;
  /** Waarschuwing als dit een race-/aftermarketbak is en geen standaard. */
  note: string | null;
}

export interface StockCarbDossier {
  carburettor: string;
  mainJet: SourcedValue<number>;
  idleJet: SourcedValue<number>;
  needle: SourcedValue<string>;
  slide: SourcedValue<string>;
  floatHeightMm: SourcedValue<number>;
  airScrewTurns: SourcedValue<number>;
  /** Voor welke uitvoering dit geldt — nooit generaliseren. */
  appliesTo: string;
}

export interface EngineDossier {
  id: string;
  /** Blokcode zoals op het carter. */
  code: string;
  label: string;
  family: string;
  generation: string | null;
  years: string | null;
  models: string[];
  cooling: 'AC' | 'LC' | 'AC + LC' | null;
  /** 'schakel' of 'vario'; null = onbekend. */
  transmission: 'schakel' | 'vario' | null;
  displacementCc: SourcedValue<number>;
  boreStroke: SourcedValue<string>;
  /** Interne primaire overbrenging (krukas → versnellingsbakas). */
  primaryRatio: SourcedValue<number>;
  gearboxes: GearboxDossier[];
  /** Totale overbrenging zoals de fabriek hem opgeeft (bijv. Vespa Ciao). */
  totalRatios: { label: string; ratio: number; source: string; kind: EngineSourceKind }[];
  stockCarbs: StockCarbDossier[];
  /** Wat er nog niet gecontroleerd is — expliciet, zodat het dossier geen gaten verbergt. */
  missing: string[];
  notes: string[];
}

const unknown = <T,>(note?: string): SourcedValue<T> => ({ value: null, source: note ?? null, kind: 'onbekend' });

export const ENGINE_DOSSIERS: EngineDossier[] = [
  {
    id: 'am6-v1',
    code: 'AM6',
    label: 'Minarelli AM6 — standaard (V1)',
    family: 'minarelli-am6',
    generation: 'V1',
    years: '1998–heden (diverse modellen)',
    models: ['Rieju MRX/RRX', 'Motorhispania', 'Yamaha DT50 (AM6-variant)', 'Aprilia RS50 (oude typen)'],
    cooling: 'LC',
    transmission: 'schakel',
    displacementCc: { value: 49, source: 'Cilinderinhoud 49,7 cc volgens fabrieksopgave van de modellen', kind: 'fabriek' },
    boreStroke: { value: '40,3 × 39,0 mm', source: 'Fabrieksopgave AM6-cilinder', kind: 'fabriek' },
    primaryRatio: { value: 3.55, source: 'Interne primaire 20/71 (3,55) — werkplaatsgegevens AM6', kind: 'leverancier' },
    gearboxes: [
      {
        id: 'am6-v1-standaard',
        label: 'Standaard 6-bak (V1)',
        gears: [
          { gear: 1, pair: '36/12', ratio: 3.0 },
          { gear: 2, pair: '33/16', ratio: 2.063 },
          { gear: 3, pair: '29/19', ratio: 1.526 },
          { gear: 4, pair: '27/22', ratio: 1.227 },
          { gear: 5, pair: '25/24', ratio: 1.042 },
          { gear: 6, pair: '24/25', ratio: 0.96 },
        ],
        source: 'Jasil AM6 standaardversnellingsbak (tandwielparen)',
        kind: 'leverancier',
        note: null,
      },
      {
        id: 'am6-v1-close',
        label: 'Close-ratio racebak',
        gears: [
          { gear: 1, pair: '36/14', ratio: 2.571 },
          { gear: 2, pair: '30/16', ratio: 1.875 },
          { gear: 3, pair: '29/19', ratio: 1.526 },
          { gear: 4, pair: '27/20', ratio: 1.35 },
          { gear: 5, pair: '26/21', ratio: 1.238 },
          { gear: 6, pair: '25/22', ratio: 1.136 },
        ],
        source: 'Voca Racing AM6 close-ratio bak',
        kind: 'leverancier',
        note: 'Dit is een andere versnellingsbak, geen standaard AM6-specificatie.',
      },
    ],
    totalRatios: [],
    stockCarbs: [
      {
        carburettor: 'Dell\'Orto PHBN 16',
        mainJet: unknown('Nog niet per model gecontroleerd'),
        idleJet: unknown('Nog niet per model gecontroleerd'),
        needle: unknown('Nog niet per model gecontroleerd'),
        slide: unknown('Nog niet per model gecontroleerd'),
        floatHeightMm: unknown('Nog niet per model gecontroleerd'),
        airScrewTurns: unknown('Nog niet per model gecontroleerd'),
        appliesTo: 'Alleen de modellen waarvoor de fabriekshandleiding het noemt — niet generaliseren.',
      },
    ],
    missing: [
      'Fabrieks-sproeierbezettings per model en bouwjaar',
      'Vlotterhoogte per carburateurversie',
      'Verschillen tussen V1 en V2 precies (welke jaren wat kregen)',
    ],
    notes: [
      'AM6 is een 6-bak; de vertanding bepaalt je toerental bij snelheid, niet een vario.',
      'De close-ratio bakverhoudingen horen bij een racebak en mogen nooit als standaardwaarde gebruikt worden.',
    ],
  },
  {
    id: 'derbi-ebe-ebs-d50b0',
    code: 'EBE / EBS / D50B0 / D50B1',
    label: 'Derbi EBE/EBS en D50B0/D50B1',
    family: 'derbi',
    generation: 'EBE/EBS (oud) · D50B0/B1 (nieuw)',
    years: '1993–heden',
    models: ['Derbi Senda', 'Derbi GPR', 'Aprilia RX/SX 50 (D50B0)'],
    cooling: 'LC',
    transmission: 'schakel',
    displacementCc: { value: 49, source: 'Fabrieksopgave cilinderinhoud 49,9 cc', kind: 'fabriek' },
    boreStroke: { value: '39,9 × 40,0 mm', source: 'Fabrieksopgave Derbi 50', kind: 'fabriek' },
    primaryRatio: {
      value: 3.7,
      source: 'Derbi-werkplaatshandleiding (Euro 3): primaire 21/78 (3,7)',
      kind: 'fabriek',
    },
    gearboxes: [
      {
        id: 'derbi-standaard',
        label: 'Standaard 6-bak',
        gears: [
          { gear: 1, pair: '34/11', ratio: 3.091 },
          { gear: 2, pair: '30/15', ratio: 2.0 },
          { gear: 3, pair: '27/18', ratio: 1.5 },
          { gear: 4, pair: '24/20', ratio: 1.2 },
          { gear: 5, pair: '23/22', ratio: 1.045 },
          { gear: 6, pair: '22/23', ratio: 0.957 },
        ],
        source: 'Jasil Derbi standaardversnellingsbak (tandwielparen)',
        kind: 'leverancier',
        note: null,
      },
    ],
    totalRatios: [],
    stockCarbs: [],
    missing: [
      'Verschil in bakverhoudingen tussen EBE en EBS (bron noemt ze samen)',
      'D50B0/D50B1: eigen fabrieks-sproeierbezettings per bouwjaar',
      'Euro4/5 ECU-begrenzing per modeljaar',
    ],
    notes: [
      'EBE en EBS verschillen vooral in de toerenteller-aandrijving, niet in de bakverhoudingen volgens de gebruikte bron.',
      'D50B0 is een nieuwer blok: ga niet uit van dezelfde koppeling of krukas als EBE.',
    ],
  },
  {
    id: 'tomos-a35',
    code: 'A35',
    label: 'Tomos A35',
    family: 'tomos',
    generation: 'A35',
    years: '1980s–1990s',
    models: ['Tomos Flexer', 'Tomos Quadro', 'Tomos APN'],
    cooling: 'AC',
    transmission: 'schakel',
    displacementCc: { value: 49, source: 'Fabrieksopgave 49 cc', kind: 'fabriek' },
    boreStroke: unknown('Niet gecontroleerd in de werkplaatshandleiding'),
    primaryRatio: unknown('De handleiding beschrijft interne reductie en kettingoverbrenging apart; nog niet omgerekend'),
    gearboxes: [
      {
        id: 'tomos-a35-2v',
        label: 'Standaard 2-bak (gedeeltelijk gedocumenteerd)',
        gears: [
          { gear: 1, pair: '—', ratio: 3.882 },
          { gear: 2, pair: '—', ratio: 2.462 },
        ],
        source: 'Tomos A35 werkplaatshandboek',
        kind: 'fabriek',
        note: 'Alleen de eerste twee versnellingen zijn uit de handleiding overgenomen; tandwielparen ontbreken.',
      },
    ],
    totalRatios: [],
    stockCarbs: [],
    missing: [
      'Tandwielparen van de A35-bak',
      'Interne reductie als losse verhouding',
      'Fabrieks-sproeierbezettings per uitvoering (Flexer/Quadro/APN)',
    ],
    notes: [
      'De handleiding noemt interne reductie én kettingoverbrenging apart: reken ze niet op één hoop.',
    ],
  },
  {
    id: 'tomos-a52-a55',
    code: 'A52 / A55',
    label: 'Tomos A52 / A55',
    family: 'tomos',
    generation: 'A52 · A55',
    years: '1990s–2000s',
    models: ['Tomos Streetmate', 'Tomos Revival', 'Tomos Sprint'],
    cooling: 'AC',
    transmission: 'schakel',
    displacementCc: { value: 49, source: 'Fabrieksopgave 49 cc', kind: 'fabriek' },
    boreStroke: unknown('Niet gecontroleerd'),
    primaryRatio: unknown('Niet gecontroleerd'),
    gearboxes: [],
    totalRatios: [],
    stockCarbs: [
      {
        carburettor: "Dell'Orto PHVA 14",
        mainJet: { value: 55, source: 'Tomos A52/A55 technische en tuninghandleiding', kind: 'fabriek' },
        idleJet: { value: 25, source: 'Tomos A52/A55 technische en tuninghandleiding', kind: 'fabriek' },
        needle: unknown('Niet vermeld in de gebruikte bron'),
        slide: unknown('Niet vermeld in de gebruikte bron'),
        floatHeightMm: unknown('Niet vermeld in de gebruikte bron'),
        airScrewTurns: unknown('Niet vermeld in de gebruikte bron'),
        appliesTo: 'Alleen de Streetmate 45 km/u-uitvoering uit die handleiding — niet op iedere A55 toepassen.',
      },
    ],
    missing: [
      'Versnellingsbakverhoudingen van de A52/A55',
      'Sproeierbezettings per uitvoering (45 km/u vs 25 km/u)',
      'Verschillen tussen A52 en A55',
    ],
    notes: [
      'De bekende PHVA 14 met sproeier 55/25 hoort bij één specifieke Streetmate-uitvoering. Een andere A55 kan af fabriek anders staan.',
    ],
  },
  {
    id: 'piaggio-ciao-fam',
    code: 'Ciao / Si / Bravo',
    label: 'Vespa Piaggio Ciao, Si en Bravo',
    family: 'piaggio-ciao',
    generation: 'Ciao · Si · Bravo · Boxer',
    years: '1967–2000s',
    models: ['Piaggio Ciao', 'Piaggio Si', 'Piaggio Bravo', 'Piaggio Boxer'],
    cooling: 'AC',
    transmission: 'vario',
    displacementCc: { value: 49, source: 'Fabrieksopgave 49 cc', kind: 'fabriek' },
    boreStroke: unknown('Niet gecontroleerd'),
    primaryRatio: unknown('De servicemanual geeft totale overbrengingen, geen losse primaire verhouding'),
    gearboxes: [],
    totalRatios: [
      { label: 'Ciao zonder variateur', ratio: 13.04, source: 'Piaggio Ciao/Bravo/Si servicemanual', kind: 'fabriek' },
      { label: 'Ciao met variateur (bereik)', ratio: 12.04, source: 'Piaggio Ciao/Bravo/Si servicemanual — onderkant van het bereik', kind: 'fabriek' },
      { label: 'Ciao met variateur (bereik)', ratio: 20.62, source: 'Piaggio Ciao/Bravo/Si servicemanual — bovenkant van het bereik', kind: 'fabriek' },
      { label: 'Bravo zonder variateur', ratio: 13.04, source: 'Piaggio Ciao/Bravo/Si servicemanual', kind: 'fabriek' },
      { label: 'Si zonder variateur', ratio: 13.04, source: 'Piaggio Ciao/Bravo/Si servicemanual', kind: 'fabriek' },
    ],
    stockCarbs: [],
    missing: [
      'Losse primaire verhouding (alleen totalen bekend)',
      'Sproeierbezettings per uitvoering',
      'Verschil Ciao/Si/Bravo in vario-afstelling',
    ],
    notes: [
      'Bij een variateur is de totale overbrenging een bereik, geen vast getal: 12,04 tot 20,62.',
    ],
  },
  {
    id: 'dellorto-phbg',
    code: "Dell'Orto PHBG",
    label: "Dell'Orto PHBG (carburateurfamilie)",
    family: 'dellorto',
    generation: 'PHBG',
    years: '—',
    models: ['Los onderdeel — hoort bij meerdere blokken'],
    cooling: null,
    transmission: null,
    displacementCc: unknown('Niet van toepassing op een carburateur'),
    boreStroke: unknown('Niet van toepassing op een carburateur'),
    primaryRatio: unknown('Niet van toepassing op een carburateur'),
    gearboxes: [],
    totalRatios: [],
    stockCarbs: [
      {
        carburettor: "Dell'Orto PHBG",
        mainJet: unknown('Sproeier is per motor opgegeven, niet per carburateur'),
        idleJet: unknown('Idem'),
        needle: unknown('Idem'),
        slide: unknown('Idem'),
        floatHeightMm: {
          value: 16,
          source: "Dell'Orto technische documentatie: vlotterhoogte 16 ± 0,5 mm",
          kind: 'fabriek',
        },
        airScrewTurns: unknown('Idem'),
        appliesTo: 'Geldt voor de PHBG-familie als vlotterhoogte, niet als mengseladvies.',
      },
    ],
    missing: ['Sproeier- en naaldcombinaties per motorconfiguratie'],
    notes: [
      'Een carburateurfamilie is geen afstelling: dezelfde PHBG kan op tien motoren tien verschillende sproeiers hebben.',
    ],
  },
];

/** Blokfamilies die nog geen gecontroleerd dossier hebben — bewust zichtbaar. */
export const PLANNED_BLOCKS: { code: string; label: string; status: string }[] = [
  { code: 'AM6 V2', label: 'Minarelli AM6 V2', status: 'Verschillen met V1 nog niet gecontroleerd' },
  { code: 'Puch E50 / ZA50', label: 'Puch E50, ZA50, Maxi', status: 'Nog geen bron in het dossier' },
  { code: 'A3', label: 'Tomos A3', status: 'Nog geen bron in het dossier' },
  { code: '139QMB', label: 'GY6 139QMB (4-takt)', status: 'Reductietandwielen 25 vs 45 km/u verschillen — nog niet uitgewerkt' },
  { code: '139QMA / 152QMI / 157QMJ', label: 'GY6 4-takt varianten', status: 'Nog geen bron in het dossier' },
  { code: '139FMB / 1P39FMB', label: 'Chinese 4-takt bromblokken', status: 'Nog geen bron in het dossier' },
  { code: 'Hi-Per2', label: 'Piaggio Hi-Per2 (scooter 2-takt)', status: 'Algemene blokdata bestaat in de Afstelhulp; verhoudingen nog niet' },
  { code: 'CPI / Generic / AGM', label: 'CPI, Generic, AGM', status: 'Nog geen bron in het dossier' },
];

export function findDossier(id: string | null | undefined): EngineDossier | null {
  if (!id) return null;
  return ENGINE_DOSSIERS.find((d) => d.id === id) ?? null;
}

/** Eerste (standaard) versnellingsbak van een dossier, of null. */
export function standardGearbox(dossier: EngineDossier | null): GearboxDossier | null {
  if (!dossier) return null;
  return dossier.gearboxes.find((g) => g.id.endsWith('standaard') || g.id.endsWith('-2v')) ?? dossier.gearboxes[0] ?? null;
}

/** Alle bronnen die in een dossier gebruikt zijn, zonder dubbelingen. */
export function dossierSources(dossier: EngineDossier): string[] {
  const out = new Set<string>();
  const push = (v: SourcedValue<unknown>) => {
    if (v.source && v.kind !== 'onbekend') out.add(v.source);
  };
  push(dossier.displacementCc);
  push(dossier.boreStroke);
  push(dossier.primaryRatio);
  dossier.gearboxes.forEach((g) => g.source && out.add(g.source));
  dossier.totalRatios.forEach((t) => out.add(t.source));
  dossier.stockCarbs.forEach((c) => {
    [c.mainJet, c.idleJet, c.needle, c.slide, c.floatHeightMm, c.airScrewTurns].forEach(push);
  });
  return [...out];
}
