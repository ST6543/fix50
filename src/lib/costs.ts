/**
 * Kosten per kilometer en maandoverzicht — uit wat er al is opgeslagen:
 * `maintenance_records.cost_cents` en de tankkosten (`total_cents`, anders
 * liters × literprijs). Zuiver en los van React, zodat de rekenregels
 * unit-getest zijn.
 *
 * Eerlijk meten: de meetperiode begint bij de eerste registratie mét een
 * kilometerstand en eindigt bij de hoogste stand sindsdien. Kosten van vóór
 * die eerste stand worden niet meegerekend — je kunt ze niet aan een gemeten
 * afstand toewijzen. Kostenposten zonder kilometerstand tellen wél mee in het
 * totaal, maar niet in de afstand; dat staat als voorbehoud bij de meting.
 * Ontbrekende bedragen worden nooit geschat.
 */
import { formatKm } from './format';
import type { FuelLog, MaintenanceRecord } from '@/types';

export type CostKind = 'onderhoud' | 'brandstof';

/** Eén geregistreerde kostenpost. */
export interface CostEntry {
  id: string;
  kind: CostKind;
  /** Registratiemoment (ISO). */
  at: string;
  /** Kilometerstand bij de registratie; null als die niet is ingevuld. */
  km: number | null;
  amountCents: number;
}

export type CostValidityLevel = 'goed' | 'indicatief' | 'onvoldoende';

/** Hoe betrouwbaar is het bedrag per kilometer, en waarom. */
export interface CostValidity {
  level: CostValidityLevel;
  label: string;
  /** Extra voorbehoud, bijv. kosten zonder kilometerstand. */
  notes: string[];
}

export interface CostMonth {
  /** 'YYYY-MM' */
  month: string;
  /** Bijv. 'november 2026'. */
  label: string;
  maintenanceCents: number;
  fuelCents: number;
  totalCents: number;
  /** Verschil tussen de eerste en laatste kilometerstand van die maand. */
  km: number | null;
  entries: number;
}

export interface CostSummary {
  /** Eerste registratie van de meetperiode (ISO) of null. */
  from: string | null;
  /** Laatste registratie in de meetperiode (ISO) of null. */
  to: string | null;
  /** Kilometerstand waarop de meting begint. */
  fromKm: number | null;
  /** Hoogste kilometerstand sinds die start. */
  toKm: number | null;
  distanceKm: number | null;
  totalCents: number;
  maintenanceCents: number;
  fuelCents: number;
  /** Aantal kostenposten in de meetperiode. */
  entries: number;
  /** Centen per kilometer; null zonder bruikbare afstand. */
  centsPerKm: number | null;
  /** Nieuwste maand eerst. */
  months: CostMonth[];
  validity: CostValidity;
}

/** Drempels voor de geldigheid van het bedrag per kilometer. */
export const RELIABLE_DISTANCE_KM = 300;
export const MINIMUM_DISTANCE_KM = 50;
export const RELIABLE_ENTRIES = 3;

const MONTH_NAMES = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

function isValidDate(iso: string): boolean {
  return Number.isFinite(Date.parse(iso));
}

/**
 * Wat een tankbeurt kostte: het opgeslagen totaalbedrag, anders liters ×
 * literprijs. Null als geen van beide bekend is — nooit een schatting.
 */
export function fuelCostCents(
  log: Pick<FuelLog, 'liters' | 'total_cents' | 'price_per_liter_cents'>,
): number | null {
  if (log.total_cents !== null) return log.total_cents;
  if (log.price_per_liter_cents !== null) {
    return Math.round(log.liters * log.price_per_liter_cents);
  }
  return null;
}

/** 'november 2026' uit een 'YYYY-MM'-sleutel. */
export function formatMonthLabel(month: string): string {
  const [year, index] = month.split('-');
  const name = MONTH_NAMES[Number(index) - 1];
  return name && year ? `${name} ${year}` : month;
}

/** '€0,12/km' — twee decimalen, Nederlandse komma. */
export function formatCentsPerKm(centsPerKm: number): string {
  return `€${(centsPerKm / 100).toFixed(2).replace('.', ',')}/km`;
}

interface KmAnchor {
  at: string;
  km: number;
}

interface EntryTotals {
  maintenanceCents: number;
  fuelCents: number;
}

function totalsOf(entries: CostEntry[]): EntryTotals {
  let maintenanceCents = 0;
  let fuelCents = 0;
  for (const entry of entries) {
    if (entry.kind === 'onderhoud') maintenanceCents += entry.amountCents;
    else fuelCents += entry.amountCents;
  }
  return { maintenanceCents, fuelCents };
}

