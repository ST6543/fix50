/**
 * Onderhoudsplan — de verwachtingslijst per scooter.
 *
 * De onderhoudstabel kent per onderdeel een km- én een maand-interval en
 * vlaggen voor 2T / 4T / injectie. Deze module zet die kennis om in één
 * concrete lijst: wat komt eraan, over hoeveel km, en is het al te laat.
 * Puur en testbaar — geen Supabase, geen React Native.
 *
 * Twee eerlijkheidsregels:
 * 1. Zonder geregistreerde beurt is er geen echte "volgende keer". Dan rekenen
 *    we vanaf de huidige kilometerstand en markeren dat als `vanaf nu`.
 * 2. Onderdelen zonder km- én zonder maand-interval ("bij afwijking") horen
 *    niet in een planning en worden overgeslagen.
 */
import { formatDate, formatKm, intervalLabel } from '@/lib/format';
import type { MaintenanceItem, MaintenanceSchedule } from '@/types';

/** Binnen deze afstand (of dagen) heet een taak "binnenkort". */
export const PLAN_SOON_KM = 1000;
export const PLAN_SOON_DAYS = 60;

export type PlanStatus = 'te laat' | 'binnenkort' | 'gepland';
/** `historie` = na een geregistreerde beurt; `vanaf nu` = nog niets geregistreerd. */
export type PlanBasis = 'historie' | 'vanaf nu';
export type PlanGroupKey = 'nu' | 'binnenkort' | 'gepland';

export interface PlanEntry {
  item: MaintenanceItem;
  schedule: MaintenanceSchedule;
  /** Verwachte kilometerstand van de volgende beurt; null = alleen een datum. */
  dueKm: number | null;
  /** Nog te rijden kilometers (negatief = te laat). */
  remainingKm: number | null;
  /** Verwachte datum (YYYY-MM-DD) als het item een maandinterval heeft. */
  dueAt: string | null;
  /** Dagen tot die datum (negatief = verstreken); null zonder datum. */
  daysLeft: number | null;
  status: PlanStatus;
  basis: PlanBasis;
  /** Leesbaar interval, bijvoorbeeld "elke 5.000 km · elke 12 mnd". */
  interval: string;
}

export interface PlanGroup {
  key: PlanGroupKey;
  title: string;
  hint: string;
  entries: PlanEntry[];
}

export interface PlanSummary {
  total: number;
  overdue: number;
  soon: number;
  /** Eerstvolgende taak die nog niet te laat is. */
  next: PlanEntry | null;
}

const DAY_MS = 86_400_000;

/**
 * Past dit onderdeel bij het brandstofsysteem van de scooter?
 * Zonder bekend systeem is er geen betrouwbaar plan: dan false.
 */
export function appliesToFuelSystem(
  item: Pick<MaintenanceItem, 'applies_2t' | 'applies_4t' | 'applies_injectie'>,
  fuelSystem: string | null,
): boolean {
  if (fuelSystem === '2T') return item.applies_2t;
  if (fuelSystem === '4T') return item.applies_4t;
  if (fuelSystem === 'Injectie') return item.applies_injectie;
  return false;
}

/** Datum + maanden, met behoud van de dag (31 jan + 1 mnd = 28/29 feb). */
export function addMonthsIso(iso: string, months: number): string {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, lastDay));
  return base.toISOString().slice(0, 10);
}

/** Aantal dagen tussen twee ISO-datums (YYYY-MM-DD); null bij ongeldige invoer. */
function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / DAY_MS);
}

/**
 * Bouwt de volledige planning: alleen onderdelen die bij deze scooter passen,
 * met een echt interval, gesorteerd op urgentie.
 */
export function buildMaintenancePlan(input: {
  items: MaintenanceItem[];
  schedules: MaintenanceSchedule[];
  currentKm: number;
  fuelSystem: string | null;
  today?: Date;
}): PlanEntry[] {
  const todayIso = (input.today ?? new Date()).toISOString().slice(0, 10);
  const currentKm = Math.max(0, input.currentKm);
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const entries: PlanEntry[] = [];

  for (const schedule of input.schedules) {
    if (!schedule.enabled) continue;
    const item = itemById.get(schedule.item_id);
    if (!item || !item.active) continue;
    if (!appliesToFuelSystem(item, input.fuelSystem)) continue;

    const intervalKm = schedule.interval_km ?? item.interval_km_min ?? item.interval_km_max;
    const intervalMonths =
      schedule.interval_months ?? item.interval_months_min ?? item.interval_months_max;
    // Alleen "bij afwijking" (geen km, geen maanden): geen planning.
    if (intervalKm === null && intervalMonths === null) continue;

    const hasHistory =
      schedule.next_due_km !== null ||
      schedule.last_done_km !== null ||
      schedule.next_due_at !== null;

    const dueKm =
      schedule.next_due_km ??
      (intervalKm !== null ? (schedule.last_done_km ?? currentKm) + intervalKm : null);
    const dueAt =
      schedule.next_due_at ??
      (intervalMonths !== null ? addMonthsIso(todayIso, intervalMonths) : null);

    const remainingKm = dueKm !== null ? dueKm - currentKm : null;
    const daysLeft = dueAt !== null ? daysBetween(todayIso, dueAt) : null;

    const overdue =
      (remainingKm !== null && remainingKm <= 0) || (daysLeft !== null && daysLeft <= 0);
    const soon =
      (remainingKm !== null && remainingKm <= PLAN_SOON_KM) ||
      (daysLeft !== null && daysLeft <= PLAN_SOON_DAYS);

    entries.push({
      item,
      schedule,
      dueKm,
      remainingKm,
      dueAt,
      daysLeft,
      status: overdue ? 'te laat' : soon ? 'binnenkort' : 'gepland',
      basis: hasHistory ? 'historie' : 'vanaf nu',
      interval: intervalLabel(intervalKm, intervalMonths),
    });
  }

  return entries.sort((a, b) => {
    const rank = (entry: PlanEntry) =>
      entry.status === 'te laat' ? 0 : entry.status === 'binnenkort' ? 1 : 2;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);

    const aKm = a.remainingKm ?? Number.POSITIVE_INFINITY;
    const bKm = b.remainingKm ?? Number.POSITIVE_INFINITY;
    if (aKm !== bKm) return aKm - bKm;

    const aDate = a.dueAt ?? '9999-12-31';
    const bDate = b.dueAt ?? '9999-12-31';
    if (aDate !== bDate) return aDate.localeCompare(bDate);

    return a.item.name.localeCompare(b.item.name, 'nl');
  });
}

