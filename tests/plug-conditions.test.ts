/**
 * Tests voor de plug-photo mapping (isolatorneus → advies) uit de
 * Edge-Function _shared. Bron: knowledge-bank sectie 7 (NGK).
 */
import { PLUG_CONDITIONS, PLUG_CONDITION_KEYS } from '../supabase/functions/_shared/plugConditions';

describe('PLUG_CONDITIONS — kennisbank-mapping (NGK)', () => {
  test('bevat alle zeven bekende condities', () => {
    expect(PLUG_CONDITION_KEYS).toEqual([
      'koffiebruin-gezond',
      'lichtgrijs-as',
      'te-rijk',
      'te-veel-olie',
      'te-arm-te-heet',
      'oververhitting',
      'onduidelijk',
    ]);
  });

  test('te arm/te heet wordt geadviseerd met rijker + kouder', () => {
    const arm = PLUG_CONDITIONS['te-arm-te-heet'];
    expect(arm.jet_direction).toContain('rijker');
    expect(arm.plug_grade_direction).toContain('kouder');
    expect(arm.explanation).toContain('stoppen');
  });

  test('te rijk = alleen sproeier-richting, geen andere', () => {
    const rijk = PLUG_CONDITIONS['te-rijk'];
    expect(rijk.jet_direction).toContain('rijker');
    expect(rijk.jet_direction).toContain('kleiner');
    expect(rijk.plug_grade_direction).toBeNull();
  });

  test('gezond en grijs geven géén maat-advies', () => {
    for (const key of ['koffiebruin-gezond', 'lichtgrijs-as'] as const) {
      expect(PLUG_CONDITIONS[key].jet_direction).toBeNull();
      expect(PLUG_CONDITIONS[key].plug_grade_direction).toBeNull();
    }
  });

  test('te veel olie verwijst naar de olieratio, niet naar de sproeier', () => {
    const olie = PLUG_CONDITIONS['te-veel-olie'];
    expect(olie.explanation).toContain('olie');
    expect(olie.jet_direction).toBeNull();
  });

  test('oververhitting verwijst naar pre-ignition en adviseren koeler', () => {
    const over = PLUG_CONDITIONS['oververhitting'];
    expect(over.label).toContain('Oververhitting');
    expect(over.explanation).toContain('pre-ignition');
    expect(over.plug_grade_direction).toContain('kouder');
  });

  test('onduidelijk geeft de leesprocedure, geen maat-advies', () => {
    const onduidelijk = PLUG_CONDITIONS['onduidelijk'];
    expect(onduidelijk.explanation).toContain('30-60');
    expect(onduidelijk.jet_direction).toBeNull();
  });
});
