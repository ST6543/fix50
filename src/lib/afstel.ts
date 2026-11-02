/**
 * Afstelhulp — rekenmodellen voor carburateur en CVT.
 *
 * Pure functies, geen React en geen netwerk: zo zijn de winsten direct te testen.
 * Interceptieniveaus zijn richtlijnen ("startpunt om af te stellen"), geen exacte waarden.
 */

// ── Carburateur ────────────────────────────────────────────────────────

export type CarbMaterial = 'ijzer' | 'alu';
export type CarbSetupType = 'stock' | 'sport' | 'midrace' | 'safe';
export type Cooling = 'AC' | 'LC';

export const CARB_SETUP_LABELS: Record<CarbSetupType, string> = {
  stock: 'Standaard / lichte sport',
  sport: 'Sport straatgebruik',
  midrace: 'Midrace / hoogtoerig',
  safe: 'Inrijden / extra veilig',
};

export interface EngineFamily {
  id: string;
  label: string;
  plug: string | null;
}

export const ENGINE_FAMILIES: EngineFamily[] = [
  { id: 'minarelli-h', label: 'Minarelli horizontaal', plug: 'BRxHS' },
  { id: 'minarelli-v', label: 'Minarelli verticaal', plug: 'BRxHS' },
  { id: 'piaggio', label: 'Piaggio (Zip · Runner · Vespa)', plug: 'BPRxES' },
  { id: 'peugeot', label: 'Peugeot', plug: 'BRxHS' },
  { id: 'am6', label: 'Minarelli AM6 (schakel)', plug: 'BRxES' },
  { id: 'derbi', label: 'Derbi EBE/EBS/D50B0', plug: 'BRxES' },
  { id: 'honda', label: 'Honda / Kymco', plug: 'BRxHSA' },
  { id: 'onbekend', label: 'Onbekend / universeel', plug: null },
];

export interface CarbInput {
  /** Cilinderinhoud in cc. */
  cc: number;
  /** Carburateur-maat in mm (boorgroep). */
  carbMm: number;
  material: CarbMaterial;
  setupType: CarbSetupType;
  cooling: Cooling;
  /** Id uit ENGINE_FAMILIES — bepaalt de bougie-aanbeveling. */
  engineFamilyId?: string;
}

