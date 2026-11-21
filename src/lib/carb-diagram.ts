/**
 * Carburateurdiagram — welke onderdelen doen wat, en bij welke gasstand.
 *
 * De inhoud is algemene kennis over een eenvoudige vlottercarburateur op een
 * 2-takt (zoals de standaard Dell'Orto/Keihin-achtige carburateurs). Het is een
 * schema, geen fabrieksdoorsnede: maten en kanalen verschillen per model.
 *
 * De banden komen uit throttle-bands.ts, dezelfde bron als de afstelkaart en
 * de sproeier-simulator, zodat alle schermen dezelfde taal spreken.
 */
import {
  IDLE_MAX_PCT,
  MID_MAX_PCT,
  throttleBandLabel,
  type ThrottleBandId,
} from './throttle-bands';

/** Gasstandsband waarin een onderdeel het mengsel vooral bepaalt. */
export type CarbBand = 'altijd' | 'stationair' | 'halfgas' | 'volgas' | 'koude start';

export type CarbCircuitId = ThrottleBandId;

export type CarbPartId =
  | 'luchtfilter'
  | 'gasklep'
  | 'venturi'
  | 'naald'
  | 'naaldsproeier'
  | 'hoofdsproeier'
  | 'stationairsproeier'
  | 'luchtschroef'
  | 'vlotter'
  | 'vlotternaald'
  | 'choke'
  | 'uitgang';

export interface CarbPart {
  id: CarbPartId;
  label: string;
  /** Eén regel: wat doet dit onderdeel. */
  role: string;
  /** Waar het mengsel door dit onderdeel vooral bepaald wordt. */
  band: CarbBand;
  /** Wat je merkt als het niet klopt of verkeerd staat. */
  symptoms: string[];
  /** Wat je eraan kunt stellen of vervangen. */
  adjust: string;
}

export const CARB_BAND_LABELS: Record<CarbBand, string> = {
  altijd: 'altijd actief',
  stationair: throttleBandLabel('idle'),
  halfgas: throttleBandLabel('mid'),
  volgas: throttleBandLabel('full'),
  'koude start': 'alleen koude start',
};

