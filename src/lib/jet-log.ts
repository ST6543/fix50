/**
 * Sproeierlog — vertaalt een sproeierwissel in de simulator naar regels voor
 * de wijzigingslog (tuning_changes), inclusief het mengselresultaat per
 * gasstand en het testresultaat dat de gebruiker zelf invult.
 *
 * De mengseluitslag is een richtlijn op basis van verhoudingen, geen meting.
 */
import type { CircuitId, JetSimulation } from './jet-simulator';

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
  /** Testresultaat + mengseldetail + volgende stap, zoals opgeslagen in de log. */
  notes: string;
  /** De volgende stap voor het circuit dat bij dit onderdeel hoort. */
  nextStep: string;
}

export const NO_TEST_RESULT = 'Nog geen testresultaat — na de testrit bougiekleur of topsnelheid invullen.';

/** Rijen van dezelfde wissel worden kort na elkaar weggeschreven; dit venster houdt ze bij elkaar. */
export const JET_BATCH_WINDOW_MS = 5000;

/**
 * Welke logregels wachten op de eerstvolgende GPS-test?
 * Alleen de nieuwste wissel telt: is er daarna alweer een nieuwe wissel
 * gelogd, dan hoort de meting bij die laatste stand, niet bij de oude.
 */
export function latestPendingJetIds(
  changes: { id: string; part: string; changed_at: string; run_id?: string | null }[],
): string[] {
  const pending = changes.filter((c) => isJetChangePart(c.part) && !c.run_id);
  const times = pending
    .map((c) => Date.parse(c.changed_at))
    .filter((t) => Number.isFinite(t));
  if (times.length === 0) return [];
  const newest = Math.max(...times);
  return pending
    .filter((c) => {
      const t = Date.parse(c.changed_at);
      return Number.isFinite(t) && newest - t <= JET_BATCH_WINDOW_MS;
    })
    .map((c) => c.id);
}

/** Marker waarmee de volgende stap in de notitie wordt vastgelegd. */
export const NEXT_STEP_PREFIX = 'Volgende stap: ';

export interface JetChangeLike {
  id: string;
  part: string;
  changed_at: string;
  run_id?: string | null;
}

/**
 * Groepeert logregels tot wissels. Regels van dezelfde wissel zijn kort na
 * elkaar weggeschreven en horen bij elkaar; nieuwste wissel eerst.
 * Alleen sproeierregels doen mee, net als in de rest van het logblok.
 */
export function groupJetChanges<T extends JetChangeLike>(changes: T[]): T[][] {
  const rows = changes
    .filter((c) => isJetChangePart(c.part))
    .map((c) => ({ row: c, at: Date.parse(c.changed_at) }))
    .sort((a, b) => (Number.isFinite(b.at) ? b.at : 0) - (Number.isFinite(a.at) ? a.at : 0));

  const groups: T[][] = [];
  let anchor: number | null = null;
  for (const { row, at } of rows) {
    if (anchor === null || !Number.isFinite(at) || anchor - at > JET_BATCH_WINDOW_MS) {
      groups.push([row]);
      anchor = Number.isFinite(at) ? at : null;
      continue;
    }
    groups[groups.length - 1]!.push(row);
  }
  return groups;
}

/**
 * Een regel in een geschiedenislijst: een sproeierwissel (één of meer regels)
 * of een gewone, losse wijziging. Zo houdt de tuninggeschiedenis dezelfde
 * indeling als het logblok in de Afstelhulp.
 */
export type HistoryEntry<T> = { kind: 'jet'; rows: T[] } | { kind: 'single'; row: T };

/**
 * Groepeert alleen de sproeierregels tot wissels en laat alle andere
 * wijzigingen los, in dezelfde volgorde (nieuwste eerst).
 */
