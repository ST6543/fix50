/** Integriteit van de Fix50 Engine Database. */
import {
  dossierSources,
  ENGINE_DOSSIERS,
  findDossier,
  PLANNED_BLOCKS,
  standardGearbox,
} from '@/data/engineDatabase';

describe('engine-dossiers', () => {
  it('heeft unieke id’s en codes', () => {
    const ids = ENGINE_DOSSIERS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('geeft bij elke versnellingsbakverhouding een bron', () => {
    for (const dossier of ENGINE_DOSSIERS) {
      for (const gb of dossier.gearboxes) {
        expect(gb.source).toBeTruthy();
        for (const gear of gb.gears) {
          expect(gear.ratio).toBeGreaterThan(0);
          expect(gear.ratio).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it('laat de AM6-standaardbak exact kloppen met de opgegeven tandwielparen', () => {
    const am6 = findDossier('am6-v1')!;
    const std = standardGearbox(am6)!;
    expect(std.gears.map((g) => g.ratio)).toEqual([3.0, 2.063, 1.526, 1.227, 1.042, 0.96]);
    // Tandwielparen moeten dezelfde verhouding geven.
    for (const g of std.gears) {
      const [out, input] = g.pair.split('/').map(Number);
      expect(out! / input!).toBeCloseTo(g.ratio, 2);
    }
  });

  it('markeert de racebak als geen standaard AM6-specificatie', () => {
    const am6 = findDossier('am6-v1')!;
    const close = am6.gearboxes.find((g) => g.id === 'am6-v1-close')!;
    expect(close.note?.toLowerCase()).toContain('geen standaard');
  });

  it('geeft de Derbi-bak dezelfde verhoudingen als de opgegeven bron', () => {
    const derbi = findDossier('derbi-ebe-ebs-d50b0')!;
    const std = standardGearbox(derbi)!;
    expect(std.gears[0]!.ratio).toBe(3.091);
    expect(std.gears[5]!.ratio).toBe(0.957);
  });

  it('laat onbekende waarden echt onbekend', () => {
    const tomos = findDossier('tomos-a35')!;
    expect(tomos.boreStroke.value).toBeNull();
    expect(tomos.boreStroke.kind).toBe('onbekend');
    expect(tomos.missing.length).toBeGreaterThan(0);
  });

  it('presenteert de Tomos Streetmate-carburateur alleen voor die uitvoering', () => {
    const a55 = findDossier('tomos-a52-a55')!;
    const carb = a55.stockCarbs[0]!;
    expect(carb.mainJet.value).toBe(55);
    expect(carb.idleJet.value).toBe(25);
    expect(carb.appliesTo.toLowerCase()).toContain('streetmate');
    expect(carb.appliesTo.toLowerCase()).toContain('niet');
  });

  it('houdt de Piaggio-totalen als bereik vast', () => {
    const ciao = findDossier('piaggio-ciao-fam')!;
    const ratios = ciao.totalRatios.map((t) => t.ratio);
    expect(ratios).toContain(13.04);
    expect(Math.min(...ratios)).toBe(12.04);
    expect(Math.max(...ratios)).toBe(20.62);
  });

  it('verzamelt per dossier alle bronnen zonder dubbelingen', () => {
    for (const dossier of ENGINE_DOSSIERS) {
      const sources = dossierSources(dossier);
      expect(new Set(sources).size).toBe(sources.length);
      if (dossier.gearboxes.length > 0) expect(sources.length).toBeGreaterThan(0);
    }
  });

  it('noemt geplande blokken met een status in plaats van verzonnen data', () => {
    expect(PLANNED_BLOCKS.length).toBeGreaterThan(0);
    for (const b of PLANNED_BLOCKS) expect(b.status.length).toBeGreaterThan(10);
    const plannedCodes = PLANNED_BLOCKS.map((b) => b.code);
    expect(plannedCodes).toContain('139QMB');
  });
});