/** Bouwt het kostenoverzicht van één scooter uit onderhoud en tankbeurten. */
export function buildCostSummary(input: {
  records?: MaintenanceRecord[];
  fuelLogs?: FuelLog[];
}): CostSummary {
  const entries: CostEntry[] = [];
  const anchors: KmAnchor[] = [];

  for (const record of input.records ?? []) {
    if (!isValidDate(record.done_at)) continue;
    if (record.km_at_service !== null) {
      anchors.push({ at: record.done_at, km: record.km_at_service });
    }
    if (record.cost_cents !== null) {
      entries.push({
        id: `onderhoud:${record.id}`,
        kind: 'onderhoud',
        at: record.done_at,
        km: record.km_at_service,
        amountCents: record.cost_cents,
      });
    }
  }

  for (const log of input.fuelLogs ?? []) {
    if (!isValidDate(log.filled_at)) continue;
    anchors.push({ at: log.filled_at, km: log.odometer_km });
    const amount = fuelCostCents(log);
    if (amount !== null) {
      entries.push({
        id: `brandstof:${log.id}`,
        kind: 'brandstof',
        at: log.filled_at,
        km: log.odometer_km,
        amountCents: amount,
      });
    }
  }

  anchors.sort((a, b) => a.at.localeCompare(b.at) || a.km - b.km);
  entries.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

  const firstAnchor = anchors[0] ?? null;
  const lastAnchor = anchors.length > 0 ? anchors[anchors.length - 1]! : null;
  // Zonder kilometerstand begint de meting bij de eerste kostenpost.
  const windowStart = firstAnchor?.at ?? entries[0]?.at ?? null;
  const windowStartMs = windowStart !== null ? Date.parse(windowStart) : null;

  const windowEntries =
    windowStartMs === null
      ? entries
      : entries.filter((entry) => Date.parse(entry.at) >= windowStartMs);
  const excludedEntries = entries.length - windowEntries.length;

  const fromKm = firstAnchor?.km ?? null;
  // Hoogste stand sinds de start: een losse lagere stand (typfout) verlengt de meting niet.
  const toKm = anchors.reduce<number | null>(
    (max, anchor) => (max === null || anchor.km > max ? anchor.km : max),
    null,
  );
  const distanceKm =
    fromKm !== null && toKm !== null && toKm > fromKm ? toKm - fromKm : null;

  const { maintenanceCents, fuelCents } = totalsOf(windowEntries);
  const totalCents = maintenanceCents + fuelCents;
  const centsPerKm = distanceKm !== null && distanceKm > 0 ? totalCents / distanceKm : null;

  const entriesWithoutKm = windowEntries.filter((entry) => entry.km === null).length;
  const entriesWithKm = windowEntries.length - entriesWithoutKm;

  // ── Maandoverzicht ─────────────────────────────────────────
  const byMonth = new Map<string, CostEntry[]>();
  for (const entry of windowEntries) {
    const month = entry.at.slice(0, 7);
    const list = byMonth.get(month) ?? [];
    list.push(entry);
    byMonth.set(month, list);
  }

  const months: CostMonth[] = [...byMonth.entries()]
    .map(([month, list]) => {
      const sums = totalsOf(list);
      const monthAnchors = anchors.filter((anchor) => anchor.at.slice(0, 7) === month);
      const kmValues = monthAnchors.map((anchor) => anchor.km);
      const low = kmValues.length > 0 ? Math.min(...kmValues) : null;
      const high = kmValues.length > 0 ? Math.max(...kmValues) : null;
      return {
        month,
        label: formatMonthLabel(month),
        maintenanceCents: sums.maintenanceCents,
        fuelCents: sums.fuelCents,
        totalCents: sums.maintenanceCents + sums.fuelCents,
        km: low !== null && high !== null && high > low ? high - low : null,
        entries: list.length,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));

  // ── Geldigheid van de meting ───────────────────────────────
  const notes: string[] = [];
  if (entriesWithoutKm > 0) {
    notes.push(
      `${entriesWithoutKm} ${entriesWithoutKm === 1 ? 'kostenpost telt' : 'kostenposten tellen'} mee in het totaal, maar niet in de afstand — er is geen kilometerstand bij ingevuld.`,
    );
  }
  if (excludedEntries > 0) {
    notes.push(
      `${excludedEntries} ${excludedEntries === 1 ? 'registratie valt' : 'registraties vallen'} vóór de eerste kilometerstand en is/zijn niet meegerekend.`,
    );
  }

  let validity: CostValidity;
  if (windowEntries.length === 0) {
    validity = {
      level: 'onvoldoende',
      label: 'Nog geen kosten met een bedrag geregistreerd.',
      notes,
    };
  } else if (distanceKm === null) {
    validity = {
      level: 'onvoldoende',
      label:
        'Nog geen twee kilometerstanden vastgelegd; kosten per kilometer kan niet eerlijk worden berekend.',
      notes,
    };
  } else if (distanceKm >= RELIABLE_DISTANCE_KM && entriesWithKm >= RELIABLE_ENTRIES) {
    validity = {
      level: 'goed',
      label: `Berekend over ${formatKm(distanceKm)} sinds je eerste registratie, met ${entriesWithKm} kostenposten met kilometerstand.`,
      notes,
    };
  } else if (distanceKm >= MINIMUM_DISTANCE_KM) {
    validity = {
      level: 'indicatief',
      label: `${formatKm(distanceKm)} is nog een korte afstand; het bedrag per kilometer kan afwijken.`,
      notes,
    };
  } else {
    validity = {
      level: 'onvoldoende',
      label: `Pas ${formatKm(distanceKm)} gemeten sinds je eerste registratie — te weinig voor een betrouwbaar bedrag per kilometer.`,
      notes,
    };
  }

  return {
    from: windowStart,
    to: lastAnchor?.at ?? windowEntries[windowEntries.length - 1]?.at ?? null,
    fromKm,
    toKm,
    distanceKm,
    totalCents,
    maintenanceCents,
    fuelCents,
    entries: windowEntries.length,
    centsPerKm,
    months,
    validity,
  };
}
