/** Tests voor de sproeier-simulator. */
import { calculateJetSimulation, idleJetTarget, type JetInput } from '@/lib/jet-simulator';
import type { CarbResult } from '@/lib/afstel';

const START: CarbResult = {
  jetLow: 90,
  jetHigh: 98,
  clip: 3,
  heat: 8,
  plug: 'BR8HS',
  powerbandRpm: 8000,
};

function input(patch: Partial<JetInput> = {}): JetInput {
  return {
    start: START,
    mainJet: Math.round((START.jetLow + START.jetHigh) / 2),
    idleJet: idleJetTarget(Math.round((START.jetLow + START.jetHigh) / 2)),
    clip: START.clip,
    airScrew: 1.5,
    ...patch,
  };
}

describe('idleJetTarget', () => {
  it('houdt de vuistregel binnen bruikbare grenzen', () => {
    expect(idleJetTarget(30)).toBe(28);
    expect(idleJetTarget(95)).toBe(38);
    expect(idleJetTarget(300)).toBe(60);
  });
});

describe('calculateJetSimulation', () => {
  it('geeft "goed" als alles rond het startadvies zit', () => {
    const sim = calculateJetSimulation(input());
    expect(sim.overall).toBe('goed');
    expect(sim.circuits.map((c) => c.mixture)).toEqual(['goed', 'goed', 'goed']);
    expect(sim.warnings).toHaveLength(0);
  });

  it('meldt arm bij volgas en waarschuwt voor motorschade', () => {
    const sim = calculateJetSimulation(input({ mainJet: 86, idleJet: idleJetTarget(86) }));
    const full = sim.circuits.find((c) => c.id === 'full')!;
    expect(full.mixture).toBe('arm');
    expect(full.risk).toContain('warmloper');
    expect(sim.overall).toBe('arm');
    expect(sim.warnings.join(' ')).toContain('volgas');
  });

  it('meldt rijk bij een te grote hoofdsproeier', () => {
    const sim = calculateJetSimulation(input({ mainJet: 104, idleJet: idleJetTarget(104) }));
    expect(sim.overall).toBe('rijk');
    expect(sim.circuits.find((c) => c.id === 'full')!.mixture).toBe('rijk');
  });

  it('laat de naald het middengebied bepalen', () => {
    const richer = calculateJetSimulation(input({ clip: 2 }));
    const leaner = calculateJetSimulation(input({ clip: 5 }));
    expect(richer.circuits.find((c) => c.id === 'mid')!.mixture).toBe('iets rijk');
    expect(['iets arm', 'arm']).toContain(leaner.circuits.find((c) => c.id === 'mid')!.mixture);
    expect(richer.circuits.find((c) => c.id === 'mid')!.delta).toBeGreaterThan(0);
    expect(leaner.circuits.find((c) => c.id === 'mid')!.delta).toBeLessThan(0);
  });

  it('herkent een gemengde afstelling (arm stationair, rijk volgas)', () => {
    const sim = calculateJetSimulation(input({ idleJet: 30, mainJet: 104 }));
    expect(sim.overall).toBe('gemengd');
    expect(sim.summary).toContain('stationair');
  });

  it('geeft bij elke afwijking een concrete volgende test', () => {
    const sim = calculateJetSimulation(input({ mainJet: 86, idleJet: 45, clip: 5 }));
    for (const circuit of sim.circuits) {
      expect(circuit.nextTest.length).toBeGreaterThan(10);
    }
  });

  it('noemt nooit een vaste mengverhouding of percentage', () => {
    const sim = calculateJetSimulation(input({ mainJet: 86 }));
    const text = [sim.summary, ...sim.circuits.map((c) => c.risk ?? ''), ...sim.warnings].join(' ');
    expect(text).not.toMatch(/\d+:\d+/);
    expect(text).not.toMatch(/\d+%/);
  });
});
