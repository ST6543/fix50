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

/**
 * Fallback voor oude rijen zonder `group_id`: die zijn vroeger kort na elkaar
 * weggeschreven, dus dit venster houdt ze alsnog bij elkaar. Nieuwe wissels
 * gebruiken het expliciete groeps-id en zijn hier niet van afhankelijk.
 */
export const JET_BATCH_WINDOW_MS = 5000;

/**
 * Welke wissels wachten nog op een GPS-test? Bewust een keuze in de UI in
 * plaats van een tijdvenster: de gebruiker kiest zelf welke wissel hij test.
 */
export function pendingJetGroups<T extends JetChangeLike & { run_id?: string | null }>(changes: T[]): T[][] {
  return groupJetChanges(changes.filter((c) => !c.run_id));
}

/** Heeft deze wissel al een gekoppelde GPS-meting? */
export function jetGroupHasRun<T extends { run_id?: string | null }>(
  group: readonly T[] | null | undefined,
): boolean {
  return !!group?.some((c) => !!c.run_id);
}

/** Waarschuwing vóór een tweede meting op dezelfde wissel. */
export const JET_RETEST_WARNING =
  'Deze wissel heeft al een GPS-meting. Een nieuwe meting vervangt de koppeling met die meting.';

/**
 * Wissels voor de keuzelijst in de GPS-meter: de wachtende wissels, plus de
 * wissel waar je vandaan kwam als die al een meting heeft (opnieuw testen).
 */
export function jetChoices<T extends JetChangeLike>(changes: T[], linkedKey?: string | null): T[][] {
  const pendingIds = new Set(pendingJetGroups(changes).map((g) => g[0]?.id));
  return groupJetChanges(changes).filter(
    (g) => pendingIds.has(g[0]?.id) || (!!linkedKey && g[0]?.id === linkedKey),
  );
}

/** Korte regel voor een wissel in een keuzelijst, bijv. "Hoofdsproeier 94 → 96". */
export function jetGroupLabel<T extends { part: string; old_value?: string | null; new_value?: string | null }>(
  group: T[],
): string {
  const first = group[0];
  if (!first) return 'Sproeierwissel';
  const base = `${first.part} ${first.old_value ?? '—'} → ${first.new_value ?? '—'}`;
  return group.length === 1 ? base : `${base} +${group.length - 1}`;
}

/**
 * Regel op het resultaat: bij welke sproeierwissel deze meting hoort.
 * Zonder koppeling zegt hij dat eerlijk, in plaats van een wissel te gokken.
 */
export function jetRunLinkLine(
  changes: { part: string; old_value?: string | null; new_value?: string | null }[],
): string {
  if (changes.length === 0) return 'Geen sproeierwissel aan deze meting gekoppeld.';
  return changes.map((c) => `${c.part}: ${c.old_value ?? '—'} → ${c.new_value ?? '—'}`).join(' · ');
}

/** Marker waarmee de volgende stap in de notitie wordt vastgelegd. */
export const NEXT_STEP_PREFIX = 'Volgende stap: ';

export interface JetChangeLike {
  id: string;
  part: string;
  changed_at: string;
  run_id?: string | null;
  /** Expliciet groeps-id van de wissel; ontbreekt bij oude rijen. */
  group_id?: string | null;
}

/**
 * Groepeert logregels tot wissels; nieuwste wissel eerst. Regels met hetzelfde
 * `group_id` horen bij elkaar, ongeacht hun tijdstip. Alleen oude rijen zonder
 * groeps-id vallen terug op het oude tijdvenster. Alleen sproeierregels doen
 * mee, net als in de rest van het logblok.
 */
