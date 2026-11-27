/**
 * Scootertijdlijn — brengt onderhoud, tankbeurten, tuningwijzigingen, metingen
 * en diagnosegesprekken op één chronologische lijn. Zuiver en los van React,
 * zodat de volgorde en de teksten unit-getest kunnen worden.
 *
 * Eén sproeierwissel blijft één gebeurtenis: de regels met hetzelfde groeps-id
 * horen bij elkaar (zie `groupHistoryRows`). Ontbrekende meetwaarden worden
 * eerlijk benoemd, nooit geschat.
 */
import { formatKm, formatSpeed } from './format';
import { groupHistoryRows, jetGroupLabel, splitJetNotes } from './jet-log';
import type {
  ChatSession,
  FuelLog,
  MaintenanceItem,
  MaintenanceRecord,
  PerformanceRun,
  TuningChange,
} from '@/types';

export type TimelineKind = 'onderhoud' | 'tankbeurt' | 'tuning' | 'meting' | 'diagnose';

export interface TimelineEvent {
  /** Stabiele sleutel voor de lijst (per bron uniek). */
  id: string;
  kind: TimelineKind;
  /** Moment van de gebeurtenis (ISO). Ongeldige datums vallen af. */
  at: string;
  title: string;
  /** Tweede regel met de inhoud; null als er niets te melden is. */
  detail: string | null;
  /** Korte labels onderaan, zoals km, kosten of GPS-kwaliteit. */
  meta: string[];
}

export interface TimelineInput {
  records?: MaintenanceRecord[];
  items?: MaintenanceItem[];
  fuelLogs?: FuelLog[];
  changes?: TuningChange[];
  runs?: PerformanceRun[];
  sessions?: ChatSession[];
}

/** Volgorde van de bronnen; bepaalt ook de volgorde bij hetzelfde tijdstip. */
export const TIMELINE_KINDS: { key: TimelineKind; label: string }[] = [
  { key: 'onderhoud', label: 'Onderhoud' },
  { key: 'tankbeurt', label: 'Tankbeurt' },
  { key: 'tuning', label: 'Tuning' },
  { key: 'meting', label: 'Meting' },
  { key: 'diagnose', label: 'Diagnose' },
];

const KIND_ORDER: Record<TimelineKind, number> = {
  onderhoud: 0,
  tankbeurt: 1,
  tuning: 2,
  meting: 3,
  diagnose: 4,
};

function liters(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} L`;
}

/** Bedrag in centen als "€12,50" — dezelfde notatie als de rest van de app. */
function euros(cents: number): string {
  return `€${(cents / 100).toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function seconds(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} s`;
}

export function buildScooterTimeline(input: TimelineInput): TimelineEvent[] {
  const items = new Map((input.items ?? []).map((item) => [item.id, item]));
  const events: TimelineEvent[] = [];

  // Onderhoud: elke registratie is één moment, met de onderdeelnaam erbij.
  for (const record of input.records ?? []) {
    const name =
      record.custom_name ?? (record.item_id ? items.get(record.item_id)?.name : null) ?? 'Onderhoud';
    const meta: string[] = [];
    if (record.km_at_service !== null) meta.push(formatKm(record.km_at_service));
    if (record.cost_cents !== null) meta.push(euros(record.cost_cents));
    events.push({
      id: `onderhoud:${record.id}`,
      kind: 'onderhoud',
      at: record.done_at,
      title: name,
      detail: record.parts ? `Onderdelen: ${record.parts}` : record.notes ?? null,
      meta,
    });
  }

  // Tankbeurten: liters en stand; de prijs alleen als hij is ingevuld.
  for (const log of input.fuelLogs ?? []) {
    const meta: string[] = [formatKm(log.odometer_km)];
    const paid = log.total_cents ?? null;
    if (paid !== null) meta.push(euros(paid));
    events.push({
      id: `tankbeurt:${log.id}`,
      kind: 'tankbeurt',
      at: log.filled_at,
      title: log.station ? `Getankt bij ${log.station}` : 'Tankbeurt',
      detail: `${liters(log.liters)} getankt`,
      meta,
    });
  }

  // Tuning: een sproeierwissel met meerdere regels blijft één gebeurtenis.
  for (const entry of groupHistoryRows(input.changes ?? [])) {
    const first = entry.kind === 'jet' ? entry.rows[0] : entry.row;
    if (!first) continue;
    const notes = splitJetNotes(first.notes);
    const from = first.old_value ?? '—';
    const to = first.new_value ?? '—';
    const meta: string[] = [];
    if (first.km_at_change !== null) meta.push(formatKm(first.km_at_change));

    events.push({
      id: `tuning:${first.group_id ?? first.id}`,
      kind: 'tuning',
      at: first.changed_at,
      title: entry.kind === 'jet' ? jetGroupLabel(entry.rows) : `${first.part}: ${from} → ${to}`,
      detail: notes.testNote ?? first.result ?? null,
      meta,
    });
  }

  // Metingen: topsnelheid en 0–50 zoals gemeten, ontbrekende waarden benoemd.
  for (const run of input.runs ?? []) {
    const parts: string[] = [];
    parts.push(
      run.t0_50_s === null ? '0–50 niet gemeten' : `0–50 ${seconds(run.t0_50_s)}`,
    );
    parts.push(run.max_speed_kmh === null ? 'top niet gemeten' : `top ${formatSpeed(run.max_speed_kmh)}`);
    events.push({
      id: `meting:${run.id}`,
      kind: 'meting',
      at: run.started_at,
      title: run.max_speed_kmh === null ? 'GPS-meting' : `Meting: ${formatSpeed(run.max_speed_kmh)} top`,
      detail: parts.join(' · '),
      meta: [`GPS ${run.gps_quality}`],
    });
  }

  // Diagnose: alleen gesprekken die aan deze scooter hangen.
  for (const session of input.sessions ?? []) {
    events.push({
      id: `diagnose:${session.id}`,
      kind: 'diagnose',
      at: session.updated_at,
      title: session.title,
      detail: 'Diagnosegesprek met de assistent',
      meta: [],
    });
  }

  return events
    .filter((event) => Number.isFinite(Date.parse(event.at)))
    .sort((a, b) => {
      const diff = Date.parse(b.at) - Date.parse(a.at);
      if (diff !== 0) return diff;
      // Zelfde moment: vaste bronvolgorde, daarna de id — altijd dezelfde lijn.
      return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id);
    });
}

/** Filtert de lijn op één soort gebeurtenis; 'alles' laat de hele lijn staan. */
export function filterTimeline(
  events: TimelineEvent[],
  kind: TimelineKind | 'alles',
): TimelineEvent[] {
  return kind === 'alles' ? events : events.filter((event) => event.kind === kind);
}

/** Aantal gebeurtenissen per soort, voor de filterknoppen. */
export function timelineCounts(events: TimelineEvent[]): Record<TimelineKind, number> {
  const counts: Record<TimelineKind, number> = {
    onderhoud: 0,
    tankbeurt: 0,
    tuning: 0,
    meting: 0,
    diagnose: 0,
  };
  for (const event of events) counts[event.kind] += 1;
  return counts;
}
