/**
 * Tests voor de blokken-kennisbank-koppeling in de diagnose-chat.
 * Importeert de echte Edge-Function-code (Deno-syntax werkt hier omdat de
 * _shared-modules pure TypeScript zijn).
 */
import { buildBlockContext, formatBlockForPrompt, pickEngineBlock } from '../supabase/functions/_shared/blocks';
import { buildSystemPrompt } from '../supabase/functions/_shared/prompt';
import { ENGINE_BLOCKS } from '../src/data/engineBlocks';

const scooterAm6 = {
  id: 's1',
  name: 'Rieju MRT',
  brand: 'Rieju',
  model: 'MRT 50',
  year: 2019,
  engine_type: 'Minarelli AM6',
  fuel_system: 'carburetor',
  current_km: 12340,
  setup: { bloktype: null },
};

describe('pickEngineBlock', () => {
  test('herkent het blok via engine_type (AM6)', () => {
    expect(pickEngineBlock(scooterAm6)?.id).toBe('am6');
  });

  test('setup.bloktype met een geldig id wint van engine_type', () => {
    const scooter = { ...scooterAm6, engine_type: 'onbestaand blok', setup: { bloktype: 'derbi' } };
    expect(pickEngineBlock(scooter)?.id).toBe('derbi');
  });

  test('merk + model-tekst is een fallback (Derbi Senda)', () => {
    const scooter = { ...scooterAm6, engine_type: null, model: 'Senda DRAC X-treme', setup: null };
    expect(pickEngineBlock(scooter)?.id).toBe('derbi');
  });

  test('geen scooter of onherkenbaar blok → null', () => {
    expect(pickEngineBlock(null)).toBeNull();
    const scooter = { ...scooterAm6, engine_type: 'Zelda square', setup: { bloktype: 'Zelda square' } };
    expect(pickEngineBlock(scooter)).toBeNull();
  });
});

describe('buildBlockContext', () => {
  test('schoenen van het AM6-profiel komen letterlijk in de sectie', () => {
    const ctx = buildBlockContext(scooterAm6)!;
    expect(ctx).toContain('Minarelli AM6');
    expect(ctx).toContain('SCHAKELBAK');
    expect(ctx).toContain('GEEN variator');
    expect(ctx).toContain('BRxES');
    expect(ctx).toContain('kettingtandwiel');
  });

  test('vario-blok krijgt CVT-tekst i.p.v. schakelbak', () => {
    const scooter = { ...scooterAm6, engine_type: 'Yamaha Zuma', setup: { bloktype: 'minarelli-h' } };
    const ctx = buildBlockContext(scooter)!;
    expect(ctx).toContain('vario (CVT)');
    expect(ctx).not.toContain('SCHAKELBAK');
  });

  test('onherkenbaar blok → null (AI krijgt geen profiel)', () => {
    const scooter = { ...scooterAm6, engine_type: 'Zelda square', setup: null };
    expect(buildBlockContext(scooter)).toBeNull();
  });

  test('alle 9 blokken maken een bruikbare sectie met bougiefamilie', () => {
    expect(ENGINE_BLOCKS.length).toBeGreaterThanOrEqual(9);
    for (const b of ENGINE_BLOCKS) {
      const txt = formatBlockForPrompt(b);
      expect(txt).toContain(b.plugCode);
      expect(txt).toMatch(/Standaard carburateurmaten: 12|16|/);
      expect(txt.length).toBeGreaterThan(80);
    }
  });
});

describe('buildSystemPrompt — blokken-sectie', () => {
  const baseArgs = { scooter: null, diagnosisRows: [], maintenance: { recent: [], openReminders: [] } };

  test('zonder blok: geen BLOKKEN-KENNISBANK-sectie', () => {
    const p = buildSystemPrompt(baseArgs);
    expect(p).not.toContain('BLOKKEN-KENNISBANK (FIX50 Afstelhulp');
  });

  test('met blok: sectie aanwezig + schakelblok-regel', () => {
    const p = buildSystemPrompt({ ...baseArgs, blockContext: buildBlockContext(scooterAm6) });
    expect(p).toContain('BLOKKEN-KENNISBANK (FIX50 Afstelhulp');
    expect(p).toContain('kettingtandwiel voor/achter');
  });

  test('regel 9 staat altijd in de prompt (schakelblok ≠ vario)', () => {
    const p = buildSystemPrompt(baseArgs);
    expect(p).toContain('schakelblok (AM6/Derbi)');
    expect(p).toContain('NOOIT');
  });
});