export function groupJetChanges<T extends JetChangeLike>(changes: T[]): T[][] {
  const rows = changes
    .filter((c) => isJetChangePart(c.part))
    .map((c) => ({ row: c, at: Date.parse(c.changed_at) }))
    .sort((a, b) => (Number.isFinite(b.at) ? b.at : 0) - (Number.isFinite(a.at) ? a.at : 0));

  const groups: T[][] = [];
  const byGroupId = new Map<string, T[]>();
  // Alleen oude rijen (zonder group_id) mogen op tijd aan elkaar plakken.
  let legacyGroup: T[] | null = null;
  let anchor: number | null = null;

  for (const { row, at } of rows) {
    const groupId = row.group_id;
    if (groupId) {
      const existing = byGroupId.get(groupId);
      if (existing) {
        existing.push(row);
        continue;
      }
      const group = [row];
      byGroupId.set(groupId, group);
      groups.push(group);
      legacyGroup = null;
      anchor = null;
      continue;
    }

    const withinWindow =
      legacyGroup !== null && anchor !== null && Number.isFinite(at) && anchor - at <= JET_BATCH_WINDOW_MS;
    if (withinWindow) {
      legacyGroup!.push(row);
      continue;
    }

    legacyGroup = [row];
    groups.push(legacyGroup);
    anchor = Number.isFinite(at) ? at : null;
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

/** Welke simulator-instelling hoort bij een logregel? */
export function jetKeyForPart(part: string): keyof JetConfig | null {
  if (part === 'Hoofdsproeier') return 'mainJet';
  if (part === 'Stationairsproeier') return 'idleJet';
  if (part === 'Naaldclip') return 'clip';
  if (part === 'Luchtschroef') return 'airScrew';
  return null;
}

/**
 * Leest een gelogde nieuwe waarde terug naar een getal, in de vorm die
 * `formatJetValue` schrijft ("96", "40 stationair", "clip 3", "1,5 slag").
 * Een onleesbare waarde geeft null: dan blijft de vorige stand staan.
 */
export function parseJetValue(part: string, value: string | null | undefined): number | null {
  const key = jetKeyForPart(part);
  if (!key) return null;
  const m = (value ?? '').match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0]!.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  // Clipstanden lopen van 1 t/m 5; alles daarbuiten is geen geldige stand.
  if (key === 'clip' && (n < 1 || n > 5)) return null;
  return n;
}

/**
 * De stand die nu gemonteerd is, opgebouwd uit de gelogde wissels: oudste
 * eerst, zodat elke wissel de vorige overschrijft. Onderdelen die nooit zijn
 * gelogd houden de meegegeven basiswaarde (het startadvies).
 *
 * Hiermee begint de simulator na een herstart bij de laatst gelogde stand in
 * plaats van weer bij het startadvies.
 */
export function restoreJetConfig(
  changes: { part: string; changed_at: string; new_value?: string | null }[],
  fallback: JetConfig,
): JetConfig {
  const rows = changes
    .map((row) => ({ row, at: Date.parse(row.changed_at) }))
    .filter((x) => Number.isFinite(x.at))
    .sort((a, b) => a.at - b.at);

  const out = { ...fallback };
  for (const { row } of rows) {
    const key = jetKeyForPart(row.part);
    if (!key) continue;
    const value = parseJetValue(row.part, row.new_value);
    if (value !== null) out[key] = value;
  }
  return out;
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
 * Bevestiging vóór het verwijderen van een meting. Met een gekoppelde wissel
 * benoemt de tekst dat de koppeling meeverdwijnt, zodat één tik geen bewijs
 * stil wegneemt.
 */
export function runDeleteNotice(hasLinkedChange: boolean): string {
  return hasLinkedChange
    ? 'Deze meting verdwijnt. De koppeling met de sproeierwissel verdwijnt mee; die wacht daarna weer op een meting.'
    : 'Deze meting verdwijnt definitief uit je metingen.';
}

/**
 * Notitietekst voor weergave. De placeholdernotitie ("nog geen testresultaat")
 * is misleidend zodra er een GPS-meting aan de wissel hangt: dan tonen we hem
 * niet, want de gemeten regel vertelt het resultaat al. Andere notities blijven
 * gewoon staan.
 */
export function visibleTestNote(testNote: string | null | undefined, hasRun: boolean): string | null {
  const note = (testNote ?? '').trim();
  if (!note) return null;
  if (hasRun && note.startsWith(NO_TEST_RESULT)) return null;
  return note;
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
