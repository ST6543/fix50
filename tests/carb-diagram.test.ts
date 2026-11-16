/** Tests voor het carburateurdiagram (gasstandsbanden en actieve onderdelen). */
import {
  activePartsAt,
  bandAt,
  CARB_BAND_LABELS,
  CARB_PARTS,
  circuitAt,
  clampThrottle,
  IDLE_MAX_PCT,
  MID_MAX_PCT,
  throttleSummary,
  type CarbPartId,
} from '@/lib/carb-diagram';

const ALTIJD: CarbPartId[] = ['luchtfilter', 'gasklep', 'venturi', 'vlotter', 'vlotternaald', 'uitgang'];

describe('clampThrottle', () => {
  it('houdt de gasstand binnen 0–100', () => {
    expect(clampThrottle(-20)).toBe(0);
    expect(clampThrottle(140)).toBe(100);
    expect(clampThrottle(Number.NaN)).toBe(0);
    expect(clampThrottle(37.4)).toBe(37.4);
  });
});

describe('circuitAt', () => {
  it('deelt de gasstand in dezelfde banden als de afstelkaart', () => {
    expect(circuitAt(0)).toBe('idle');
    expect(circuitAt(IDLE_MAX_PCT - 0.1)).toBe('idle');
    expect(circuitAt(IDLE_MAX_PCT)).toBe('mid');
    expect(circuitAt(MID_MAX_PCT)).toBe('mid');
    expect(circuitAt(MID_MAX_PCT + 0.1)).toBe('full');
    expect(circuitAt(100)).toBe('full');
  });

  it('klemt waarden buiten het bereik', () => {
    expect(circuitAt(-5)).toBe('idle');
    expect(circuitAt(180)).toBe('full');
  });
});

describe('bandAt', () => {
  it('geeft per band een bereik en uitleg', () => {
    expect(bandAt(0).range).toBe('0 – 1/8 gas');
    expect(bandAt(50).range).toBe('1/8 – 3/4 gas');
    expect(bandAt(100).component).toContain('Hoofdsproeier');
    expect(bandAt(50).why.length).toBeGreaterThan(20);
  });
});

describe('activePartsAt', () => {
  it('houdt de altijd-actieve delen in elke stand actief', () => {
    for (const pct of [0, 30, 100]) {
      const ids = activePartsAt(pct);
      for (const id of ALTIJD) expect(ids).toContain(id);
    }
  });

  it('licht stationair alleen op bij gesloten gas', () => {
    const dicht = activePartsAt(0);
    expect(dicht).toContain('stationairsproeier');
    expect(dicht).toContain('luchtschroef');
    expect(dicht).not.toContain('hoofdsproeier');

    const half = activePartsAt(50);
    expect(half).not.toContain('stationairsproeier');
    expect(half).not.toContain('luchtschroef');
  });

  it('licht naald en naaldsproeier op bij halfgas', () => {
    const half = activePartsAt(50);
    expect(half).toContain('naald');
    expect(half).toContain('naaldsproeier');
    expect(half).not.toContain('hoofdsproeier');

    const vol = activePartsAt(100);
    expect(vol).toContain('hoofdsproeier');
    expect(vol).not.toContain('naald');
  });

  it('laat de choke nooit door de gasstand oplichten', () => {
    for (let pct = 0; pct <= 100; pct += 5) {
      expect(activePartsAt(pct)).not.toContain('choke');
    }
  });
});

describe('CARB_PARTS', () => {
  it('heeft unieke id’s en een label per band', () => {
    const ids = CARB_PARTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const part of CARB_PARTS) {
      expect(CARB_BAND_LABELS[part.band]).toBeTruthy();
      expect(part.role.length).toBeGreaterThan(10);
      expect(part.symptoms.length).toBeGreaterThan(0);
      expect(part.adjust.length).toBeGreaterThan(10);
    }
  });
});

describe('throttleSummary', () => {
  it('beschrijft de uiterste standen apart', () => {
    expect(throttleSummary(0)).toContain('stationaircircuit');
    expect(throttleSummary(100)).toContain('hoofdsproeier');
    expect(throttleSummary(50)).toContain('50%');
    expect(throttleSummary(12.5)).toContain('gasnaald');
  });
});
