/** Tests voor het teruglezen van opgeslagen setup-parts (Afstelhulp → vergelijken). */
import { calculateCvt, cvtStateFromSetupParts, DEFAULT_CVT_STATE } from '@/lib/afstel';

describe('cvtStateFromSetupParts', () => {
  it('leest numerieke velden exact terug', () => {
    const state = cvtStateFromSetupParts({
      rollen_g: 8.5,
      drukveer_index: 3,
      snaar_mm: 780,
      trekveer_index: 3,
      powerband_min: 8200,
      powerband_max: 9600,
    });
    expect(state.roller).toBe(8.5);
    expect(state.springIndex).toBe(3);
    expect(state.belt).toBe(780);
    expect(state.clutch).toBe(3);
    expect(state.pbMin).toBe(8200);
    expect(state.pbMax).toBe(9600);
  });

  it('valt terug op de leesbare waarde als het numerieke veld ontbreekt', () => {
    const state = cvtStateFromSetupParts({ Rollen: '7,5g', 'V-snaar': '770mm' });
    expect(state.roller).toBe(7.5);
    expect(state.belt).toBe(770);
  });

  it('gebruikt de fallback bij ontbrekende of onzinnige waarden', () => {
    const state = cvtStateFromSetupParts({ rollen_g: 'n.v.t.', snaar_mm: 999 });
    expect(state.roller).toBe(DEFAULT_CVT_STATE.roller);
    expect(state.belt).toBe(830);
  });

  it('houdt de powerband geldig (min blijft onder max)', () => {
    const state = cvtStateFromSetupParts({ powerband_min: 11000, powerband_max: 5500 });
    expect(state.pbMin).toBeLessThanOrEqual(state.pbMax - 500);
    expect(state.pbMax).toBeGreaterThanOrEqual(state.pbMin + 500);
  });

  it('produceert een bruikbaar model voor de vergelijking', () => {
    const a = calculateCvt(cvtStateFromSetupParts({ rollen_g: 7, powerband_min: 8200, powerband_max: 9600 }));
    const b = calculateCvt(cvtStateFromSetupParts({ rollen_g: 11, powerband_min: 7000, powerband_max: 8400 }));
    expect(a.launchScore).not.toBe(b.launchScore);
    expect(a.topSpeed).not.toBe(b.topSpeed);
  });
});
