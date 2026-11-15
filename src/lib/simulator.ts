/**
 * Simulator-hulpjes: betrouwbaarheid van een voorspelling en de bandbreedte
 * die bij die betrouwbaarheid hoort. Nooit een exacte waarde suggereren.
 */
import type { CvtModel, CvtState } from './afstel';

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
