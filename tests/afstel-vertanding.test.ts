/** Tests voor de vertanding/ketting-rekenmodellen (schakelblokken AM6/Derbi). */
import { calculateChainRatio, CHAIN_SPROCKET_PRESETS, PRIMARY_GEAR_INFO } from '../src/lib/afstel';

describe('CHAIN_SPROCKET_PRESETS — dataset-integriteit', () => {
  test('unieke ids en plausibele tandcounts', () => {
    const ids = CHAIN_SPROCKET_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    CHAIN_SPROCKET_PRESETS.forEach((p) => {
      expect(p.front).toBeGreaterThanOrEqual(10);
      expect(p.rear).toBeGreaterThan(p.front);
      expect(p.rear).toBeLessThanOrEqual(75);
      const ratio = p.rear / p.front;
      expect(ratio).toBeGreaterThan(2);
      expect(ratio).toBeLessThan(7);
    });
  });

  test('bekende fabrieksoverbrengingen kloppen met de bronnen', () => {
    const derbiNieuw = CHAIN_SPROCKET_PRESETS.find((p) => p.id === 'derbi-nieuw')!;
    expect(derbiNieuw.front).toBe(11);
    expect(derbiNieuw.rear).toBe(53);
    const riejuMrt = CHAIN_SPROCKET_PRESETS.find((p) => p.id === 'rieju-mrt')!;
    expect(riejuMrt.rear).toBe(52);
    const derbiOud = CHAIN_SPROCKET_PRESETS.find((p) => p.id === 'derbi-oud')!;
    expect(derbiOud.front).toBe(14);
  });

  test('interne primaire verhoudingen zijn vaste teksten voor am6/derbi', () => {
    expect(PRIMARY_GEAR_INFO['am6']).toContain('20/71');
    expect(PRIMARY_GEAR_INFO['derbi']).toContain('21/78');
  });
});

describe('calculateChainRatio', () => {
  test('ratio is achter gedeeld door voor', () => {
    expect(calculateChainRatio(11, 53).ratio).toBeCloseTo(4.82, 2);
    expect(calculateChainRatio(14, 53).ratio).toBeCloseTo(3.79, 2);
  });

  test('zonder referentie: geen delta en algemene vuistregel', () => {
    const r = calculateChainRatio(11, 53);
    expect(r.deltaPct).toBeNull();
    expect(r.direction).toContain('Geen referentie');
  });

  test('kleiner voortandwiel = korter (meer trek) t.o.v. fabriek', () => {
    const r = calculateChainRatio(12, 53, 53 / 11);
    expect(r.deltaPct).toBeCloseTo(-8.3, 1);
    expect(r.direction).toContain('Langer');
  });

  test('groter voortandwiel maakt inrichting langer', () => {
    const r = calculateChainRatio(10, 53, 53 / 11);
    expect(r.deltaPct).toBeGreaterThan(0);
    expect(r.direction).toContain('Korter');
  });

  test('kleine afwijking valt in de neutrale band', () => {
    const r = calculateChainRatio(11, 52, 52 / 11);
    expect(r.direction).toContain('Vrijwel gelijk');
  });
});
