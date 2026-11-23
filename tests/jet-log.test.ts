/** Tests voor de sproeierlog (koppeling simulator → wijzigingslog). */
import { calculateJetSimulation, idleJetTarget, type JetInput } from '@/lib/jet-simulator';
import type { CarbResult } from '@/lib/afstel';
import {
  buildJetChangeRows,
  circuitForKey,
  composeJetNotes,
  describeJetDiff,
  groupHistoryRows,
  groupJetChanges,
  diffJets,
  formatJetValue,
  isJetChangePart,
  JET_BATCH_WINDOW_MS,
  jetUndoNotice,
  latestPendingJetIds,
  measuredResultLine,
  mixtureLine,
  nextStepFor,
  NO_TEST_RESULT,
  splitJetNotes,
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
    expect(rows[0]!.notes.startsWith(NO_TEST_RESULT)).toBe(true);
    expect(rows[0]!.result).toContain('volgas');
  });

  it('zet de volgende stap van het passende circuit in de logregel', () => {
    const next = config({ mainJet: 96, clip: 4, idleJet: 30 });
    const rows = buildJetChangeRows({ prev: config(), next, sim: sim({ mainJet: 96, clip: 4, idleJet: 30 }) });
    const byPart = new Map(rows.map((r) => [r.part, r]));

    expect(byPart.get('Hoofdsproeier')!.nextStep).toContain('sproeier');
    expect(byPart.get('Naaldclip')!.nextStep).toContain('naaldclip');
    expect(byPart.get('Stationairsproeier')!.nextStep).toContain('luchtschroef');
    expect(byPart.get('Hoofdsproeier')!.notes).toContain(byPart.get('Hoofdsproeier')!.nextStep);
  });

  it('houdt de volgende stap ook bij een lege notitie leesbaar', () => {
    const rows = buildJetChangeRows({ prev: config(), next: config({ mainJet: 96 }), sim: sim({ mainJet: 96 }) });
    const parts = splitJetNotes(rows[0]!.notes);
    expect(parts.testNote).toBe(NO_TEST_RESULT);
    expect(parts.nextStep).toBe(rows[0]!.nextStep);
  });
});

describe('latestPendingJetIds', () => {
  const row = (id: string, part: string, changed_at: string, run_id: string | null = null) => ({
    id,
    part,
    changed_at,
    run_id,
  });

  it('kiest alleen de nieuwste wissel die nog wacht', () => {
    const ids = latestPendingJetIds([
      row('oud', 'Hoofdsproeier', '2026-11-19T10:00:00.000Z'),
      row('nieuw-a', 'Hoofdsproeier', '2026-11-19T10:05:00.000Z'),
      row('nieuw-b', 'Naaldclip', '2026-11-19T10:05:00.120Z'),
    ]);
    expect(ids).toEqual(['nieuw-a', 'nieuw-b']);
  });

  it('slaat regels met een meting en niet-sproeierregels over', () => {
    const ids = latestPendingJetIds([
      row('gemeten', 'Hoofdsproeier', '2026-11-19T10:05:00.000Z', 'run-1'),
      row('rollen', 'Rollen', '2026-11-19T10:05:00.100Z'),
      row('sproeier', 'Stationairsproeier', '2026-11-19T10:04:59.900Z'),
    ]);
    expect(ids).toEqual(['sproeier']);
  });

  it('geeft niets terug als er niets wacht of de datum onleesbaar is', () => {
    expect(latestPendingJetIds([])).toEqual([]);
    expect(latestPendingJetIds([row('x', 'Hoofdsproeier', 'geen-datum')])).toEqual([]);
  });

  it('houdt een langere reeks van dezelfde wissel bij elkaar binnen het venster', () => {
    const late = '2026-11-19T10:05:00.000Z';
    const early = new Date(Date.parse(late) - JET_BATCH_WINDOW_MS).toISOString();
    const buiten = new Date(Date.parse(late) - JET_BATCH_WINDOW_MS - 1000).toISOString();
    expect(latestPendingJetIds([row('a', 'Hoofdsproeier', late), row('b', 'Naaldclip', early)])).toEqual(['a', 'b']);
    expect(latestPendingJetIds([row('a', 'Hoofdsproeier', late), row('b', 'Naaldclip', buiten)])).toEqual(['a']);
  });
});

describe('groupJetChanges', () => {
  const row = (id: string, part: string, changed_at: string) => ({ id, part, changed_at, old_value: null, new_value: null });

  it('groepeert de regels van één wissel en slaat andere onderdelen over', () => {
    const groups = groupJetChanges([
      row('b', 'Naaldclip', '2026-11-19T10:05:00.000Z'),
      row('a', 'Hoofdsproeier', '2026-11-19T10:05:00.100Z'),
      row('rollen', 'Rollen', '2026-11-19T10:05:00.000Z'),
      row('oud', 'Hoofdsproeier', '2026-11-19T10:00:00.000Z'),
    ]);
    expect(groups.map((g) => g.map((r) => r.id))).toEqual([['a', 'b'], ['oud']]);
  });

  it('houdt wissels buiten het venster apart', () => {
    const late = '2026-11-19T10:05:00.000Z';
    const netBinnen = new Date(Date.parse(late) - JET_BATCH_WINDOW_MS).toISOString();
    const netBuiten = new Date(Date.parse(late) - JET_BATCH_WINDOW_MS - 1).toISOString();
    expect(groupJetChanges([row('a', 'Hoofdsproeier', late), row('b', 'Naaldclip', netBinnen)])).toHaveLength(1);
    expect(groupJetChanges([row('a', 'Hoofdsproeier', late), row('b', 'Naaldclip', netBuiten)])).toHaveLength(2);
  });

  it('geeft een lege lijst als er niets te groeperen is', () => {
    expect(groupJetChanges([])).toEqual([]);
  });
});

