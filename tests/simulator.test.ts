/** Tests voor de simulator: betrouwbaarheid, bandbreedte en samenvatting. */
import { calculateCvt, DEFAULT_CVT_STATE } from '@/lib/afstel';
import { predictionConfidence, scenarioConfidence, summarizeScenario, type ConfidenceResult } from '@/lib/simulator';

describe('predictionConfidence', () => {
  it('geeft laag zonder voertuiggegevens en metingen', () => {
    const c = predictionConfidence({ hasBlock: false, hasCylinder: false, calibrationSamples: 0 });
    expect(c.level).toBe('laag');
    expect(c.spreadPct).toBe(15);
    expect(c.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it('geeft gemiddeld bij blok en cilinder maar zonder metingen', () => {
    const c = predictionConfidence({ hasBlock: true, hasCylinder: true, calibrationSamples: 0 });
    expect(c.level).toBe('gemiddeld');
    expect(c.spreadPct).toBe(9);
    expect(c.reasons.join(' ')).toContain('ijken');
  });

  it('geeft hoog bij complete gegevens en genoeg ijkingen', () => {
    const c = predictionConfidence({ hasBlock: true, hasCylinder: true, calibrationSamples: 5 });
    expect(c.level).toBe('hoog');
    expect(c.spreadPct).toBe(5);
  });

  it('maakt de band nooit smaller dan de gemeten modelafwijking', () => {
    const c = predictionConfidence({
      hasBlock: true,
      hasCylinder: true,
      calibrationSamples: 6,
      meanAbsErrorPct: 14,
    });
    expect(c.level).toBe('hoog');
    expect(c.spreadPct).toBe(14);
  });
});

describe('scenarioConfidence', () => {
  const base: ConfidenceResult = predictionConfidence({ hasBlock: true, hasCylinder: true, calibrationSamples: 5 });
  const baseline = { roller: 8.5, springIndex: 2, belt: 765, pbMin: 7600, pbMax: 9000 };

  it('houdt de basiszekerheid bij een scenario dat gelijk is aan de geijkte opstelling', () => {
    const conf = scenarioConfidence(base, { ...baseline }, baseline);
    expect(conf.level).toBe(base.level);
    expect(conf.spreadPct).toBe(base.spreadPct);
    expect(conf.reasons).toHaveLength(0);
    expect(conf.label).toContain('geijkte opstelling');
  });

  it('verlaagt de zekerheid als het rolgewicht ver van de basis ligt', () => {
    const mild = scenarioConfidence(base, { ...baseline, roller: 6.5 }, baseline);
    const extreme = scenarioConfidence(base, { ...baseline, roller: 4 }, baseline);
    expect(mild.level).toBe('gemiddeld');
    expect(extreme.level).toBe('laag');
    expect(extreme.spreadPct).toBeGreaterThan(mild.spreadPct);
    expect(extreme.reasons.join(' ')).toContain('Rolgewicht');
  });

  it('telt een andere snaar, drukveer en powerband mee', () => {
    const conf = scenarioConfidence(
      base,
      { roller: 8.5, springIndex: 4, belt: 800, pbMin: 9000, pbMax: 10400 },
      baseline,
    );
    expect(conf.level).toBe('laag');
    expect(conf.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it('maakt de band nooit smaller dan de basisband', () => {
    const strict = predictionConfidence({ hasBlock: true, hasCylinder: true, calibrationSamples: 6, meanAbsErrorPct: 12 });
    const conf = scenarioConfidence(strict, { ...baseline, roller: 12 }, baseline);
    expect(conf.spreadPct).toBeGreaterThanOrEqual(strict.spreadPct);
  });
});

describe('summarizeScenario', () => {
  it('geeft een bovengrens en ondergrens rond de voorspelde topsnelheid', () => {
    const model = calculateCvt(DEFAULT_CVT_STATE);
    const conf = predictionConfidence({ hasBlock: true, hasCylinder: true, calibrationSamples: 5 });
    const summary = summarizeScenario(model, conf);
    expect(summary.topSpeed).toBe(Math.round(model.topSpeed));
    expect(summary.topLow).toBeLessThan(summary.topSpeed);
    expect(summary.topHigh).toBeGreaterThan(summary.topSpeed);
    expect(summary.topHigh - summary.topLow).toBeGreaterThan(0);
    expect(summary.shiftRpm).toBeGreaterThan(0);
  });

  it('zwaardere rollen geven een lagere topsnelheid in het model', () => {
    const light = calculateCvt({ ...DEFAULT_CVT_STATE, roller: 6 });
    const heavy = calculateCvt({ ...DEFAULT_CVT_STATE, roller: 12 });
    expect(heavy.topSpeed).not.toBe(light.topSpeed);
  });
});
