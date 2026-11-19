/**
 * Sproeier-simulator: vergelijkt de huidige carburateurinstelling met het
 * startadvies en vertaalt dat per gasstand naar een mengselrichting.
 *
 * Dit is een richtlijn op basis van verhoudingen, geen meting: de werkelijke
 * mengverhouding hangt ook af van luchtstroming, belasting en luchtdruk.
 */
import type { CarbResult } from './afstel';
import { throttleBandLabel, type ThrottleBandId } from './throttle-bands';

export type Mixture = 'arm' | 'iets arm' | 'goed' | 'iets rijk' | 'rijk';
export type CircuitId = ThrottleBandId;

export interface JetInput {
  /** Startadvies uit calculateCarb. */
  start: CarbResult;
  /** Gemonteerde hoofdsproeier. */
  mainJet: number;
  /** Gemonteerde stationairsproeier. */
  idleJet: number;
  /** Naaldclip, geteld vanaf boven (1 = hoogste stand = armst). */
  clip: number;
  /** Lucht-/mengselschroef in slagen uit. */
  airScrew: number;
}

export interface CircuitAssessment {
  id: CircuitId;
  label: string;
  /** Welk onderdeel dit bereik vooral bepaalt. */
  component: string;
  mixture: Mixture;
  /** Afwijking in stappen t.o.v. het advies (sproeiermaten of clipstanden). */
  delta: number;
  risk: string | null;
  nextTest: string;
}

export interface JetSimulation {
  circuits: CircuitAssessment[];
  overall: 'arm' | 'goed' | 'rijk' | 'gemengd';
  confidence: 'hoog' | 'gemiddeld' | 'laag';
  warnings: string[];
  summary: string;
}

/** Vuistregel voor de stationairsproeier bij een kleine 2-takt carburateur. */
export function idleJetTarget(mainJet: number): number {
  return Math.min(60, Math.max(28, Math.round(mainJet * 0.4)));
}

function mixtureForDelta(delta: number): Mixture {
  if (delta <= -2) return 'arm';
  if (delta === -1) return 'iets arm';
  if (delta === 0) return 'goed';
  if (delta === 1) return 'iets rijk';
  return 'rijk';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Berekent per gasstand de mengselrichting.
 * Positief delta = rijker dan het advies, negatief = armer.
 */
export function calculateJetSimulation(input: JetInput): JetSimulation {
  const { start } = input;
  const advisedCenter = Math.round((start.jetLow + start.jetHigh) / 2);
  const mainDelta = Math.round(input.mainJet - advisedCenter);

  // Naald: hoger clipnummer = naald lager = armer.
  const clipDelta = input.clip - start.clip;

  const idleTarget = idleJetTarget(input.mainJet);
  const idleDelta = Math.round(input.idleJet - idleTarget);
  // Luchtschroef: verder uit = meer lucht = armer. 1,5 slag is het neutrale punt.
  const screwDelta = Math.round((1.5 - input.airScrew) * 1.5);

  const idleTotal = idleDelta + screwDelta;
  // De naald beheert het middengebied; de hoofdsproeier telt daar voor een deel mee.
  // Hoger clipnummer = naald lager = armer, dus het teken draait om.
  const midTotal = Math.round(-clipDelta * 1.2 + mainDelta * 0.3);

  const circuits: CircuitAssessment[] = [
    {
      id: 'idle',
      label: throttleBandLabel('idle'),
      component: 'Stationairsproeier en luchtschroef',
      mixture: mixtureForDelta(clamp(idleTotal, -3, 3)),
      delta: idleTotal,
      risk:
        idleTotal <= -2
          ? 'Te arm stationair geeft hangende toeren of slecht starten; controleer ook op valse lucht.'
          : idleTotal >= 2
            ? 'Te rijk stationair kan de bougie nat maken en de gasrespons onderin dempen.'
            : null,
      nextTest:
        idleTotal === 0
          ? 'Laat hem warm stationair draaien en controleer of het toerental rustig blijft.'
          : `Draai de luchtschroef een kwartslag ${idleTotal < 0 ? 'in (rijker)' : 'uit (armer)'} en test opnieuw.`,
    },
    {
      id: 'mid',
      label: throttleBandLabel('mid'),
      component: 'Gasnaald en clippositie',
      mixture: mixtureForDelta(clamp(midTotal, -3, 3)),
      delta: midTotal,
      risk:
        midTotal <= -2
          ? 'Te arm rond halfgas geeft een dip of hikken bij accelereren; niet negeren bij langdurig halfgas.'
          : midTotal >= 2
            ? 'Te rijk rond halfgas geeft pruttelen en meer verbruik zonder extra vermogen.'
            : null,
      nextTest:
        midTotal === 0
          ? 'Rijd rustig op halfgas en voel of hij schoon oppakt zonder dip.'
          : `Zet de naaldclip één stand ${midTotal > 0 ? 'omhoog (armer)' : 'omlaag (rijker)'} en test hetzelfde traject opnieuw.`,
    },
    {
      id: 'full',
      label: throttleBandLabel('full'),
      component: 'Hoofdsproeier',
      mixture: mixtureForDelta(clamp(mainDelta, -3, 3)),
      delta: mainDelta,
      risk:
        mainDelta <= -2
          ? 'Te arm bij volgas kan detonatie en een warmloper veroorzaken. Stop met volgas testen tot je rijker bent.'
          : mainDelta >= 2
            ? 'Te rijk bij volgas kost vermogen en kan de bougie vervuilen.'
            : null,
      nextTest:
        mainDelta === 0
          ? 'Doe een korte volgas-test (alleen veilig en toegestaan terrein) en lees daarna de bougie.'
          : `Monteer een sproeier ${mainDelta < 0 ? 'groter' : 'kleiner'} (één stap) en test opnieuw.`,
    },
  ];

  const mixtures = circuits.map((c) => c.mixture);
  const lean = mixtures.some((m) => m === 'arm' || m === 'iets arm');
  const rich = mixtures.some((m) => m === 'rijk' || m === 'iets rijk');
  const overall: JetSimulation['overall'] = lean && rich ? 'gemengd' : lean ? 'arm' : rich ? 'rijk' : 'goed';

  const warnings: string[] = [];
  if (circuits[2]!.mixture === 'arm' || circuits[2]!.mixture === 'rijk') {
    warnings.push('Verander nooit de hoofdsproeier én de naaldclip in dezelfde test.');
  }
  if (lean) {
    warnings.push('Rijd niet langdurig volgas met een te arm mengsel; dat kost een zuiger.');
  }
  if (circuits[0]!.mixture !== 'goed') {
    warnings.push('Controleer eerst op valse lucht voordat je het stationaircircuit bijstelt.');
  }

  const confidence: JetSimulation['confidence'] = 'gemiddeld';

  const summary =
    overall === 'goed'
      ? `De gemonteerde sproeiers zitten rond het startadvies (${start.jetLow}–${start.jetHigh}). Testen en bougie lezen is de volgende stap.`
      : overall === 'gemengd'
        ? 'De circuits staan niet dezelfde kant op: eerst het stationaircircuit goed, daarna de naald, dan volgas.'
        : overall === 'arm'
          ? `Je zit armer dan het advies (${start.jetLow}–${start.jetHigh}). Werk in kleine stappen rijker en test na elke stap.`
          : `Je zit rijker dan het advies (${start.jetLow}–${start.jetHigh}). Kleiner testen kan, één maat per keer.`;

  return { circuits, overall, confidence, warnings, summary };
}
