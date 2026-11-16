/**
 * Sproeierlog — vertaalt een sproeierwissel in de simulator naar regels voor
 * de wijzigingslog (tuning_changes), inclusief het mengselresultaat per
 * gasstand en het testresultaat dat de gebruiker zelf invult.
 *
 * De mengseluitslag is een richtlijn op basis van verhoudingen, geen meting.
 */
import type { JetSimulation } from './jet-simulator';

export interface JetConfig {
  /** Gemonteerde hoofdsproeier. */
  mainJet: number;
  /** Gemonteerde stationairsproeier. */
  idleJet: number;
  /** Naaldclip, geteld vanaf boven (1 = armst). */
  clip: number;
  /** Luchtschroef in slagen uit. */
  airScrew: number;
}

export interface JetChangeRow {
  /** Naam zoals hij in de tuninggeschiedenis komt. */
  part: string;
  oldValue: string;
  newValue: string;
  /** Mengselresultaat per gasstand. */
  result: string;
  /** Testresultaat van de gebruiker, of een eerlijke melding dat het er nog niet is. */
  notes: string;
}

export const NO_TEST_RESULT = 'Nog geen testresultaat — na de testrit bougiekleur of topsnelheid invullen.';

/** Onderdelen die als sproeierwissel in de log horen. */
export const JET_PART_LABELS = ['Hoofdsproeier', 'Stationairsproeier', 'Naaldclip', 'Luchtschroef'] as const;

/** Herkent logregels die uit de sproeier-simulator komen. */
export function isJetChangePart(part: string): boolean {
  return (JET_PART_LABELS as readonly string[]).includes(part);
}

function fmtScrew(v: number): string {
  return `${v.toFixed(2).replace('.', ',').replace(/,00$/, '').replace(/(,\d)0$/, '$1')} slag`;
}

export function formatJetValue(key: keyof JetConfig, value: number): string {
  if (key === 'airScrew') return fmtScrew(value);
  if (key === 'clip') return `clip ${value}`;
  if (key === 'idleJet') return `${value} stationair`;
  return String(value);
}

/** Welke velden zijn gewijzigd t.o.v. de vorige opgeslagen stand. */
export function diffJets(prev: JetConfig, next: JetConfig): { key: keyof JetConfig; from: number; to: number }[] {
  const keys: (keyof JetConfig)[] = ['mainJet', 'idleJet', 'clip', 'airScrew'];
  return keys.filter((k) => Math.abs(prev[k] - next[k]) > 0.001).map((k) => ({ key: k, from: prev[k], to: next[k] }));
}

/** Korte mengseluitslag per gasstand, bijv. "stationair goed · halfgas iets rijk". */
export function mixtureLine(sim: JetSimulation): string {
  const byId = new Map(sim.circuits.map((c) => [c.id, c.mixture]));
  return [
    `stationair ${byId.get('idle') ?? '—'}`,
    `halfgas ${byId.get('mid') ?? '—'}`,
    `volgas ${byId.get('full') ?? '—'}`,
  ].join(' · ');
}

/** Volledige uitslag met de circuits die aandacht vragen, voor de notitie. */
export function mixtureDetail(sim: JetSimulation): string {
  const risky = sim.circuits.filter((c) => c.mixture !== 'goed');
  const parts = risky.map((c) => `${c.label}: ${c.mixture} (${c.component})`);
  const base = parts.length === 0 ? 'Alle circuits zitten rond het startadvies.' : parts.join(' · ');
  return sim.warnings.length > 0 ? `${base} ⚠ ${sim.warnings[0]}` : base;
}

/**
 * Bouwt de logregels voor één sproeierwissel: één regel per gewijzigd veld,
 * met dezelfde mengseluitslag en hetzelfde testresultaat.
 */
export function buildJetChangeRows(args: {
  prev: JetConfig;
  next: JetConfig;
  sim: JetSimulation;
  testNote?: string | null;
}): JetChangeRow[] {
  const changes = diffJets(args.prev, args.next);
  if (changes.length === 0) return [];

  const result = mixtureLine(args.sim);
  const note = args.testNote?.trim();
  const notes = note && note.length > 0 ? `${note} — ${mixtureDetail(args.sim)}` : NO_TEST_RESULT;

  return changes.map((c) => {
    const part =
      c.key === 'mainJet'
        ? 'Hoofdsproeier'
        : c.key === 'idleJet'
          ? 'Stationairsproeier'
          : c.key === 'clip'
            ? 'Naaldclip'
            : 'Luchtschroef';
    return {
      part,
      oldValue: formatJetValue(c.key, c.from),
      newValue: formatJetValue(c.key, c.to),
      result,
      notes,
    };
  });
}

/** Korte samenvatting voor de knop/het logblok in de simulator. */
export function describeJetDiff(prev: JetConfig, next: JetConfig): string {
  const changes = diffJets(prev, next);
  if (changes.length === 0) return 'Geen wijziging sinds de laatste keer opslaan.';
  return changes.map((c) => `${formatJetValue(c.key, c.from)} → ${formatJetValue(c.key, c.to)}`).join(' · ');
}
