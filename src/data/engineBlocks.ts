/**
 * Blokken-dataset voor de Afstelhulp — de kennisbank in code.
 *
 * Bronnen: scooterforum.net, maxiscoot/stage6/pedparts productdata, k-parts,
 * scooterforum.net blokkenvergelijkingen, ScootPartsXL motorblok-overzicht.
 * Samengevat in docs/AFSTEL-KENNISBANK.md (sectie 2, incl. bron-URL's).
 *
 * Conventies:
 * - Velden die per bouwjaar/model verschillen zijn richtlijnen: de dataset blijft
 *   klein en betrouwbaar in plaats van compleet maar fout.
 * - plugCode gebruikt 'x' als placeholder voor de hittegraad (zoals de afstelhulp).
 */

export type Orientation = 'horizontaal' | 'verticaal' | 'staand';
export type ReedType = 'carter' | 'cilinderhuis';
export type Transmission = 'vario' | 'schakel';

export interface EngineBlock {
  id: string;
  label: string;
  /** Familie-id die de afstelhulp (ENGINE_FAMILIES in lib/afstel.ts) gebruikt voor onder meer de bougie-prefix. */
  family: string;
  orientation: Orientation;
  koeling: 'AC' | 'LC' | 'AC + LC';
  reed: ReedType;
  /** Schakel = 5/6 bak (AM6, Derbi); vario = automatische CVT. */
  transmission: Transmission;
  /** Gangbare standaard-carburateurmaten (mm). */
  stockCarbMm: number[];
  /** Richtlijn powerband voor een standaard 50cc, ontgrensd. */
  stockPowerband: [number, number];
  /** Bougie-basiscode met 'x' voor de hittegraad. */
  plugCode: string;
  /** Fabrieks-restrictoren die je bij dit blok tegenkomt. */
  restrictors: string[];
  /** Populaire opvoerstages per ingestegen inhoud. */
  kits: { cc: number; note: string }[];
  /** Bekende valkuilen. */
  pitfalls: string[];
  note?: string;
}