describe('groupHistoryRows', () => {
  const row = (id: string, part: string, changed_at: string) => ({ id, part, changed_at, old_value: null, new_value: null });

  it('maakt één regel per wissel en laat andere wijzigingen los', () => {
    const entries = groupHistoryRows([
      row('b', 'Naaldclip', '2026-11-19T10:05:00.000Z'),
      row('a', 'Hoofdsproeier', '2026-11-19T10:05:00.100Z'),
      row('rollen', 'Rollen', '2026-11-19T10:06:00.000Z'),
      row('oud', 'Hoofdsproeier', '2026-11-19T10:00:00.000Z'),
    ]);
    expect(entries.map((e) => (e.kind === 'jet' ? e.rows.map((r) => r.id) : e.row.id))).toEqual([
      'rollen',
      ['a', 'b'],
      ['oud'],
    ]);
  });

  it('houdt de volgorde van nieuwste naar oudste aan', () => {
    const entries = groupHistoryRows([
      row('oud', 'Hoofdsproeier', '2026-11-19T09:00:00.000Z'),
      row('nieuw', 'Hoofdsproeier', '2026-11-19T11:00:00.000Z'),
    ]);
    expect(entries.map((e) => (e.kind === 'jet' ? e.rows[0]!.id : e.row.id))).toEqual(['nieuw', 'oud']);
  });

  it('geeft een lege lijst als er niets is', () => {
    expect(groupHistoryRows([])).toEqual([]);
  });
});

describe('composeJetNotes', () => {
  it('zet een gecorrigeerd testresultaat terug met de volgende stap', () => {
    expect(composeJetNotes('bougie bruin', 'Sproeier één stap groter')).toBe(
      'bougie bruin · Volgende stap: Sproeier één stap groter',
    );
  });

  it('valt terug op de eerlijke melding zonder testresultaat', () => {
    expect(composeJetNotes('', 'Sproeier één stap groter')).toBe(
      `${NO_TEST_RESULT} · Volgende stap: Sproeier één stap groter`,
    );
  });

  it('levert null bij een lege correctie en blijft splitsbaar', () => {
    expect(composeJetNotes('   ', null)).toBeNull();
    expect(splitJetNotes(composeJetNotes('top 70', null))).toEqual({ testNote: 'top 70', nextStep: null });
  });
});

describe('measuredResultLine', () => {
  it('toont top en 0–50 met Nederlandse decimalen', () => {
    expect(
      measuredResultLine({ max_speed_kmh: 72.4, t0_50_s: 4.321, gps_quality: 'goed' }),
    ).toBe('Gemeten: top 72,4 km/u · 0–50 4,32 s · GPS goed');
  });

  it('zegt eerlijk wat er niet gemeten is', () => {
    expect(measuredResultLine({ max_speed_kmh: 68, t0_50_s: null, gps_quality: 'matig' })).toBe(
      'Gemeten: top 68,0 km/u · 0–50 niet gemeten · GPS matig',
    );
    expect(measuredResultLine({ max_speed_kmh: null, t0_50_s: null, gps_quality: 'slecht' })).toBe(
      'Gemeten: top niet gemeten · 0–50 niet gemeten · GPS slecht',
    );
  });
});

describe('circuitForKey / nextStepFor', () => {
  it('koppelt elk onderdeel aan het juiste gasbereik', () => {
    expect(circuitForKey('mainJet')).toBe('full');
    expect(circuitForKey('clip')).toBe('mid');
    expect(circuitForKey('idleJet')).toBe('idle');
    expect(circuitForKey('airScrew')).toBe('idle');
    expect(nextStepFor('mainJet', sim())).toContain('volgas-test');
  });
});

describe('splitJetNotes', () => {
  it('splitst het testresultaat van de volgende stap', () => {
    const { testNote, nextStep } = splitJetNotes('bougie koffiebruin · Volgende stap: Monteer een sproeier groter (één stap).');
    expect(testNote).toBe('bougie koffiebruin');
    expect(nextStep).toBe('Monteer een sproeier groter (één stap).');
  });

  it('laat oudere regels zonder volgende stap intact', () => {
    expect(splitJetNotes('alleen een testresultaat')).toEqual({ testNote: 'alleen een testresultaat', nextStep: null });
    expect(splitJetNotes(null)).toEqual({ testNote: null, nextStep: null });
    expect(splitJetNotes('   ')).toEqual({ testNote: null, nextStep: null });
  });
});

describe('describeJetDiff', () => {
  it('toont het verschil of meldt dat er niets is gewijzigd', () => {
    expect(describeJetDiff(config(), config())).toContain('Geen wijziging');
    expect(describeJetDiff(config(), config({ mainJet: 96 }))).toBe('94 → 96');
  });
});

describe('jetUndoNotice', () => {
  it('noemt het aantal regels van de verwijderde wissel', () => {
    expect(jetUndoNotice([{}])).toBe('Sproeierwissel verwijderd — je kunt dit nog ongedaan maken.');
    expect(jetUndoNotice([{}, {}, {}])).toBe(
      'Sproeierwissel van 3 regels verwijderd — je kunt dit nog ongedaan maken.',
    );
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
