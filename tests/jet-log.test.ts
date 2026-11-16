/** Tests voor de sproeierlog (koppeling simulator → wijzigingslog). */
import { calculateJetSimulation, idleJetTarget, type JetInput } from '@/lib/jet-simulator';
import type { CarbResult } from '@/lib/afstel';
import {
  buildJetChangeRows,
  describeJetDiff,
  diffJets,
  formatJetValue,
  isJetChangePart,
  mixtureLine,
  NO_TEST_RESULT,
  type JetConfig,
} from '@/lib/jet-log';

const START: CarbResult = {
  jetLow: 90,
  jetHigh: 98,
  clip: 3,
  heat: 8,
  plug: 'BR8HS',
  powerbandRpm: 8000,
};

function config(patch: Partial<JetConfig> = {}): JetConfig {
  return { mainJet: 94, idleJet: idleJetTarget(94), clip: 3, airScrew: 1.5, ...patch };
}

function sim(patch: Partial<JetInput> = {}) {
  const cfg = config(patch as Partial<JetConfig>);
  return calculateJetSimulation({
    start: START,
    mainJet: cfg.mainJet,
    idleJet: cfg.idleJet,
    clip: cfg.clip,
    airScrew: cfg.airScrew,
    ...patch,
  });
}

describe('diffJets', () => {
  it('ziet alleen echte wijzigingen', () => {
    expect(diffJets(config(), config())).toEqual([]);
    const d = diffJets(config(), config({ mainJet: 96, airScrew: 1.75 }));
    expect(d.map((x) => x.key)).toEqual(['mainJet', 'airScrew']);
    expect(d[0]).toEqual({ key: 'mainJet', from: 94, to: 96 });
  });

  it('negeert afrondingsruis', () => {
    expect(diffJets(config({ airScrew: 1.5 }), config({ airScrew: 1.5002 }))).toEqual([]);
  });
});

describe('formatJetValue', () => {
  it('schrijft de waarden leesbaar in het Nederlands', () => {
    expect(formatJetValue('mainJet', 96)).toBe('96');
    expect(formatJetValue('idleJet', 40)).toBe('40 stationair');
    expect(formatJetValue('clip', 2)).toBe('clip 2');
    expect(formatJetValue('airScrew', 1.5)).toBe('1,5 slag');
    expect(formatJetValue('airScrew', 2)).toBe('2 slag');
  });
});

describe('mixtureLine', () => {
  it('vat het mengsel per gasstand samen', () => {
    const line = mixtureLine(sim());
    expect(line).toContain('stationair');
    expect(line).toContain('halfgas');
    expect(line).toContain('volgas');
    expect(line.split(' · ')).toHaveLength(3);
  });
});

describe('buildJetChangeRows', () => {
  it('maakt niets als er niets is gewijzigd', () => {
    expect(buildJetChangeRows({ prev: config(), next: config(), sim: sim() })).toEqual([]);
  });

  it('geeft één regel per gewijzigd onderdeel met hetzelfde mengselresultaat', () => {
    const prev = config();
    const next = config({ mainJet: 96, clip: 4 });
    const rows = buildJetChangeRows({ prev, next, sim: sim({ mainJet: 96, clip: 4 }), testNote: 'bougie koffiebruin' });

    expect(rows).toHaveLength(2);
    expect(rows[0]!.part).toBe('Hoofdsproeier');
    expect(rows[0]!.oldValue).toBe('94');
    expect(rows[0]!.newValue).toBe('96');
    expect(rows[1]!.part).toBe('Naaldclip');
    expect(rows[1]!.newValue).toBe('clip 4');
    expect(rows[0]!.result).toBe(rows[1]!.result);
    expect(rows[0]!.notes).toContain('bougie koffiebruin');
  });

  it('logt eerlijk dat er nog geen testresultaat is', () => {
    const rows = buildJetChangeRows({
      prev: config(),
      next: config({ mainJet: 96 }),
      sim: sim({ mainJet: 96 }),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.notes).toBe(NO_TEST_RESULT);
    expect(rows[0]!.result).toContain('volgas');
  });
});

describe('describeJetDiff', () => {
  it('toont het verschil of meldt dat er niets is gewijzigd', () => {
    expect(describeJetDiff(config(), config())).toContain('Geen wijziging');
    expect(describeJetDiff(config(), config({ mainJet: 96 }))).toBe('94 → 96');
  });
});

describe('isJetChangePart', () => {
  it('herkent alleen sproeierregels', () => {
    expect(isJetChangePart('Hoofdsproeier')).toBe(true);
    expect(isJetChangePart('Naaldclip')).toBe(true);
    expect(isJetChangePart('Rollen')).toBe(false);
    expect(isJetChangePart('Afstelhulp: startafstelling')).toBe(false);
  });
});