export const ENGINE_BLOCKS: EngineBlock[] = [
  {
    id: 'minarelli-h',
    label: 'Minarelli horizontaal',
    family: 'minarelli-h',
    orientation: 'horizontaal',
    koeling: 'AC + LC',
    reed: 'carter',
    transmission: 'vario',
    stockCarbMm: [12, 16, 17.5, 19, 21],
    stockPowerband: [6500, 8000],
    plugCode: 'BRxHS',
    restrictors: ['varioring/spacer op de variobus', 'prop/vernauwing in de uitlaatflens', 'begrensde CDI/ECU (Euro4/5)'],
    kits: [
      { cc: 50, note: 'Sport: Stage6 Streetrace/Sport Pro, DR, DMP' },
      { cc: 65, note: 'Airsal Sport 65' },
      { cc: 70, note: 'Straat: Malossi Sport / Stage6 Streetrace — race: MHR / Stage6 R/T / Polini Corsa' },
    ],
    pitfalls: [
      'let op 10 vs 12 mm zuigerpen bij 70cc-kits',
      'standaardkrukas houdt het bij ongeveer 10–12 pk; bij race: versterkte krukas + C4-lagers',
      'AC-cilinders warmlopen bij 70cc zonder grotere sproeier en goede koelkap',
    ],
    note: 'Het standaard tuning-platform van de NL-scene: carter-reed en de meeste aftermarket-uitlaten.',
  },
  {
    id: 'minarelli-v',
    label: 'Minarelli verticaal',
    family: 'minarelli-v',
    orientation: 'verticaal',
    koeling: 'AC',
    reed: 'cilinderhuis',
    transmission: 'vario',
    stockCarbMm: [12],
    stockPowerband: [6500, 7800],
    plugCode: 'BRxHS',
    restrictors: ['varioring', 'prop in uitlaat', 'begrensde CDI'],
    kits: [
      { cc: 50, note: 'Stage6 Streetrace/Sport Pro (cilinder-membraan blijft)' },
      { cc: 70, note: 'Bestaat, maar beperkt in uitlaten en topsnelheid' },
    ],
    pitfalls: [
      'cilinderhuis-membraan beperkt de doorlaat; Big Valve-intake nodig voor topprestatie',
      'minder aftermarket-uitlaten dan horizontaal',
      'standaard vario/koppeling is vaak de eerste bottleneck',
    ],
    note: 'Minder extreem potentieel dan horizontaal, maar makkelijker sleutelen (geen carter-membraan).',
  },
  {
    id: 'am6',
    label: 'Minarelli AM6 (staand, schakel)',
    family: 'am6',
    orientation: 'staand',
    koeling: 'LC',
    reed: 'carter',
    transmission: 'schakel',
    stockCarbMm: [16, 17.5, 19, 21, 24],
    stockPowerband: [7000, 8500],
    plugCode: 'BRxES',
    restrictors: ['uitlaatprop/vernauwing in het spruitstuk', 'begrensde CDI/ECU (Euro4/5 = ECU-flash nodig)'],
    kits: [
      { cc: 50, note: 'DR / Airsal / MVT Iron Max / Polini 50' },
      { cc: 70, note: 'Straat: Airsal / Top Performances / Polini gietijzer-alu' },
      { cc: 80, note: 'Race: Barikit 80 Racing' },
    ],
    pitfalls: [
      'olie en keerringen van koppeling en versnellingsbak zijn zwakke punten in de basis',
      'standaardkrukas houdt 70cc race lang niet aan',
      'Euro4/5-ECU moet eerst geflasht worden voordat je ontsteking/uitlaat-afstelling doorzet',
      'ketting/tandwielverhouding bepaalt je shift-point, niet een vario (geen CVT!)',
    ],
    note: '5/6 versnellingen, natte koppeling: powerband aansturen via vertanding, niet via rollen.',
  },
  {
    id: 'derbi',
    label: 'Derbi EBE/EBS/D50B0',
    family: 'derbi',
    orientation: 'staand',
    koeling: 'LC',
    reed: 'carter',
    transmission: 'schakel',
    stockCarbMm: [16, 17.5, 19],
    stockPowerband: [7000, 8500],
    plugCode: 'BRxES',
    restrictors: ['uitlaatprop/vernauwing', 'begrensd uitlaatspruitstuk', 'CDI/ECU-begrenzing'],
    kits: [
      { cc: 50, note: 'DR / DMP / Airsal' },
      { cc: 70, note: 'Airsal 70 / Top Performances / Malossi Sport / Polini' },
      { cc: 80, note: 'Race: Metrakit ProRace / Barikit / Stage6' },
    ],
    pitfalls: [
      'GPR = taps toelopende krukas, Senda = rechte — verkeerde krukas past niet',
      'EBE vs EBS is vooral het type toerenteller-aandrijving',
      'waterpompkeerring en koppelingsveren zijn zwakke punten',
      'D50B0 Euro4: ECU en uitlaat-sensor spelen mee — check eerst de ECU',
    ],
    note: 'Zelfde tuning-aanpak als AM6; let op hoeveel blokversies er door elkaar lopen.',
  },
  {
    id: 'piaggio-ac',
    label: 'Piaggio horizontaal (AC)',
    family: 'piaggio',
    orientation: 'horizontaal',
    koeling: 'AC',
    reed: 'carter',
    transmission: 'vario',
    stockCarbMm: [12, 17.5],
    stockPowerband: [6500, 7600],
    plugCode: 'BRxES',
    restrictors: ['varioring', 'prop in uitlaat', 'begrensde CDI', 'katalysator in standaarduitlaat'],
    kits: [
      { cc: 50, note: 'DR / DMP / Motoforce / Airsal' },
      { cc: 65, note: 'Airsal 65' },
      { cc: 70, note: 'Straat: Malossi Sport / Polini Sport / Stage6 Streetrace' },
    ],
    pitfalls: [
      'AC 70cc loopt warm in stadsverkeer — grotere sproeier en goede koelkap',
      'let op de koppelingshuis-diameter (105 vs 107 mm) bij onderdelen',
      'standaardkrukas is zwak bij 70cc race',
    ],
    note: 'Het werkpaard-blok van de NL-scene (Zip, Vespa 50 2T, Fly, Typhoon).',
  },
  {
    id: 'piaggio-lc',
    label: 'Piaggio horizontaal LC (Zip SP/Runner/NRG)',
    family: 'piaggio',
    orientation: 'horizontaal',
    koeling: 'LC',
    reed: 'carter',
    transmission: 'vario',
    stockCarbMm: [12, 17.5],
    stockPowerband: [7000, 8200],
    plugCode: 'BRxES',
    restrictors: ['varioring', 'uitlaatprop', 'CDI-begrenzing', 'injectie (PureJet, 2008+)'],
    kits: [
      { cc: 50, note: 'DR / DMP / Polini 50' },
      { cc: 70, note: 'Sport: Malossi Sport / Polini Corsa / Stage6 Streetrace' },
      { cc: 80, note: 'Race: Malossi MHR Big Bore / Polini Evo / Stage6 R/T' },
    ],
    pitfalls: [
      'koelsysteem is de faalpost; standaardwaterpomp bij 70cc race opwaarderen',
      'AC-carterdelen passen niet 1:1 op LC (andere waterpomp/koppeling)',
      'PureJet (injectie) is moeilijk handmatig te tunen',
    ],
    note: 'Meer upper-end-potentieel door waterkoeling; snaarmaat voor Piaggio 2T lang carter is uniek.',
  },
  {
    id: 'peugeot-h',
    label: 'Peugeot horizontaal',
    family: 'peugeot',
    orientation: 'horizontaal',
    koeling: 'AC',
    reed: 'carter',
    transmission: 'vario',
    stockCarbMm: [12, 14],
    stockPowerband: [6500, 7600],
    plugCode: 'BRxHS',
    restrictors: ['varioring', 'prop/vernauwing in uitlaat', 'CDI', 'ECU (Euro4/5 Speedfight 4)'],
    kits: [
      { cc: 50, note: 'DMP / Top Performances 50cc 40mm / Airsal' },
      { cc: 70, note: 'Malossi MHR Replica 70 alu (populair), Polini, Stage6 Streetrace' },
    ],
    pitfalls: [
      'kleiner aftermarket-aanbod dan Minarelli/Piaggio (minder uitlaten/carters)',
      'dit blok is nooit een sportblok geweest; verwacht geen wonderen',
      'AC-koeling is nauwelijks genoeg voor 70cc op straat',
    ],
    note: 'MHR Replica alu is het exemplaar met powerband 9.000–12.000 rpm.',
  },
  {
    id: 'peugeot-v',
    label: 'Peugeot verticaal',
    family: 'peugeot',
    orientation: 'verticaal',
    koeling: 'AC + LC',
    reed: 'cilinderhuis',
    transmission: 'vario',
    stockCarbMm: [12, 14, 17.5],
    stockPowerband: [6000, 7300],
    plugCode: 'BRxHS',
    restrictors: ['varioring', 'prop in uitlaat', 'CDI-begrenzing'],
    kits: [
      { cc: 50, note: 'TNT / DMP / Motoforce (past niet op 25 km/u snorblok)' },
      { cc: 70, note: 'TNT / Airsal / Polini — budget-straat-70cc-verhaal' },
    ],
    pitfalls: [
      'snor- en bromblokken zijn niet uitwisselbaar met de cilinder',
      'AC-koeling is krap bij 70cc',
      'minder uitlaatkeuze; Peugeot-CDI-begrenzing omzeil je met een vervangende CDI',
    ],
    note: 'Laagtoerig formaat: favoriet voor budget-straat-70cc, geen raceblok.',
  },
  {
    id: 'honda-kymco',
    label: 'Honda / Kymco (verticaal)',
    family: 'honda',
    orientation: 'verticaal',
    koeling: 'AC + LC',
    reed: 'cilinderhuis',
    transmission: 'vario',
    stockCarbMm: [12, 14, 16],
    stockPowerband: [6300, 7600],
    plugCode: 'BxHSA',
    restrictors: ['varioring', 'prop in uitlaat', 'CDI'],
    kits: [
      { cc: 50, note: 'DMP / Airsal / DR' },
      { cc: 70, note: 'Klein maar aanwezig aanbod' },
    ],
    pitfalls: [
      'beperktere aftermarket dan Minarelli/Piaggio',
      'onderdelen verschillen per model (Dio/Lead: B8HS-type vs BR8HSA — check exact)',
    ],
    note: 'Controleer per model welke bougie en carbmaten exact van toepassing zijn.',
  },
];