const GROUP_META: Record<PlanGroupKey, { title: string; hint: string }> = {
  nu: {
    title: 'Nu aan de beurt',
    hint: 'Over het interval heen — plan deze als eerste in.',
  },
  binnenkort: {
    title: 'Binnenkort',
    hint: 'Binnen 1.000 km of twee maanden. Nog geen haast, wel handig om te weten.',
  },
  gepland: {
    title: 'Verder vooruit',
    hint: 'De rest van je onderhoudsplan, op volgorde van wanneer het komt.',
  },
};

/** Groepeert de planning in drie vaste blokken; lege blokken vallen weg. */
export function groupPlan(entries: PlanEntry[]): PlanGroup[] {
  const keys: PlanGroupKey[] = ['nu', 'binnenkort', 'gepland'];
  return keys
    .map((key) => ({
      key,
      title: GROUP_META[key].title,
      hint: GROUP_META[key].hint,
      entries: entries.filter((entry) =>
        key === 'nu'
          ? entry.status === 'te laat'
          : key === 'binnenkort'
            ? entry.status === 'binnenkort'
            : entry.status === 'gepland',
      ),
    }))
    .filter((group) => group.entries.length > 0);
}

/** Telt de urgentie en pakt de eerstvolgende taak voor de kop van het scherm. */
export function summarizePlan(entries: PlanEntry[]): PlanSummary {
  return {
    total: entries.length,
    overdue: entries.filter((entry) => entry.status === 'te laat').length,
    soon: entries.filter((entry) => entry.status === 'binnenkort').length,
    next: entries.find((entry) => entry.status !== 'te laat') ?? null,
  };
}

/**
 * Wat bepaalt de urgentie: de kilometerstand of de datum?
 * Anders zou een datum die verstreken is als "nog 5.000 km" verschijnen.
 */
function dueDriver(entry: PlanEntry): 'km' | 'datum' | null {
  if (entry.remainingKm !== null && entry.remainingKm <= 0) return 'km';
  if (entry.daysLeft !== null && entry.daysLeft <= 0) return 'datum';
  if (entry.remainingKm !== null && entry.remainingKm <= PLAN_SOON_KM) return 'km';
  if (entry.daysLeft !== null && entry.daysLeft <= PLAN_SOON_DAYS) return 'datum';
  if (entry.remainingKm !== null) return 'km';
  if (entry.daysLeft !== null) return 'datum';
  return null;
}

/** Kort label voor in een rij: "nog 1.250 km" of "450 km te laat". */
export function planDueShort(entry: PlanEntry): string {
  const late = entry.status === 'te laat';
  const driver = dueDriver(entry);
  if (driver === 'km' && entry.remainingKm !== null) {
    const km = formatKm(Math.abs(entry.remainingKm));
    return late ? `${km} te laat` : `nog ${km}`;
  }
  if (driver === 'datum' && entry.dueAt !== null) {
    return late ? `was ${formatDate(entry.dueAt)}` : `voor ${formatDate(entry.dueAt)}`;
  }
  return 'geen interval';
}

/** Lang label voor de "volgende"-regel: "nog 1.250 km · bij 13.700 km". */
export function planDueLong(entry: PlanEntry): string {
  const late = entry.status === 'te laat';
  const driver = dueDriver(entry);
  if (driver === 'km' && entry.dueKm !== null && entry.remainingKm !== null) {
    const base = late
      ? `${formatKm(Math.abs(entry.remainingKm))} over het interval`
      : `nog ${formatKm(entry.remainingKm)}`;
    return `${base} · bij ${formatKm(entry.dueKm)}`;
  }
  if (driver === 'datum' && entry.dueAt !== null) {
    return late
      ? `datum verstreken (${formatDate(entry.dueAt)})`
      : `voor ${formatDate(entry.dueAt)}`;
  }
  return 'geen interval';
}