export const CARB_PARTS: CarbPart[] = [
  {
    id: 'luchtfilter',
    label: 'Luchtfilter',
    role: 'Filtert de lucht voordat die de carburateur in gaat.',
    band: 'altijd',
    symptoms: [
      'Een verstopt of nat filter laat minder lucht door: het mengsel wordt over het hele bereik armer.',
      'Een open filter laat meer lucht door en vraagt meestal een ruimere sproeierbezetting.',
    ],
    adjust: 'Reinigen of vervangen, en daarna de sproeiers controleren. Nooit filter én sproeier tegelijk wijzigen.',
  },
  {
    id: 'gasklep',
    label: 'Gasklep / schuif',
    role: 'De schuif bepaalt hoeveel lucht er door de venturi stroomt, en sleept de gasnaald mee.',
    band: 'altijd',
    symptoms: [
      'Blijft de schuif hangen, dan blijft het toerental hangen of zakt het niet terug.',
      'Een scheve of kromme schuif geeft een onregelmatig stationair toerental.',
    ],
    adjust: 'Kabelspanning en gasklepaanslag controleren; schuif er recht in laten zakken.',
  },
  {
    id: 'venturi',
    label: 'Venturi',
    role: 'De vernauwing in het huis: daar gaat de lucht sneller stromen en zuigt hij brandstof mee.',
    band: 'altijd',
    symptoms: [
      'Een grotere venturi geeft meer mengsel bij volgas, maar minder signaal bij lage gasstanden.',
      'Bij een te grote carburateur op een klein blok wordt hij lastig stationair af te stellen.',
    ],
    adjust: 'Vast onderdeel van het carburateurhuis — hier kies je een andere carburateurmaat voor.',
  },
  {
    id: 'naald',
    label: 'Gasnaald',
    role: 'Hangt aan de schuif en regelt met de clipstand hoeveel brandstof er bij halfgas meekomt.',
    band: 'halfgas',
    symptoms: [
      'Te arm rond halfgas: dip of hikken bij rustig accelereren.',
      'Te rijk rond halfgas: pruttelen en meer verbruik zonder extra vermogen.',
    ],
    adjust: 'Clipje één stand verzetten. Lager clipje = naald hoger = rijker mengsel.',
  },
  {
    id: 'naaldsproeier',
    label: 'Naaldsproeier (verstuiverbuis)',
    role: 'De buis waar de naald in schuift; samen met de naald bepaalt die de brandstof bij halfgas.',
    band: 'halfgas',
    symptoms: [
      'Ingesleten of ovale buis geeft een mengsel dat per gasstand onvoorspelbaar wordt.',
      'Een verkeerde buis maakt afstellen op de naald bijna onmogelijk.',
    ],
    adjust: 'Vervangen bij zichtbare slijtage; daarna opnieuw met de clipstand beginnen.',
  },
  {
    id: 'hoofdsproeier',
    label: 'Hoofdsproeier',
    role: 'Bepaalt de brandstof bij 3/4 tot volgas.',
    band: 'volgas',
    symptoms: [
      'Te klein: arm mengsel, hoge temperaturen, risico op een warmloper.',
      'Te groot: viertakten bij volgas, natte bougie en meer verbruik.',
    ],
    adjust: 'Eén maat per test wijzigen en daarna een korte volgas-test met bougiecontrole.',
  },
  {
    id: 'stationairsproeier',
    label: 'Stationairsproeier',
    role: 'Levert de brandstof bij gesloten gas, samen met de luchtschroef.',
    band: 'stationair',
    symptoms: [
      'Te klein: slecht starten, hangende toeren of afslaan bij gas loslaten.',
      'Te groot: natte bougie, onrustig stationair toerental en stinkende uitlaat.',
    ],
    adjust: 'Eerst luchtschroef goed zetten, pas daarna de stationairsproeier een maat wijzigen.',
  },
  {
    id: 'luchtschroef',
    label: 'Luchtschroef',
    role: 'Stelt de lucht bij het stationaircircuit: verder uit is meer lucht en dus armer.',
    band: 'stationair',
    symptoms: [
      'Verkeerd afgesteld geeft een onrustig stationair toerental of een trage terugkeer naar stationair.',
      'Te ver ingedraaid laat hem onderin verzuipen.',
    ],
    adjust: 'Rond 1,5 slag uit beginnen en per kwartslag stellen met warme motor.',
  },
  {
    id: 'vlotter',
    label: 'Vlotter',
    role: 'Houdt het brandstofniveau in de vlotterkamer constant.',
    band: 'altijd',
    symptoms: [
      'Een lekke vlotter laat het niveau zakken: arm mengsel en afslaan in bochten.',
      'Een vlotter die blijft hangen laat de kamer overlopen.',
    ],
    adjust: 'Vervangen bij lek of blijven hangen; daarna het niveau controleren.',
  },
  {
    id: 'vlotternaald',
    label: 'Vlotternaald',
    role: 'Opent en sluit met de vlotter de brandstoftoevoer.',
    band: 'altijd',
    symptoms: [
      'Vuil op de naald houdt de toevoer open: brandstof loopt uit de overloop.',
      'Een versleten naald houdt het niveau niet stabiel.',
    ],
    adjust: 'Samen met de vlotter vervangen en de brandstoftoevoer schoonmaken.',
  },
  {
    id: 'choke',
    label: 'Choke',
    role: 'Geeft extra brandstof (of minder lucht) bij een koude start.',
    band: 'koude start',
    symptoms: [
      'Blijft de choke open staan, dan is het mengsel overal te rijk en viertakt hij.',
      'Sluit hij niet, dan start hij koud slecht.',
    ],
    adjust: 'Kabel en veer controleren zodat hij vanzelf terugkomt. Niet door de gasstand bepaald.',
  },
  {
    id: 'uitgang',
    label: 'Mengsel naar de motor',
    role: 'Hier komen lucht en brandstof samen het spruitstuk en de cilinder in.',
    band: 'altijd',
    symptoms: [
      'Valse lucht bij de aansluiting maakt elk mengsel armer, ook al staan de sproeiers goed.',
      'Een losse of gescheurde spruitstukpakking geeft een onregelmatig stationair toerental.',
    ],
    adjust: 'Pakking en klem controleren op valse lucht vóór je aan sproeiers begint.',
  },
];

