/** Tests voor GPS-meetlogica (pure functies, geen sensoren nodig). */
import { computeMetrics, gpsQuality, haversineM, smoothSpeed, type GpsSample } from '../src/features/performance/gps';

describe('smoothSpeed', () => {
  it('beweegt richting de nieuwe waarde (exponential smoothing)', () => {
    const s1 = smoothSpeed(0, 40);
    expect(s1).toBeGreaterThan(0);
    expect(s1).toBeLessThan(40);
    const s2 = smoothSpeed(s1, 40);
    expect(s2).toBeGreaterThan(s1);
    expect(s2).toBeLessThan(40);
  });
});

describe('haversineM', () => {
  it('geeft ~0 voor hetzelfde punt', () => {
    expect(haversineM(53.2, 6.5, 53.2, 6.5)).toBeCloseTo(0, 5);
  });
  it('berekent een echte afstand', () => {
    // Groningen → Haren is grofweg ~7 km
    const d = haversineM(53.2194, 6.5674, 53.1747, 6.6183);
    expect(d).toBeGreaterThan(5000);
    expect(d).toBeLessThan(9000);
  });
});

describe('gpsQuality', () => {
  it('goed bij lage accuracy', () => {
    expect(gpsQuality([5, 6, 4])).toBe('goed');
  });
  it('slecht bij hoge of ontbrekende accuracy', () => {
    expect(gpsQuality([35, 40])).toBe('slecht');
    expect(gpsQuality([])).toBe('slecht');
  });
});

describe('computeMetrics', () => {
  function sample(t: number, speed: number, accuracy = 6): GpsSample {
    return { t, speedKmh: speed, rawSpeedKmh: speed, lat: null, lon: null, accuracy };
  }

  it('berekent 0-50 over ruwweg de juiste tijd', () => {
    const samples = [
      sample(0, 0),
      sample(1000, 15),
      sample(2000, 30),
      sample(3000, 45),
      sample(4200, 52),
      sample(6000, 60),
    ];
    const m = computeMetrics(samples);
    expect(m).not.toBeNull();
    expect(m!.t0_50).not.toBeNull();
    expect(m!.t0_50!).toBeGreaterThan(3);
    expect(m!.t0_50!).toBeLessThan(5);
    expect(m!.maxSpeedKmh).toBe(60);
  });

  it('geeft null bij te weinig samples', () => {
    expect(computeMetrics([sample(0, 10)])).toBeNull();
  });

  it('t0_80 blijft null als 80 nooit wordt gehaald', () => {
    const samples = [sample(0, 0), sample(1000, 30), sample(2000, 55)];
    const m = computeMetrics(samples);
    expect(m!.t0_80).toBeNull();
  });
});
