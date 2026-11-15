/** Tests voor modelijking: voorspelling vs. gemeten GPS-snelheid. */
import { applyCalibration, calibrateModel } from '@/lib/model-calibration';

describe('calibrateModel', () => {
  it('geeft een onbekende status zonder metingen', () => {
    const acc = calibrateModel([]);
    expect(acc.samples).toBe(0);
    expect(acc.factor).toBeNull();
    expect(acc.confidence).toBe('onbekend');
  });

  it('negeert onbruikbare waarden (0, negatief en onrealistisch hoog)', () => {
    const acc = calibrateModel([
      { predicted: 90, measured: 0 },
      { predicted: 0, measured: 80 },
      { predicted: 90, measured: 400 },
      { predicted: 90, measured: 85 },
    ]);
    expect(acc.samples).toBe(1);
    expect(acc.factor).toBeCloseTo(85 / 90, 2);
  });

  it('herkent dat het model te hoog voorspelt', () => {
    const acc = calibrateModel([
      { predicted: 100, measured: 90 },
      { predicted: 100, measured: 88 },
      { predicted: 100, measured: 92 },
    ]);
    expect(acc.bias).toBe('te hoog');
    expect(acc.factor).toBeLessThan(1);
    expect(acc.confidence).toBe('gemiddeld');
  });

  it('krijgt hoge betrouwbaarheid bij veel nauwkeurige metingen', () => {
    const acc = calibrateModel(
      Array.from({ length: 6 }, (_, i) => ({ predicted: 90, measured: 89 + (i % 2) })),
    );
    expect(acc.samples).toBe(6);
    expect(acc.confidence).toBe('hoog');
    expect(acc.meanAbsErrorPct).toBeLessThan(2);
  });

  it('begrenst de factor zodat één uitschieter het model niet sloopt', () => {
    const acc = calibrateModel([{ predicted: 100, measured: 40 }]);
    expect(acc.factor).toBe(0.8);
  });
});

describe('applyCalibration', () => {
  it('laat de voorspelling ongemoeid zonder metingen', () => {
    const res = applyCalibration(95, calibrateModel([]));
    expect(res.calibrated).toBe(false);
    expect(res.corrected).toBe(95);
  });

  it('corrigeert naar beneden en geeft een bandbreedte', () => {
    const acc = calibrateModel([
      { predicted: 100, measured: 90 },
      { predicted: 100, measured: 90 },
    ]);
    const res = applyCalibration(100, acc);
    expect(res.calibrated).toBe(true);
    expect(res.corrected).toBeLessThan(100);
    expect(res.low).toBeLessThan(res.corrected);
    expect(res.high).toBeGreaterThan(res.corrected);
  });

  it('maakt de band smaller bij meer metingen', () => {
    const one = applyCalibration(100, calibrateModel([{ predicted: 100, measured: 90 }]));
    const many = applyCalibration(
      100,
      calibrateModel(Array.from({ length: 9 }, () => ({ predicted: 100, measured: 90 }))),
    );
    expect(many.high - many.low).toBeLessThan(one.high - one.low);
  });
});