export interface CarbResult {
  jetLow: number;
  jetHigh: number;
  /** Naaldclip positie, geteld vanaf boven. */
  clip: number;
  /** Aanbevolen hittegraad. */
  heat: number;
  /** NGK-code zoals "BR9HS", of null bij onbekend blok. */
  plug: string | null;
  /** Richtpunt powerband in rpm. */
  powerbandRpm: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function calculateCarb(input: CarbInput): CarbResult {
  const { cc, carbMm, material, setupType, cooling } = input;
  const family = ENGINE_FAMILIES.find((f) => f.id === input.engineFamilyId) ?? null;

  let base = 52 + (cc - 50) * 0.72 + (carbMm - 12.5) * 3.15;
  if (material === 'alu') base += 3;
  if (cooling === 'AC') base += 3;
  else base -= 1;
  if (setupType === 'stock') base -= 4;
  if (setupType === 'sport') base += 2;
  if (setupType === 'midrace') base += 7;
  if (setupType === 'safe') base += 6;

  const jetLow = clamp(roundTo(base - 3, 1), 55, 135);
  const jetHigh = clamp(roundTo(base + 4, 1), 58, 140);

  let clip = 3;
  if (carbMm >= 21 || setupType === 'midrace') clip = 4;
  if (setupType === 'stock' && carbMm <= 17.5) clip = 2;
  if (setupType === 'safe') clip = Math.min(4, clip + 1);
  if (cooling === 'AC' && setupType !== 'stock') clip = Math.min(5, clip + 1);

  let heat = 8;
  if (cc <= 50 && setupType === 'stock') heat = 7;
  if (cc >= 80 || setupType === 'midrace') heat = 9;
  if (cooling === 'LC' && heat < 9 && cc >= 70) heat += 1;

  const plug = family?.plug ? family.plug.replace('x', String(heat)) : null;

  let rpm = 6800 + (cc - 50) * 34 + (carbMm - 12.5) * 105;
  if (setupType === 'stock') rpm -= 350;
  if (setupType === 'sport') rpm += 450;
  if (setupType === 'midrace') rpm += 1200;
  if (material === 'alu') rpm += 550;
  else rpm -= 200;
  const powerbandRpm = Math.round(rpm / 100) * 100;

  return { jetLow, jetHigh, clip, heat, plug, powerbandRpm };
}

/** Afstelkaart: welk carburateuronderdeel beheert welke gasstand. */
export const THROTTLE_MAP: { range: string; component: string }[] = [
  { range: '0 tot ±1/8 gas', component: 'Stationaircircuit, luchtschroef en gasklepaanslag' },
  { range: '±1/8 tot ±3/4 gas', component: 'Vooral de gasnaald en clippositie' },
  { range: '±3/4 tot volgas', component: 'Vooral de hoofdsproeier en brandstoftoevoer' },
];

export interface CarbDiagnosis {
  id: 'arm' | 'rich' | 'mid' | 'idle' | 'start';
  label: string;
  title: string;
  advice: string;
  nextStep: string;
}

export const CARB_DIAGNOSES: CarbDiagnosis[] = [
  {
    id: 'arm',
    label: 'Bokt of valt weg bij volgas',
    title: 'Mogelijk te arm of brandstoftoevoer tekort',
    advice:
      'Controleer eerst op valse lucht en brandstoftoevoer. Is dat in orde, monteer dan een grotere hoofdsproeier en test opnieuw. Blijf niet volgas rijden met een wit/grijze bougie of pingelen.',
    nextStep: 'Stop met volgas testen. Controleer valse lucht en brandstoftoevoer, monteer daarna een grotere hoofdsproeier.',
  },
  {
    id: 'rich',
    label: 'Pruttelt of viertakt bij volgas',
    title: 'Mogelijk te rijk',
    advice:
      'Controleer of de choke volledig sluit. Daarna kun je één of enkele sproeiermaten kleiner testen. Een nat-zwarte bougie kan ook door zwakke ontsteking of een te koude bougie komen.',
    nextStep: 'Controleer eerst of de choke volledig sluit. Test daarna één of twee sproeiermaten kleiner.',
  },
  {
    id: 'mid',
    label: 'Dip rond halfgas',
    title: 'Gasnaald of clippositie controleren',
    advice:
      'Pas de gasnaald aan. Clip omlaag betekent de naald omhoog en dus rijker mengsel. Clip omhoog betekent armer. Verander steeds maar één stap.',
    nextStep: 'Verplaats de naaldclip één positie en test opnieuw rond halfgas. Verander maar één stap tegelijk.',
  },
  {
    id: 'idle',
    label: 'Hangende of onrustige stationairloop',
    title: 'Stationaircircuit of valse lucht',
    advice:
      'Hangende toeren wijzen vaak op een arm stationairmengsel of valse lucht. Controleer spruitstuk, pakkingen, keerringen en stationairsproeier.',
    nextStep: 'Controleer eerst op valse lucht rond spruitstuk, pakkingen en keerringen.',
  },
  {
    id: 'start',
    label: 'Slecht starten',
    title: 'Choke, stationairsproeier, compressie en bougie',
    advice:
      'Controleer choke, stationairsproeier, bougie, compressie en membraan. Moet je steeds benzine inspuiten om hem te starten, dan is het stationaircircuit waarschijnlijk te arm of verstopt.',
    nextStep:
      'Controleer choke en stationaircircuit. Reinig de stationairsproeier en controleer daarna bougie en compressie.',
  },
];

/** Bougie-lezen na een volgas-test (plug chop), het liefst met een nieuwe bougie. */
export const PLUG_READING = [
  { id: 'rijk', label: 'Te rijk', desc: 'Zwart, nat of olieachtig. Roet op de isolator.' },
  { id: 'goed', label: 'Goed', desc: 'Middenbruin / koffiekleur, droog en egaal.' },
  { id: 'arm', label: 'Te arm', desc: 'Wit tot lichtgrijs, spikkels of blaasjes. Direct rijker!' },
] as const;

export const PLUG_READING_NOTE =
  'Lees een nieuwe of schone bougie pas na 10–20 minuten rijden. De kleur na een volgas-test (plug chop) zegt meer dan na stationair draaien.';

// ── CVT (variatieur, drukveer, trekveren, snaar) ──────────────────────

export interface CvtSpring {
  value: number;
  label: string;
  detail: string;
}

export const CVT_SPRINGS: CvtSpring[] = [
  { value: 100, label: 'Origineel', detail: '100%' },
  { value: 130, label: 'Wit', detail: '130%' },
  { value: 160, label: 'Groen', detail: '160%' },
  { value: 182, label: 'Paars', detail: '182%' },
  { value: 206, label: 'Blauw', detail: '206%' },
  { value: 214, label: 'Zwart', detail: '214%' },
];

export interface CvtEnginePreset {
  label: string;
  min: number;
  max: number;
}

export const CVT_ENGINE_PRESETS: CvtEnginePreset[] = [
  { label: '50cc standaard', min: 6000, max: 7800 },
  { label: '70cc sport', min: 7600, max: 9000 },
  { label: '70cc midrace', min: 9500, max: 10500 },
  { label: '70cc race', min: 9000, max: 11000 },
  { label: '4T / GY6', min: 5500, max: 7500 },
];

export interface CvtCarterPreset {
  id: 'short' | 'mid' | 'long';
  label: string;
  detail: string;
  idealBelt: number;
  topBase: number;
  launchBonus: number;
}

export const CVT_CARTER_PRESETS: CvtCarterPreset[] = [
  {
    id: 'short',
    label: 'Kort carter / kleine wielen',
    detail: '10 inch wielen · snelle reactie, minder theoretische top',
    idealBelt: 730,
    topBase: 72,
    launchBonus: 1.1,
  },
  {
    id: 'mid',
    label: 'Normaal scooter carter',
    detail: '12 inch wielen · gemiddelde allround setup',
    idealBelt: 765,
    topBase: 82,
    launchBonus: 0,
  },
  {
    id: 'long',
    label: 'Lang carter / groter wiel',
    detail: '14 tot 16 inch wielen · meer bereik/top, vaak rustiger launch',
    idealBelt: 810,
    topBase: 92,
    launchBonus: -0.7,
  },
];

export interface CvtState {
  /** Rollengewicht in gram (0.5g stappen). */
  roller: number;
  /** Index in CVT_SPRINGS. */
  springIndex: number;
  /** V-snaarlengte in mm. */
  belt: number;
  /** Trekveren: 1 = mild, 2 = medium, 3 = strak. */
  clutch: number;
  /** Powerband begin (rpm). */
  pbMin: number;
  /** Powerband einde (rpm). */
  pbMax: number;
  /** Index in CVT_CARTER_PRESETS. */
  carterIndex: number;
}

export interface CvtModel {
  shiftRpm: number;
  clutchRpm: number;
  /** Gerelativeerd top-indicatie. */
  topSpeed: number;
  launchScore: number;
  balanceScore: number;
  data: { speed: number; rpm: number | null }[];
  verdict: string;
  advice: string;
  beltDiff: number;
  idealBelt: number;
  overrevSeverity: number;
  bogSeverity: number;
}

export function cvtSpringLabel(index: number): string {
  const s = CVT_SPRINGS[index] ?? CVT_SPRINGS[1]!;
  return `${s.label} ${s.detail}`;
}

export function cvtClutchLabel(value: number): string {
  return value === 1 ? 'mild' : value === 2 ? 'medium' : 'strak';
}

export function cvtSpeedLabel(value: number): string {
  if (value < 35) return 'traag';
  if (value < 48) return 'sloom';
  if (value < 60) return 'redelijk';
  if (value < 72) return 'vlot';
  if (value < 84) return 'snel';
  if (value < 96) return 'erg snel';
  return 'erg bovenverwachting';
}

/** Simulatie van snelheidsopbouw vs. toerental voor een CVT-setup. */
export function calculateCvt(input: CvtState): CvtModel {
  const spring = CVT_SPRINGS[input.springIndex] ?? CVT_SPRINGS[1]!;
  const drive = CVT_CARTER_PRESETS[input.carterIndex] ?? CVT_CARTER_PRESETS[1]!;
  const contra = spring.value;
  const powerbandCenter = (input.pbMin + input.pbMax) / 2;
  const powerbandWidth = input.pbMax - input.pbMin;
  const idealRoller = 9.5;
  const idealBelt = drive.idealBelt;

  // Rollen en drukveer werken tegen elkaar in.
  // Lichte rollen + sterke drukveer = overrev: veel rpm, weinig snelheid.
  // Zware rollen + slappe drukveer = bogging: lage rpm, vroeg opschakelen, lui optrekken.
  const springLoad = (contra - 130) / 38; // ruwe "gram-equivalent" tegenkracht
  const cvtBalance = (input.roller - idealRoller) - springLoad;
  const overrevSeverity = clamp((-cvtBalance - 1.3) / 4.2, 0, 1);
  const bogSeverity = clamp((cvtBalance - 1.3) / 4.2, 0, 1);
  const mismatchSeverity = Math.max(overrevSeverity, bogSeverity);

  const beltDiff = input.belt - idealBelt;
  const beltMismatch = Math.abs(beltDiff);
  const beltSeverity = clamp((beltMismatch - 12) / 45, 0, 1);

  const clutchRpm = 3200 + input.clutch * 850;

  // Goede setup blijft rond de powerband; slechte setup zichtbaar erboven of eronder.
  const shiftRpm = powerbandCenter - cvtBalance * 430 + (contra - 130) * 2.2;
  const overrevRpm = powerbandCenter + 1300 + overrevSeverity * 1700;
  const bogRpm = powerbandCenter - 1300 - bogSeverity * 1300;
  const workingRpm = overrevSeverity > 0 ? overrevRpm : bogSeverity > 0 ? bogRpm : shiftRpm;

  const rollerPenalty = Math.abs(input.roller - idealRoller) * 1.3;
  const springPenalty = Math.max(0, input.springIndex - 1) * 2.1 + Math.max(0, 1 - input.springIndex) * 0.8;
  const beltPenalty = beltMismatch * 0.2 + Math.max(0, beltMismatch - 18) * 0.35;
  const narrowPowerbandPenalty = Math.max(0, 1700 - powerbandWidth) * 0.002;
  const poorTunePenalty = overrevSeverity * 18 + bogSeverity * 16 + beltSeverity * 12;
  const slightLongBeltBonus = beltDiff > 0 && beltDiff < 18 ? beltDiff * 0.06 : 0;

  const topSpeed = clamp(
    drive.topBase -
      rollerPenalty -
      springPenalty -
      beltPenalty -
      narrowPowerbandPenalty -
      poorTunePenalty +
      slightLongBeltBonus,
    24,
    105,
  );

  const launchScore = clamp(
    6 +
      drive.launchBonus +
      (input.clutch - 2) * 1.4 +
      (10 - input.roller) * 0.45 +
      (contra - 130) * 0.01 -
      beltSeverity * 2.2 -
      bogSeverity * 3.2 -
      overrevSeverity * 1.4,
    1,
    10,
  );

  const rpmOutsidePowerband = Math.max(0, workingRpm - input.pbMax) + Math.max(0, input.pbMin - workingRpm);
  const geometryPenalty = beltMismatch / 8 + Math.abs(input.roller - idealRoller) * 0.45 + Math.abs(contra - 130) / 22;
  const powerbandPenalty = rpmOutsidePowerband / Math.max(120, powerbandWidth * 0.14);
  const balanceScore = clamp(10 - powerbandPenalty - geometryPenalty - mismatchSeverity * 4.5 - beltSeverity * 3, 1, 10);

  const data: CvtModel['data'] = [];
  for (let speed = 0; speed <= 105; speed += 3) {
    let rpm: number | null;
    const progress = topSpeed <= 0 ? 1 : speed / topSpeed;

    if (speed > topSpeed) {
      rpm = null;
    } else if (speed < 8) {
      rpm = 1800 + (speed / 8) * (clutchRpm - 1800);
    } else if (overrevSeverity > 0) {
      // Overrev: rpm schiet snel omhoog en blijft te hoog terwijl snelheid beperkt doorloopt.
      const climb = clamp((speed - 8) / 16, 0, 1);
      rpm = clutchRpm + climb * (workingRpm - clutchRpm) + Math.sin(speed / 4) * 70;
      if (progress > 0.78) rpm -= (progress - 0.78) * 450;
    } else if (bogSeverity > 0) {
      // Bogging: motor blijft onder de powerband en klimt pas laat wat bij.
      const climb = clamp((speed - 8) / Math.max(22, topSpeed * 0.65), 0, 1);
      rpm = clutchRpm + climb * (workingRpm - clutchRpm) + progress * 450 + Math.sin(speed / 8) * 45;
    } else {
      // Goede setup: rpm klimt naar powerband en blijft redelijk stabiel.
      const climb = clamp((speed - 8) / 18, 0, 1);
      rpm = clutchRpm + climb * (workingRpm - clutchRpm) + Math.sin(speed / 7) * 85;
      if (progress > 0.78) rpm -= (progress - 0.78) * 380;
    }

    data.push({ speed, rpm: rpm === null ? null : Math.round(clamp(rpm, 1500, 12000)) });
  }

  let verdict = 'Redelijk';
  let advice = 'Deze setup werkt waarschijnlijk bruikbaar, maar er is vaak winst te halen.';

  if (beltMismatch > 25) {
    verdict = 'Snaar past niet logisch';
    advice = `Deze snaar wijkt sterk af van wat bij "${drive.label.toLowerCase()}" hoort. Check eerst snaarmaat en bereik voordat je rollen gaat offeren.`;
  } else if (overrevSeverity > 0.65) {
    verdict = 'Overrev';
    advice =
      'Veel te lichte rollen of veel te strakke drukveer. Hij maakt toeren alsof hij ontsnapt, maar snelheid bouwt slecht op. Zwaardere rollen of lichtere drukveer.';
  } else if (bogSeverity > 0.65) {
    verdict = 'Te vroeg opschakelen';
    advice =
      'Rollen te zwaar of drukveer te slap. Hij zakt onder de powerband en voelt lui. Lichtere rollen of iets sterkere drukveer.';
  } else if (balanceScore <= 3) {
    verdict = 'Slecht afgestemd';
    advice =
      'Deze combinatie zit ver buiten logische waarden voor dit cartertype en deze powerband. Begin dichter bij passende snaarlengte, middenrollen en een normale drukveer.';
  } else if (workingRpm > input.pbMax + 250) {
    verdict = 'Te veel toeren';
    advice = 'Rollen zwaarder of lichtere drukveer proberen. Hij draait boven de powerband en maakt dus vooral theater.';
  } else if (workingRpm < input.pbMin - 250) {
    verdict = 'Te lui';
    advice = 'Rollen lichter of sterkere drukveer proberen. Hij valt onder zijn powerband.';
  } else if (topSpeed < 68 && drive.id !== 'short') {
    verdict = 'Top beperkt';
    advice = 'Check snaarlengte, variateurbereik en achterpoelie. Grote afwijkingen in snaarmaat verpesten verrassend veel.';
  } else if (launchScore > 8.5 && balanceScore > 7.5) {
    verdict = 'Lekker fel';
    advice = 'Goede straatsetup: sterke launch en nog bruikbaar bovenin.';
  } else if (balanceScore > 8) {
    verdict = 'Netjes in balans';
    advice = 'Deze combinatie zit dicht bij een bruikbare allround afstelling voor dit cartertype en deze powerband.';
  }

  return { shiftRpm: workingRpm, clutchRpm, topSpeed, launchScore, balanceScore, data, verdict, advice, beltDiff, idealBelt, overrevSeverity, bogSeverity };
}

// ── CVT-symptomen → afstelrichting ────────────────────────────────────

export interface CvtSymptom {
  id: string;
  label: string;
  priority: 'hoog' | 'middel';
  advice: string;
  affects: { roller?: number; springIndex?: number; clutch?: number; beltToIdeal?: boolean };
}

export const CVT_SYMPTOMS: CvtSymptom[] = [
  {
    id: 'screams_no_speed',
    label: 'Veel toeren, weinig snelheid',
    priority: 'hoog',
    advice:
      'Waarschijnlijk rollen te licht of drukveer te strak. Probeer eerst 0.5–1g zwaardere rollen. Blijft hij hangen, ga naar een lichtere drukveer.',
    affects: { roller: 1, springIndex: -1 },
  },
  {
    id: 'lazy_launch',
    label: 'Lui met wegrijden',
    priority: 'hoog',
    advice:
      'Waarschijnlijk grijpt de koppeling te vroeg aan of zakt het blok onder de powerband. Probeer iets strakkere trekveren. Als hij daarna nog lui blijft: 0.5g lichtere rollen.',
    affects: { clutch: 1, roller: -0.5 },
  },
  {
    id: 'bogs_down',
    label: 'Zakt in toeren bij optrekken',
    priority: 'hoog',
    advice:
      'Meestal rollen te zwaar of drukveer te slap. Begin met 0.5–1g lichtere rollen. Als hij bij heuvel/tegenwind blijft inzakken: iets sterkere drukveer.',
    affects: { roller: -1, springIndex: 1 },
  },
  {
    id: 'late_takeoff',
    label: 'Hij jankt eerst en vertrekt dan pas',
    priority: 'middel',
    advice:
      'Trekveren zijn waarschijnlijk te strak. Ga een stap slapper. Launch moet fel zijn, niet alsof hij eerst toestemming vraagt aan de buurt.',
    affects: { clutch: -1 },
  },
  {
    id: 'low_top',
    label: 'Topsnelheid valt tegen',
    priority: 'hoog',
    advice:
      'Check eerst de stift-test op de variateur en of de snaar logisch is voor jouw cartertype. Komt de snaar niet bovenin? Kijk naar juiste snaar, zwaardere rollen of lichtere drukveer.',
    affects: { roller: 0.5, springIndex: -1, beltToIdeal: true },
  },
  {
    id: 'slow_backshift',
    label: 'Reageert traag bij tegenwind/heuvel',
    priority: 'middel',
    advice:
      'De CVT schakelt niet snel genoeg terug. Probeer een iets sterkere drukveer. Niet meteen de sterkste veer erin rammen.',
    affects: { springIndex: 1 },
  },
  {
    id: 'shudder_start',
    label: 'Schokt/trilt bij wegrijden',
    priority: 'middel',
    advice:
      'Check eerst koppeling, bel en snaar op vet/slijtage. Als alles schoon en goed is: trekveren iets aanpassen en koppeling laten aangrijpen in een rustiger gebied.',
    affects: { clutch: 1 },
  },
  {
    id: 'belt_not_reaching_top',
    label: 'Snaar komt niet bovenin variateur',
    priority: 'hoog',
    advice:
      'Eerst snaarmaat tegenover cartertype checken. Een lange snaar op een kort carter is niet hetzelfde als een lange snaar op een lang carter. Daarna pas rollen/drukveer aanpassen.',
    affects: { roller: 0.5, springIndex: -1, beltToIdeal: true },
  },
];

export interface CvtDiagnosis {
  title: string;
  summary: string;
  steps: string[];
  suggested: CvtState;
}

/** Zet symptomen om in een voorgestelde afstelrichting ten opzichte van de huidige setup. */
export function diagnoseCvtSymptoms(state: CvtState, symptomIds: string[]): CvtDiagnosis {
  const selected = CVT_SYMPTOMS.filter((s) => symptomIds.includes(s.id));
  const drive = CVT_CARTER_PRESETS[state.carterIndex] ?? CVT_CARTER_PRESETS[1]!;

  if (selected.length === 0) {
    return {
      title: 'Geen symptomen gekozen',
      summary: 'Kies wat je scooter doet, dan vertelt de tool welke kant je op moet afstellen.',
      steps: [
        'Test altijd met warme motor',
        'Verander maar één ding tegelijk',
        'Begin bij rollen, daarna drukveer, trekveren als laatste',
      ],
      suggested: state,
    };
  }

  const score = { roller: 0, springIndex: 0, clutch: 0 };
  let beltToIdeal = false;
  selected.forEach((s) => {
    if (typeof s.affects.roller === 'number') score.roller += s.affects.roller;
    if (typeof s.affects.springIndex === 'number') score.springIndex += s.affects.springIndex;
    if (typeof s.affects.clutch === 'number') score.clutch += s.affects.clutch;
    if (s.affects.beltToIdeal) beltToIdeal = true;
  });

  const suggested: CvtState = {
    ...state,
    roller: clamp(Math.round((state.roller + score.roller) * 2) / 2, 3, 13),
    springIndex: clamp(Math.round(state.springIndex + score.springIndex), 0, CVT_SPRINGS.length - 1),
    belt: beltToIdeal ? drive.idealBelt : state.belt,
    clutch: clamp(Math.round(state.clutch + score.clutch), 1, 3),
  };

  const steps: string[] = [];
  if (state.belt !== drive.idealBelt && beltToIdeal) {
    steps.push(`Eerst stift-test en snaarmaat checken. Voor jouw gekozen cartertype is rond ${drive.idealBelt}mm logisch.`);
  }
  if (Math.abs(score.roller) > 0) {
    steps.push(score.roller > 0 ? 'Probeer eerst iets zwaardere rollen.' : 'Probeer eerst iets lichtere rollen.');
  }
  if (score.springIndex !== 0) {
    steps.push(
      score.springIndex > 0
        ? 'Als hij nog inzakt: drukveer één kleur/stap sterker.'
        : 'Als hij blijft hangen in toeren: drukveer één kleur/stap lichter.',
    );
  }
  if (score.clutch !== 0) {
    steps.push(
      score.clutch > 0
        ? 'Voor meer launch: trekveren één stap strakker.'
        : 'Bij te laat aangrijpen: trekveren één stap slapper.',
    );
  }
  steps.push('Test opnieuw op dezelfde route en verander daarna pas het volgende onderdeel.');

  return {
    title: selected.length === 1 ? 'Waarschijnlijke oorzaak' : 'Gecombineerde diagnose',
    summary: selected.map((s) => s.advice).join(' '),
    steps,
    suggested,
  };
}

export { calculateCarb };