export const CARB_PARTS_BY_ID: Record<CarbPartId, CarbPart> = CARB_PARTS.reduce(
  (acc, part) => {
    acc[part.id] = part;
    return acc;
  },
  {} as Record<CarbPartId, CarbPart>,
);

/** Grenzen van de gasstandsbanden, in procenten gas (bron: throttle-bands.ts). */
export { IDLE_MAX_PCT, MID_MAX_PCT };

export interface CarbThrottleBand {
  id: CarbCircuitId;
  /** Bij welke gasstand hoort dit. */
  range: string;
  /** Welk circuit/deel van de carburateur dit bereik bepaalt. */
  component: string;
  /** Waarom dat zo is, in één of twee zinnen. */
  why: string;
}

export const CARB_THROTTLE_BANDS: Record<CarbCircuitId, CarbThrottleBand> = {
  idle: {
    id: 'idle',
    range: throttleBandLabel('idle'),
    component: 'Stationaircircuit: stationairsproeier en luchtschroef',
    why: 'De schuif staat bijna dicht en de luchtstroom is klein. Daarom doet het aparte stationairkanaal hier het werk.',
  },
  mid: {
    id: 'mid',
    range: throttleBandLabel('mid'),
    component: 'Gasnaald en naaldsproeier',
    why: 'De schuif is deels open; de naald hangt in de verstuiverbuis en bepaalt met zijn clipstand het mengsel.',
  },
  full: {
    id: 'full',
    range: throttleBandLabel('full'),
    component: 'Hoofdsproeier',
    why: 'De schuif staat (bijna) helemaal open en de naald is uit de buis: nu bepaalt de hoofdsproeier de brandstof.',
  },
};

/** Klemt de gasstand op 0–100 %. */
export function clampThrottle(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

/** Welk circuit bij deze gasstand hoort. */
export function circuitAt(pct: number): CarbCircuitId {
  const t = clampThrottle(pct);
  if (t < IDLE_MAX_PCT) return 'idle';
  if (t <= MID_MAX_PCT) return 'mid';
  return 'full';
}

export function bandAt(pct: number): CarbThrottleBand {
  return CARB_THROTTLE_BANDS[circuitAt(pct)];
}

/**
 * Onderdelen die bij deze gasstand het mengsel bepalen.
 * Altijd-actieve delen (lucht, vlotter, huis) horen er ook bij; de choke nooit,
 * want die hoort bij een koude start en niet bij een gasstand.
 */
export function activePartsAt(pct: number): CarbPartId[] {
  const circuit = circuitAt(pct);
  const band: CarbBand = circuit === 'idle' ? 'stationair' : circuit === 'mid' ? 'halfgas' : 'volgas';
  return CARB_PARTS.filter((p) => p.band === 'altijd' || p.band === band).map((p) => p.id);
}

/**
 * Het circuit in de sproeier-simulator waar dit onderdeel het mengsel bepaalt.
 * Onderdelen die altijd meetellen (lucht, vlotter, huis, choke) hebben er geen:
 * die horen bij elke gasstand en dus bij geen enkele band.
 */
export function circuitForPart(id: CarbPartId): CarbCircuitId | null {
  const band = CARB_PARTS_BY_ID[id].band;
  if (band === 'stationair') return 'idle';
  if (band === 'halfgas') return 'mid';
  if (band === 'volgas') return 'full';
  return null;
}

export function isPartActiveAt(part: CarbPart, pct: number): boolean {
  return activePartsAt(pct).includes(part.id);
}

/** Korte samenvatting voor onder het diagram. */
export function throttleSummary(pct: number): string {
  const t = Math.round(clampThrottle(pct));
  if (t === 0) return 'Gas dicht: het stationaircircuit doet al het werk, de schuif staat op zijn aanslag.';
  if (t === 100) return 'Volgas: de schuif staat helemaal open en de hoofdsproeier bepaalt de brandstof.';
  const circuit = circuitAt(t);
  if (circuit === 'idle') return `Bij ${t}% gas zit je nog in het stationaircircuit.`;
  if (circuit === 'mid') return `Bij ${t}% gas bepalen de gasnaald en de naaldsproeier het mengsel.`;
  return `Bij ${t}% gas doet de hoofdsproeier al het grootste deel van het werk.`;
}
