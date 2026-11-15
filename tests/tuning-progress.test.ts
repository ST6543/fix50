/** Tests voor het tuning-dashboard: trends en ontwikkeling per opstelling. */
import {
  accelTrend,
  bestT0_50,
  bestTopSpeed,
  development,
  setupProgress,
  speedTrend,
  type RunSlice,
} from '@/lib/tuning-progress';

function run(partial: Partial<RunSlice> & { id: string }): RunSlice {
  return {
    started_at: '2026-11-01T12:00:00.000Z',
    max_speed_kmh: null,
    t0_50_s: null,
    setup_id: null,
    gps_quality: 'goed',
    ...partial,
  };
}

describe('speedTrend / accelTrend', () => {
  it('zet runs chronologisch, ongeacht invoervolgorde', () => {
    const trend = speedTrend([
      run({ id: 'b', started_at: '2026-11-05T10:00:00.000Z', max_speed_kmh: 88 }),
      run({ id: 'a', started_at: '2026-11-01T10:00:00.000Z', max_speed_kmh: 80 }),
    ]);
    expect(trend.map((p) => p.value)).toEqual([80, 88]);
  });

  it('laat runs met slechte GPS-kwaliteit weg', () => {
    const trend = speedTrend([
      run({ id: 'a', max_speed_kmh: 80 }),
      run({ id: 'b', max_speed_kmh: 200, gps_quality: 'slecht' }),
    ]);
    expect(trend).toHaveLength(1);
    expect(trend[0]!.value).toBe(80);
  });

  it('slaat metingen zonder waarde over', () => {
    expect(accelTrend([run({ id: 'a' }), run({ id: 'b', t0_50_s: 7.2 })])).toHaveLength(1);
  });
});

describe('beste waarden', () => {
  it('pakt de hoogste snelheid en de laagste 0-50 tijd', () => {
    const runs = [
      run({ id: 'a', max_speed_kmh: 82, t0_50_s: 8.1 }),
      run({ id: 'b', max_speed_kmh: 91, t0_50_s: 7.4 }),
      run({ id: 'c', max_speed_kmh: 300, t0_50_s: 1.1, gps_quality: 'slecht' }),
    ];
    expect(bestTopSpeed(runs)).toBe(91);
    expect(bestT0_50(runs)).toBe(7.4);
  });

  it('geeft null zonder bruikbare metingen', () => {
    expect(bestTopSpeed([])).toBeNull();
    expect(bestT0_50([run({ id: 'a' })])).toBeNull();
  });
});

describe('setupProgress', () => {
  const setups = [
    { id: 's1', name: 'Test 1' },
    { id: 's2', name: 'Test 2' },
  ];

  it('rekent runs per opstelling en laat ongeteste setups staan', () => {
    const progress = setupProgress(setups, [
      run({ id: 'a', setup_id: 's1', max_speed_kmh: 84, t0_50_s: 7.6 }),
      run({ id: 'b', setup_id: 's1', max_speed_kmh: 88, t0_50_s: 7.9 }),
      run({ id: 'c', setup_id: null, max_speed_kmh: 99 }),
    ]);
    const s1 = progress.find((p) => p.setupId === 's1')!;
    const s2 = progress.find((p) => p.setupId === 's2')!;
    expect(s1.runs).toBe(2);
    expect(s1.bestTop).toBe(88);
    expect(s1.avgTop).toBe(86);
    expect(s1.bestT0_50).toBe(7.6);
    expect(s2.runs).toBe(0);
    expect(s2.bestTop).toBeNull();
  });
});

describe('development', () => {
  it('geeft het verschil tussen eerste en laatste meting', () => {
    expect(development([{ label: 'a', value: 80 }, { label: 'b', value: 88.5 }])).toBe(8.5);
  });

  it('geeft null bij minder dan twee punten', () => {
    expect(development([{ label: 'a', value: 80 }])).toBeNull();
  });
});
