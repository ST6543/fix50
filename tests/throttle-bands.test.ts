/** Tests dat de gasstandsbanden echt uit één bron komen. */
import { THROTTLE_BANDS, throttleBandLabel } from '@/lib/throttle-bands';
import { THROTTLE_MAP } from '@/lib/afstel';
import { calculateJetSimulation, idleJetTarget } from '@/lib/jet-simulator';
import { bandAt, CARB_BAND_LABELS, CARB_THROTTLE_BANDS } from '@/lib/carb-diagram';
import type { CarbResult } from '@/lib/afstel';

const START: CarbResult = {
  jetLow: 90,
  jetHigh: 98,
  clip: 3,
  heat: 8,
  plug: 'BR8HS',
  powerbandRpm: 8000,
};

describe('gasstandsbanden uit één bron', () => {
  it('houdt de volgorde en grenzen vast', () => {
    expect(THROTTLE_BANDS.map((b) => b.id)).toEqual(['idle', 'mid', 'full']);
    expect(THROTTLE_BANDS.map((b) => b.maxPct)).toEqual([12.5, 75, 100]);
  });

  it('gebruikt dezelfde bereiken op de afstelkaart', () => {
    expect(THROTTLE_MAP.map((r) => r.range)).toEqual(THROTTLE_BANDS.map((b) => b.range));
  });

  it('gebruikt dezelfde labels in de sproeier-simulator', () => {
    const sim = calculateJetSimulation({
      start: START,
      mainJet: 94,
      idleJet: idleJetTarget(94),
      clip: 3,
      airScrew: 1.5,
    });
    expect(sim.circuits.map((c) => c.label)).toEqual(THROTTLE_BANDS.map((b) => b.label));
  });

  it('gebruikt dezelfde labels in het carburateurdiagram', () => {
    expect([CARB_BAND_LABELS.stationair, CARB_BAND_LABELS.halfgas, CARB_BAND_LABELS.volgas]).toEqual(
      THROTTLE_BANDS.map((b) => b.label),
    );
    expect([CARB_THROTTLE_BANDS.idle.range, CARB_THROTTLE_BANDS.mid.range, CARB_THROTTLE_BANDS.full.range]).toEqual(
      THROTTLE_BANDS.map((b) => b.label),
    );
    expect(bandAt(0).range).toBe(throttleBandLabel('idle'));
    expect(bandAt(50).range).toBe(throttleBandLabel('mid'));
    expect(bandAt(100).range).toBe(throttleBandLabel('full'));
  });
});
