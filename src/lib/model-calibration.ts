/**
 * Modelijking: vergelijkt de voorspelde topsnelheid van een setup met de
 * werkelijk gemeten GPS-snelheid, en rekent een correctiefactor uit.
 *
 * Belangrijk: dit is een correctie op een schatting, geen meting. De factor
 * blijft daarom begrensd en de betrouwbaarheid hangt af van het aantal runs.
 */

export interface PredictionPair {
  /** Voorspelde topsnelheid uit het CVT-model (km/u). */
  predicted: number;
  /** Gemeten topsnelheid uit een GPS-run (km/u). */
  measured: number;
}

export interface ModelAccuracy {
  /** Aantal bruikbare metingen. */
  samples: number;
  /** Gemiddelde verhouding gemeten/voorspeld; null zonder metingen. */
  factor: number | null;
  /** Gemiddelde absolute afwijking in procenten; null zonder metingen. */
  meanAbsErrorPct: number | null;
  /** Of het model stelselmatig te hoog (>) of te laag (<) voorspelt. */
  bias: 'te hoog' | 'te laag' | 'neutraal' | 'onbekend';
  confidence: 'hoog' | 'gemiddeld' | 'laag' | 'onbekend';
  label: string;
}

const MIN_SPEED = 15;
const MAX_SPEED = 140;
const FACTOR_MIN = 0.8;
const FACTOR_MAX = 1.2;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function calibrateModel(pairs: PredictionPair[]): ModelAccuracy {
  const usable = pairs.filter(
    (p) =>
      Number.isFinite(p.predicted) &&
      Number.isFinite(p.measured) &&
      p.predicted > 0 &&
      p.measured >= MIN_SPEED &&
      p.measured <= MAX_SPEED,
  );
  if (usable.length === 0) {
    return {
      samples: 0,
      factor: null,
      meanAbsErrorPct: null,
      bias: 'onbekend',
      confidence: 'onbekend',
      label: 'Nog geen metingen om het model te ijken.',
    };
  }

  const ratios = usable.map((p) => p.measured / p.predicted);
  const factor = clamp(ratios.reduce((a, b) => a + b, 0) / ratios.length, FACTOR_MIN, FACTOR_MAX);
  const meanAbsErrorPct =
    (usable.reduce((sum, p) => sum + Math.abs(p.measured - p.predicted) / p.predicted, 0) / usable.length) * 100;

  const bias: ModelAccuracy['bias'] =
    Math.abs(factor - 1) < 0.02 ? 'neutraal' : factor < 1 ? 'te hoog' : 'te laag';

  const confidence: ModelAccuracy['confidence'] =
    usable.length >= 5 && meanAbsErrorPct <= 8
      ? 'hoog'
      : usable.length >= 3
        ? 'gemiddeld'
        : 'laag';

  return {
    samples: usable.length,
    factor: Number(factor.toFixed(3)),
    meanAbsErrorPct: Number(meanAbsErrorPct.toFixed(1)),
    bias,
    confidence,
    label:
      confidence === 'hoog'
        ? `Model klopt goed op ${usable.length} metingen (${meanAbsErrorPct.toFixed(1)}% gemiddelde afwijking).`
        : confidence === 'gemiddeld'
          ? `Redelijk op ${usable.length} metingen, maar nog te weinig voor een harde uitspraak.`
          : `Eerste indicatie uit ${usable.length} meting${usable.length === 1 ? '' : 'en'} — nog niet betrouwbaar.`,
  };
}

/**
 * Past de ijking toe op een voorspelling en geeft een bandbreedte mee.
 * De bandbreedte groeit met de gemiddelde fout en krimpt bij meer metingen.
 */
export function applyCalibration(
  predicted: number,
  acc: ModelAccuracy,
): { corrected: number; low: number; high: number; calibrated: boolean } {
  if (acc.factor === null || acc.samples === 0) {
    return { corrected: predicted, low: predicted, high: predicted, calibrated: false };
  }
  const corrected = predicted * acc.factor;
  const baseSpread = acc.meanAbsErrorPct === null ? 12 : acc.meanAbsErrorPct;
  // Meer metingen = smallere band; nooit smaller dan 3%.
  const spreadPct = Math.max(3, baseSpread / Math.sqrt(acc.samples));
  return {
    corrected: Number(corrected.toFixed(1)),
    low: Number((corrected * (1 - spreadPct / 100)).toFixed(1)),
    high: Number((corrected * (1 + spreadPct / 100)).toFixed(1)),
    calibrated: true,
  };
}
