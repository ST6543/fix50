/** Tests voor de blokken-kennisbank (dataset-integriteit + koppeling met de afstelhulp). */
import {
  ENGINE_BLOCKS,
  findBlockFromText,
} from '../src/data/engineBlocks';
import {
  calculateCarb,
  ENGINE_FAMILIES,
  CVT_ENGINE_PRESETS,
} from '../src/lib/afstel';

describe('ENGINE_BLOCKS — dataset-integriteit', () => {
  test('alle ids uniek en families bestaan in ENGINE_FAMILIES', () => {
    const ids = ENGINE_BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const familyIds = ENGINE_FAMILIES.map((f) => f.id);
    ENGINE_BLOCKS.forEach((b) => expect(familyIds).toContain(b.family));
  });

  test('plugCode voldoet aan het placeholder-formaat', () => {
    ENGINE_BLOCKS.forEach((b) => {
      expect(b.plugCode).toMatch(/^[A-Z]{1,3}x[A-Z]{0,3}$/);
    });
  });

  test('powerband = [min, max] met min < max in een zinvol gebied', () => {
    ENGINE_BLOCKS.forEach((b) => {
      const [min, max] = b.stockPowerband;
      expect(min).toBeGreaterThan(5000);
      expect(max).toBeLessThan(12000);
      expect(min).toBeLessThan(max);
    });
  });

  test('elk blok heeft carburateurmaten, kits, restrictors en valkuilen', () => {
    ENGINE_BLOCKS.forEach((b) => {
      expect(b.stockCarbMm.length).toBeGreaterThan(0);
      expect(b.kits.length).toBeGreaterThan(0);
      expect(b.restrictors.length).toBeGreaterThan(0);
      expect(b.pitfalls.length).toBeGreaterThan(0);
    });
  });

  test('de schakelblokken (AM6/Derbi) zijn type schakel en LC', () => {
    const am6 = ENGINE_BLOCKS.find((b) => b.id === 'am6')!;
    const derbi = ENGINE_BLOCKS.find((b) => b.id === 'derbi')!;
    [am6, derbi].forEach((b) => {
      expect(b.transmission).toBe('schakel');
      expect(b.koeling).toBe('LC');
    });
  });
});

describe('findBlockFromText — antieke blokkades-match', () => {
  test('AM6-tekst herkent het staande blok', () => {
    expect(findBlockFromText('Minarelli AM6')?.id).toBe('am6');
    expect(findBlockFromText('Rieju RS2 50 (AM6 basis)')?.id).toBe('am6');
  });

  test('Minarelli horizontaal-vs-verticaal', () => {
    expect(findBlockFromText('Yamaha Aerox 50 (Minarelli horizontaal)')?.id).toBe('minarelli-h');
    expect(findBlockFromText('MBK Booster (Minarelli verticaal)')?.id).toBe('minarelli-v');
  });

  test('Piaggio LC vs AC', () => {
    expect(findBlockFromText('Piaggio horizontaal watergekoeld')?.id).toBe('piaggio-lc');
    expect(findBlockFromText('Piaggio Zip 50 2T')?.id).toBe('piaggio-ac');
  });

  test('onbekende tekst geeft null', () => {
    expect(findBlockFromText(null)).toBeNull();
    expect(findBlockFromText('Volkswagen golf 2.0')).toBeNull();
  });
});

describe('koppelingsniveaus met de afstelhulp-modellen', () => {
  test('AM6-blok levert op midrace de BR9ES bougie-passende hittegraad', () => {
    const fam = ENGINE_FAMILIES.find((f) => f.id === 'am6')!;
    const r = calculateCarb({ cc: 70, carbMm: 17.5, material: 'ijzer', setupType: 'midrace', cooling: 'LC', engineFamilyId: fam.id });
    expect(r.heat).toBe(9);
    expect(r.plug).toBe('BR9ES');
  });

  test('CVT-presetlijst bevat ook 70cc midrace (gevolg van blokken-completie)', () => {
    expect(CVT_ENGINE_PRESETS.map((p) => p.label)).toContain('70cc midrace');
  });
});
