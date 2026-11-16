/** Tests voor de vertandingsrekenaar en de combinatiezoeker. */
import {
  compareGearing,
  finalDriveRatio,
  findOptimalGearing,
  rpmAtSpeed,
  rpmForSameSpeed,
  speedDeltaPct,
  speedKmh,
  speedPerGear,
  torqueDeltaPct,
  totalRatio,
} from '@/lib/gearing';

const GEARS = [
  { gear: 1, ratio: 3.0 },
  { gear: 6, ratio: 0.96 },
];

describe('basisformules', () => {
  it('berekent de eindoverbrenging als achter/voor', () => {
    expect(finalDriveRatio(13, 52)).toBe(4);
    expect(finalDriveRatio(11, 47)).toBeCloseTo(4.2727, 4);
    expect(finalDriveRatio(0, 47)).toBe(0);
  });

  it('rekent het relatieve koppelverschil exact', () => {
    // R oud 4,00 → R nieuw 4,3333 hoort bij 1 tand kleiner voor (13 → 12 op 52).
    const oud = finalDriveRatio(13, 52);
    const nieuw = finalDriveRatio(12, 52);
    expect(torqueDeltaPct(oud, nieuw)).toBeCloseTo(8.333, 3);
  });

  it('rekent het relatieve snelheidsverschil exact', () => {
    const oud = finalDriveRatio(13, 52);
    const nieuw = finalDriveRatio(12, 52);
    expect(speedDeltaPct(oud, nieuw)).toBeCloseTo(-7.692, 3);
  });

  it('rekent het benodigde toerental voor dezelfde snelheid', () => {
    const oud = finalDriveRatio(13, 52);
    const nieuw = finalDriveRatio(12, 52);
    expect(rpmForSameSpeed(9000, oud, nieuw)).toBeCloseTo(9750, 3);
  });

  it('neemt de primaire overbrenging mee in de totale verhouding', () => {
    expect(totalRatio(3.55, 0.96, 4.27)).toBeCloseTo(14.55, 2);
    expect(totalRatio(null, 0.96, 4.27)).toBeNull();
  });

  it('rekent snelheid en toerental in elkaar om', () => {
    const total = totalRatio(3.55, 0.96, 4.27)!;
    const v = speedKmh(9000, total, 1.85);
    expect(v).toBeGreaterThan(60);
    expect(v).toBeLessThan(75);
    expect(rpmAtSpeed(v, total, 1.85)).toBeCloseTo(9000, 0);
  });

  it('geeft per versnelling een theoretische snelheid', () => {
    const rows = speedPerGear({ rpm: 9000, front: 11, rear: 47, primaryRatio: 3.55, gears: GEARS, wheelCircumferenceM: 1.85 });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.speed).toBeLessThan(rows[1]!.speed);
    // Zonder primaire verhouding is er geen snelheid te berekenen.
    const blind = speedPerGear({ rpm: 9000, front: 11, rear: 47, primaryRatio: null, gears: GEARS, wheelCircumferenceM: 1.85 });
    expect(blind.every((r) => r.speed === 0)).toBe(true);
  });
});

describe('compareGearing', () => {
  it('vat alle verschillen t.o.v. de referentie samen', () => {
    const s = compareGearing({ baseFront: 13, baseRear: 52, front: 12, rear: 52, baseRpm: 9000 });
    expect(s.ratio).toBeCloseTo(4.3333, 3);
    expect(s.torquePct).toBeCloseTo(8.333, 2);
    expect(s.requiredRpm).toBeCloseTo(9750, 1);
  });
});

describe('findOptimalGearing', () => {
  const base = {
    front: 13,
    rear: 52,
    measuredTopSpeedKmh: 70,
    measuredTopRpm: 9500,
    maxRpm: 11000,
    minTopSpeedKmh: 68,
    usage: 'dagelijks' as const,
    wheelCircumferenceM: 1.85,
    primaryRatio: 3.55,
    gears: GEARS,
  };

  it('geeft geen advies zonder meting', () => {
    const res = findOptimalGearing({ ...base, goal: 'trek', measuredTopRpm: null });
    expect(res.needsMeasurement).toBe(true);
    expect(res.recommendations).toHaveLength(0);
    expect(res.explanation).toContain('topsnelheid');
  });

  it('levert drie aanbevelingen met de gevraagde eerste test vooraan', () => {
    const res = findOptimalGearing({ ...base, goal: 'trekBehoudTop' });
    expect(res.needsMeasurement).toBe(false);
    expect(res.recommendations.length).toBeGreaterThan(0);
    expect(res.recommendations[0]!.kind).toBe('balans');
    expect(res.bestFirst).not.toBeNull();
  });

  it('kiest voor optrekken een kortere overbrenging met koppelwinst', () => {
    const res = findOptimalGearing({ ...base, goal: 'trek' });
    const accel = res.recommendations.find((r) => r.kind === 'accel')!;
    expect(accel.ratio).toBeGreaterThan(finalDriveRatio(13, 52));
    expect(accel.torquePct).toBeGreaterThan(0);
    expect(res.recommendations[0]!.kind).toBe('accel');
  });

  it('kiest voor top een langere overbrenging', () => {
    const res = findOptimalGearing({ ...base, goal: 'top' });
    const top = res.recommendations.find((r) => r.kind === 'top');
    if (top) {
      expect(top.ratio).toBeLessThan(finalDriveRatio(13, 52));
      expect(top.torquePct).toBeLessThan(0);
    }
    expect(res.recommendations[0]?.kind).toBe('top');
  });

  it('geeft geen geforceerd advies als behoud van top onmogelijk is', () => {
    // Klein toerentalplafond: korter vertanden kan de oude top nooit halen.
    const res = findOptimalGearing({ ...base, goal: 'trekBehoudTop', maxRpm: 9600, minTopSpeedKmh: 70 });
    const balans = res.recommendations.find((r) => r.kind === 'balans');
    expect(balans).toBeUndefined();
    expect(res.explanation).toBeTruthy();
    expect(res.explanation!).toContain('top');
    // De eerste aanbeveling is dan geen valse "balans".
    expect(res.bestFirst?.kind).not.toBe('balans');
  });

  it('houdt zich aan het tandwielbereik', () => {
    const res = findOptimalGearing({ ...base, goal: 'allround' });
    for (const c of res.candidates) {
      expect(c.front).toBeGreaterThanOrEqual(10);
      expect(c.front).toBeLessThanOrEqual(16);
      expect(c.rear).toBeGreaterThanOrEqual(40);
      expect(c.rear).toBeLessThanOrEqual(60);
    }
    expect(res.candidates.length).toBe(7 * 21 - 1);
  });
});
