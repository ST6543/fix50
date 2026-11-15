/**
 * Simulator-hulpjes: betrouwbaarheid van een voorspelling en de bandbreedte
 * die bij die betrouwbaarheid hoort. Nooit een exacte waarde suggereren.
 */
import type { CvtModel, CvtState } from './afstel';

/** Sleutels van CvtState die de betrouwbaarheid per scenario bepalen. */
export const SCENARIO_VALUE_KEYS = ['roller', 'springIndex', 'belt', 'pbMin', 'pbMax'] as const;

export type ConfidenceLevel = 'hoog' | 'gemiddeld' | 'laag';

export interface ConfidenceInput {
  /** Blok/familie bekend uit het voertuigprofiel. */
  hasBlock: boolean;
  /** Cilinderinhoud bekend. */
  hasCylinder: boolean;
  /** Aantal GPS-metingen waarmee het model geijkt is. */
  calibrationSamples: number;
  /** Gemiddelde modelafwijking in procenten (uit de ijking), indien bekend. */
  meanAbsErrorPct?: number | null;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  /** Relatieve bandbreedte (procent) voor de onzekerheidsband. */
  spreadPct: number;
  /** Wat de voorspelling onzeker maakt, in gewone taal. */
  reasons: string[];
  label: string;
}

/** Bandbreedte per niveau: minder harde data = bredere band. */
const SPREAD: Record<ConfidenceLevel, number> = { hoog: 5, gemiddeld: 9, laag: 15 };

export function predictionConfidence(input: ConfidenceInput): ConfidenceResult {
  const reasons: string[] = [];
  let score = 0;

  if (input.hasBlock) score += 1;
  else reasons.push('Geen blok gekozen — het model mist basiseigenschappen van je motor.');

  if (input.hasCylinder) score += 1;
  else reasons.push('Cilinderinhoud ontbreekt in je setup.');

  if (input.calibrationSamples >= 3) score += 2;
  else if (input.calibrationSamples >= 1) {
    score += 1;
    reasons.push(`Pas ${input.calibrationSamples} meting om te ijken; meer runs maken de band smaller.`);
  } else {
    reasons.push('Nog geen GPS-metingen om het model te ijken.');
  }

  const level: ConfidenceLevel = score >= 4 ? 'hoog' : score >= 2 ? 'gemiddeld' : 'laag';

  // Bij een gemeten modelafwijking nooit smaller dan die afwijking.
  const measured = input.meanAbsErrorPct ?? null;
  const spreadPct = measured !== null && measured > SPREAD[level] ? Math.min(25, measured) : SPREAD[level];

  const label =
    level === 'hoog'
      ? 'Betrouwbaar: voertuiggegevens compleet en het model is op metingen geijkt.'
      : level === 'gemiddeld'
        ? 'Gemiddeld: deels bekende gegevens — gebruik de band als richting, niet als belofte.'
        : 'Laag: veel aannames. Zie dit als startpunt en meet het na met een GPS-test.';

  return { level, spreadPct, reasons, label };
}

/** De CVT-waarden waarop de voorspelling feitelijk berust. */
export interface ScenarioValues {
  roller: number;
  springIndex: number;
  belt: number;
  pbMin: number;
  pbMax: number;
}

/**
 * Betrouwbaarheid per scenario: de basiszekerheid van het model, verlaagd
 * naarmate het scenario verder van de geijkte basis af staat (extrapolatie).
 */
export function scenarioConfidence(
  base: ConfidenceResult,
  scenario: ScenarioValues,
  baseline: ScenarioValues,
): ConfidenceResult {
  const reasons: string[] = [];
  let penalty = 0;

  const rollerDelta = Math.abs(scenario.roller - baseline.roller);
  if (rollerDelta > 3) {
    penalty += 2;
    reasons.push(`Rolgewicht wijkt ${rollerDelta.toFixed(1)} g af van je geijkte opstelling.`);
  } else if (rollerDelta > 1.5) {
    penalty += 1;
    reasons.push(`Rolgewicht wijkt ${rollerDelta.toFixed(1)} g af — buiten het geijkte bereik.`);
  }

  const springDelta = Math.abs(scenario.springIndex - baseline.springIndex);
  if (springDelta >= 2) {
    penalty += 1;
    reasons.push('Drukveer staat twee of meer stappen van de geijkte opstelling.');
  }

  const beltDelta = Math.abs(scenario.belt - baseline.belt);
  if (beltDelta > 20) {
    penalty += 1;
    reasons.push(`V-snaar wijkt ${Math.round(beltDelta)} mm af van wat gemeten is.`);
  }

  const center = (v: ScenarioValues) => (v.pbMin + v.pbMax) / 2;
  if (Math.abs(center(scenario) - center(baseline)) > 1200) {
    penalty += 1;
    reasons.push('Powerband ligt meer dan 1200 rpm naast je geijkte opstelling.');
  }

  const levels: ConfidenceLevel[] = ['laag', 'gemiddeld', 'hoog'];
  const baseIndex = levels.indexOf(base.level);
  const level = levels[Math.max(0, baseIndex - Math.min(2, penalty))]!;
  const spreadPct = Math.max(base.spreadPct, SPREAD[level]);

  const label =
    penalty === 0
      ? `Zelfde uitgangspunt als je geijkte opstelling — ${base.label.charAt(0).toLowerCase()}${base.label.slice(1)}`
      : `${level === 'laag' ? 'Zwakke' : 'Beperkte'} basis: dit scenario is een extrapolatie van wat er gemeten is.`;

  return { level, spreadPct, reasons: [...reasons, ...base.reasons].slice(0, 4), label };
}

export interface ScenarioSummary {
  topSpeed: number;
  topLow: number;
  topHigh: number;
  launchScore: number;
  balanceScore: number;
  shiftRpm: number;
  verdict: string;
}

/** Vat een CVT-model samen inclusief bandbreedte rond de topsnelheid. */
export function summarizeScenario(model: CvtModel, confidence: ConfidenceResult): ScenarioSummary {
  const delta = (model.topSpeed * confidence.spreadPct) / 100;
  return {
    topSpeed: Math.round(model.topSpeed),
    topLow: Math.round(model.topSpeed - delta),
    topHigh: Math.round(model.topSpeed + delta),
    launchScore: Number(model.launchScore.toFixed(1)),
    balanceScore: Number(model.balanceScore.toFixed(1)),
    shiftRpm: Math.round(model.shiftRpm),
    verdict: model.verdict,
  };
}

/** Verschil tussen twee scenario's in topsnelheid (B t.o.v. A). */
export function topSpeedDelta(a: CvtState, b: CvtState, calculate: (s: CvtState) => CvtModel): number {
  return Number((calculate(b).topSpeed - calculate(a).topSpeed).toFixed(1));
}