/** Vind een blok op basis van losse bloktype-tekst (zoals in de scooter-setup). */
export function findBlockFromText(text: string | null | undefined): EngineBlock | null {
  if (!text) return null;
  const t = text.toLowerCase();
  // AM6/Derbi eerst checken: die hebben de meest specifieke labels.
  if (t.includes('am6') || t.includes('x-power') || t.includes('dt50')) return ENGINE_BLOCKS[2]!;
  if (t.includes('derbi') || t.includes('senda') || t.includes('gpr') || t.includes('d50')) return ENGINE_BLOCKS[3]!;
  if (t.includes('minarelli') || t.includes('aerox') || t.includes('booster') || t.includes('jog')) {
    return t.includes('horizontaal') || t.includes('liggend') ? ENGINE_BLOCKS[0]! : ENGINE_BLOCKS[1]!;
  }
  if (t.includes('piaggio') || t.includes('zip') || t.includes('vespa') || t.includes('runner') || t.includes('nrg')) {
    return t.includes('lc') || t.includes('watergekoeld') ? ENGINE_BLOCKS[5]! : ENGINE_BLOCKS[4]!;
  }
  if (t.includes('peugeot')) {
    return t.includes('horizontaal') || t.includes('liggend') ? ENGINE_BLOCKS[6]! : ENGINE_BLOCKS[7]!;
  }
  if (t.includes('honda') || t.includes('kymco') || t.includes('dio')) return ENGINE_BLOCKS[8]!;
  return null;
}