export function groupHistoryRows<T extends JetChangeLike>(changes: T[]): HistoryEntry<T>[] {
  const groups = groupJetChanges(changes);
  const groupOf = new Map<string, T[]>();
  for (const group of groups) {
    for (const row of group) groupOf.set(row.id, group);
  }

  const ordered = [...changes].sort((a, b) => {
    const ta = Date.parse(a.changed_at);
    const tb = Date.parse(b.changed_at);
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  const out: HistoryEntry<T>[] = [];
  const emitted = new Set<string>();
  for (const row of ordered) {
    if (!isJetChangePart(row.part)) {
      out.push({ kind: 'single', row });
      continue;
    }
    const group = groupOf.get(row.id) ?? [row];
    const key = group[0]?.id ?? row.id;
    if (emitted.has(key)) continue;
    emitted.add(key);
    out.push({ kind: 'jet', rows: group });
  }
  return out;
}

/** Welk circuit hoort bij een gewijzigd onderdeel? */
export function circuitForKey(key: keyof JetConfig): CircuitId {
  if (key === 'clip') return 'mid';
  if (key === 'mainJet') return 'full';
  return 'idle';
}

/** Volgende stap uit de simulator voor het circuit van dit onderdeel. */
export function nextStepFor(key: keyof JetConfig, sim: JetSimulation): string {
  const id = circuitForKey(key);
  const circuit = sim.circuits.find((c) => c.id === id);
  return circuit?.nextTest ?? 'Test opnieuw en lees de bougie.';
}

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
  const base = note && note.length > 0 ? `${note} — ${mixtureDetail(args.sim)}` : NO_TEST_RESULT;

  return changes.map((c) => {
    const part =
      c.key === 'mainJet'
        ? 'Hoofdsproeier'
        : c.key === 'idleJet'
          ? 'Stationairsproeier'
          : c.key === 'clip'
            ? 'Naaldclip'
            : 'Luchtschroef';
    const nextStep = nextStepFor(c.key, args.sim);
    return {
      part,
      oldValue: formatJetValue(c.key, c.from),
      newValue: formatJetValue(c.key, c.to),
      result,
      notes: `${base} · ${NEXT_STEP_PREFIX}${nextStep}`,
      nextStep,
    };
  });
}

/**
 * Splitst een opgeslagen notitie weer in het testresultaat en de volgende stap.
 * Oudere regels zonder volgende stap geven die als null terug.
 */
export function splitJetNotes(notes: string | null | undefined): { testNote: string | null; nextStep: string | null } {
  const raw = (notes ?? '').trim();
  if (raw.length === 0) return { testNote: null, nextStep: null };
  const idx = raw.indexOf(NEXT_STEP_PREFIX);
  if (idx === -1) return { testNote: raw, nextStep: null };
  const testNote = raw.slice(0, idx).replace(/[·\s]+$/, '').trim();
  const nextStep = raw.slice(idx + NEXT_STEP_PREFIX.length).trim();
  return {
    testNote: testNote.length > 0 ? testNote : null,
    nextStep: nextStep.length > 0 ? nextStep : null,
  };
}

/**
 * Zet een gecorrigeerd testresultaat weer terug in de notitievorm van de log,
 * met de bijbehorende volgende stap erachter.
 */
export function composeJetNotes(testNote?: string | null, nextStep?: string | null): string | null {
  const note = (testNote ?? '').trim();
  const step = (nextStep ?? '').trim();
  if (!note && !step) return null;
  const base = note || NO_TEST_RESULT;
  return step ? `${base} · ${NEXT_STEP_PREFIX}${step}` : base;
}

export interface JetRunMeasure {
  max_speed_kmh: number | null;
  t0_50_s: number | null;
  gps_quality: 'goed' | 'matig' | 'slecht';
}

function fmtDecimal(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

/**
 * Melding na het verwijderen van een gelogde wissel. Bewust met het aantal
 * regels, zodat duidelijk is dat een wissel uit meerdere regels kan bestaan.
 */
export function jetUndoNotice(rows: readonly unknown[]): string {
  return rows.length === 1
    ? 'Sproeierwissel verwijderd — je kunt dit nog ongedaan maken.'
    : `Sproeierwissel van ${rows.length} regels verwijderd — je kunt dit nog ongedaan maken.`;
}

/**
 * Het gemeten resultaat van de gekoppelde GPS-test: top en 0–50, met de
 * GPS-kwaliteit erbij. Ontbrekende waarden worden eerlijk benoemd, niet
 * weggelaten of geschat.
 */
export function measuredResultLine(run: JetRunMeasure): string {
  const top = run.max_speed_kmh === null ? 'top niet gemeten' : `top ${fmtDecimal(run.max_speed_kmh, 1)} km/u`;
  const accel = run.t0_50_s === null ? '0–50 niet gemeten' : `0–50 ${fmtDecimal(run.t0_50_s, 2)} s`;
  return `Gemeten: ${top} · ${accel} · GPS ${run.gps_quality}`;
}

/** Korte samenvatting voor de knop/het logblok in de simulator. */
export function describeJetDiff(prev: JetConfig, next: JetConfig): string {
  const changes = diffJets(prev, next);
  if (changes.length === 0) return 'Geen wijziging sinds de laatste keer opslaan.';
  return changes.map((c) => `${formatJetValue(c.key, c.from)} → ${formatJetValue(c.key, c.to)}`).join(' · ');
}
