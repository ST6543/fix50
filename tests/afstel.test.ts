/** Tests voor de afstelhulp-rekenmodellen (carburateur + CVT). */
import {
  calculateCarb,
  calculateCvt,
  diagnoseCvtSymptoms,
  cvtSpringLabel,
  cvtSpeedLabel,
  CARB_SETUP_LABELS,
  ENGINE_FAMILIES,
} from '../src/lib/afstel';

describe('calculateCarb', () => {
  const base = { cc: 70, carbMm: 17.5, material: 'ijzer' as const, setupType: 'sport' as const, cooling: 'AC' as const };

  test('referentiescenario: 70cc sport, 17.5mm, luchtgekoeld', () => {
    const r = calculateCarb(base);
    expect(r.jetLow).toBe(84);
    expect(r.jetHigh).toBe(91);
    expect(r.clip).toBe(4); // luchtgekoeld + niet-stock => +1 vanaf 3
    expect(r.heat).toBe(8);
    expect(r.powerbandRpm).toBe(8300);
  });

  test('aluminium blok rijkt en verhoogt powerband-richtpunt', () => {
    const alu = calculateCarb({ ...base, material: 'alu' });
    const ijzer = calculateCarb(base);
    expect(alu.jetLow).toBeGreaterThanOrEqual(ijzer.jetLow);
    expect(alu.jetHigh).toBeGreaterThan(ijzer.jetHigh);
    expect(alu.powerbandRpm).toBeGreaterThan(ijzer.powerbandRpm);
  });

  test('stock kiest een armer clipadvice dan sport', () => {
    expect(calculateCarb({ ...base, setupType: 'stock' }).clip).toBeLessThan(calculateCarb(base).clip);
  });

  test('watergekoeld + >=70cc geeft hogere hittegraad dan luchtgekoeld', () => {
    expect(calculateCarb({ ...base, cooling: 'LC' }).heat).toBe(9);
  });

  test('diesel of midrace draait hoger toerental-richtpunt', () => {
    expect(calculateCarb({ ...base, setupType: 'midrace' }).powerbandRpm).toBeGreaterThan(calculateCarb(base).powerbandRpm);
  });

  test('bekende motorfamilie levert NGK-code met hittegraad', () => {
    const fam = ENGINE_FAMILIES.find((f) => f.id === 'minarelli-h')!;
    const r = calculateCarb({ ...base, engineFamilyId: fam.id });
    expect(r.plug).toBe(fam.plug!.replace('x', '8'));
  });

  test('onbekend blok levert geen plug-code maar wel hittegraad', () => {
    const r = calculateCarb({ ...base, engineFamilyId: 'onbekend' });
    expect(r.plug).toBeNull();
    expect(r.heat).toBe(8);
  });

  test('alle setup-labels zijn aanwezig', () => {
    expect(Object.keys(CARB_SETUP_LABELS)).toHaveLength(4);
  });
});

describe('calculateCvt', () => {
  const neutral: { roller: number; springIndex: number; belt: number; clutch: number; pbMin: number; pbMax: number; carterIndex: number } = {
    roller: 9.5,
    springIndex: 1,
    belt: 765,
    clutch: 2,
    pbMin: 7600,
    pbMax: 9000,
    carterIndex: 1,
  };

  test('referentiescenario (midden-carter, 9.5g, Wit 130, 765mm): netjes in balans', () => {
    const m = calculateCvt(neutral);
    expect(m.verdict).toBe('Netjes in balans');
    expect(Math.round(m.shiftRpm)).toBe(8300); // midden van de powerband
    expect(m.launchScore).toBeCloseTo(6.2, 1);
    expect(m.balanceScore).toBeCloseTo(10, 1);
    expect(cvtSpeedLabel(m.topSpeed)).toBe('snel');
  });

  test('te lichte rollen + strakke drukveer => overrev', () => {
    const m = calculateCvt({ ...neutral, roller: 4.5, springIndex: 5 });
    expect(m.verdict).toBe('Overrev');
    expect(m.shiftRpm).toBeGreaterThan(neutral.pbMax + 250);
  });

  test('te zware rollen + slappe drukveer => te vroeg opschakelen / te lui', () => {
    const m = calculateCvt({ ...neutral, roller: 13, springIndex: 0 });
    expect(['Te vroeg opschakelen', 'Te lui']).toContain(m.verdict);
  });

  test('snaar ver buiten carter-norm => snaarverdienste', () => {
    const m = calculateCvt({ ...neutral, belt: 830 });
    expect(m.verdict).toBe('Snaar past niet logisch');
    expect(m.beltDiff).toBe(65);
  });

  test('grafiekdata loopt van 0 tot >top en eindigt met nulls na top', () => {
    const m = calculateCvt(neutral);
    expect(m.data[0]!.speed).toBe(0);
    const afterTop = m.data.filter((d) => d.speed > m.topSpeed);
    expect(afterTop.length).toBeGreaterThan(0);
    afterTop.forEach((d) => expect(d.rpm).toBeNull());
    expect(m.data.every((d) => d.rpm === null || (d.rpm >= 1500 && d.rpm <= 12000))).toBe(true);
  });
});

describe('diagnoseCvtSymptoms', () => {
  const base = { roller: 9.5, springIndex: 1, belt: 765, clutch: 2, pbMin: 7600, pbMax: 9000, carterIndex: 1 };

  test('geen symptomen: setup blijft gelijk en 3 basisstappen', () => {
    const d = diagnoseCvtSymptoms(base, []);
    expect(d.suggested).toEqual(base);
    expect(d.steps).toHaveLength(3);
  });

  test('"veel toeren, weinig snelheid" → covere rollen + lichtere drukveer', () => {
    const d = diagnoseCvtSymptoms(base, ['screams_no_speed']);
    expect(d.suggested.roller).toBe(10.5);
    expect(cvtSpringLabel(d.suggested.springIndex)).toContain('Origineel');
  });

  test('"zakt in toeren bij optrekken" → lichtere rollen + sterkere drukveer', () => {
    const d = diagnoseCvtSymptoms(base, ['bogs_down']);
    expect(d.suggested.roller).toBe(8.5);
    expect(cvtSpringLabel(d.suggested.springIndex)).toBe(cvtSpringLabel(2));
  });

  test('snaar-gerelateerde klacht schuift snaar naar de carter-norm', () => {
    const d = diagnoseCvtSymptoms({ ...base, belt: 800 }, ['belt_not_reaching_top']);
    expect(d.suggested.belt).toBe(765);
  });

  test('combinatie van meerdere symptomen telt op en klem', () => {
    const d = diagnoseCvtSymptoms({ ...base, roller: 3 }, ['lazy_launch', 'screams_no_speed']);
    expect(d.suggested.roller).toBeGreaterThanOrEqual(3);
  });
});
