/** Onderhouds-service: schedules, records, reminders en weeklogica. */
import { query } from './api';
import { supabase } from '@/lib/supabase';
import type {
  MaintenanceItem,
  MaintenanceRecord,
  MaintenanceReminder,
  MaintenanceSchedule,
  WeekTask,
  UUID,
} from '@/types';

/** Eén regel in de week-voorspelling op Home. */
export interface WeekForecastItem {
  schedule: MaintenanceSchedule;
  item: MaintenanceItem;
  /** Verwachte weken tot de beurt; null = geen km/week bekend. */
  weeksUntilDue: number | null;
  overdue: boolean;
  dueLabel: string;
}

export async function listMaintenanceItems(): Promise<MaintenanceItem[]> {
  return query<MaintenanceItem[]>(
    () => supabase.from('maintenance_items').select('*').eq('active', true).order('name'),
  );
}

export async function listSchedules(scooterId: UUID): Promise<MaintenanceSchedule[]> {
  return query<MaintenanceSchedule[]>(
    () => supabase.from('maintenance_schedules').select('*').eq('scooter_id', scooterId),
  );
}

/** Maakt (of actualiseert) schedules voor alle items die bij het brandstofsysteem passen. */
export async function ensureSchedulesForScooter(scooter: {
  id: UUID;
  fuel_system: string | null;
}): Promise<void> {
  const items = await listMaintenanceItems();
  const applies = (i: MaintenanceItem): boolean => {
    if (scooter.fuel_system === '2T') return i.applies_2t;
    if (scooter.fuel_system === '4T') return i.applies_4t;
    if (scooter.fuel_system === 'Injectie') return i.applies_injectie;
    return true;
  };
  const relevant = items.filter(applies);
  if (relevant.length === 0) return;

  // Mid-range interval als startpunt (Excel geeft ranges; configureerbaar per scooter).
  const rows = relevant.map((i) => ({
    scooter_id: scooter.id,
    item_id: i.id,
    interval_km:
      i.interval_km_min !== null && i.interval_km_max !== null
        ? Math.round((i.interval_km_min + i.interval_km_max) / 2)
        : null,
    interval_months:
      i.interval_months_min !== null && i.interval_months_max !== null
        ? Math.round((i.interval_months_min + i.interval_months_max) / 2)
        : null,
    enabled: true,
  }));
  await query<void>(() => supabase.from('maintenance_schedules').upsert(rows, { onConflict: 'scooter_id,item_id' }));
}

export async function updateSchedule(
  scheduleId: UUID,
  patch: Partial<Pick<MaintenanceSchedule, 'interval_km' | 'interval_months' | 'enabled'>>,
): Promise<void> {
  await query<void>(() => supabase.from('maintenance_schedules').update(patch).eq('id', scheduleId));
}

export async function listRecords(scooterId: UUID, limit = 100): Promise<MaintenanceRecord[]> {
  return query<MaintenanceRecord[]>(
    () =>
      supabase
        .from('maintenance_records')
        .select('*')
        .eq('scooter_id', scooterId)
        .order('done_at', { ascending: false })
        .limit(limit),
  );
}

/** Onderhoud registreren: record + schedule & open reminder afronden + interval herberekenen. */
export async function registerMaintenance(args: {
  scooterId: UUID;
  itemId: UUID | null;
  customName?: string | null;
  kmAtService: number | null;
  /** Totale kosten in centen (optioneel). */
  costCents?: number | null;
  /** Gebruikte onderdelen als vrije tekst (optioneel). */
  parts?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Niet ingelogd');

  await query<void>(() =>
    supabase.from('maintenance_records').insert({
      user_id: user.user!.id,
      scooter_id: args.scooterId,
      item_id: args.itemId,
      custom_name: args.customName ?? null,
      km_at_service: args.kmAtService,
      cost_cents: args.costCents ?? null,
      parts: args.parts ?? null,
      notes: args.notes ?? null,
      done_at: new Date().toISOString(),
    }),
  );

  if (args.itemId) {
    const { data: sched } = await supabase
      .from('maintenance_schedules')
      .select('id, interval_km, interval_months')
      .eq('scooter_id', args.scooterId)
      .eq('item_id', args.itemId)
      .maybeSingle();
    if (sched) {
      const nextDueKm =
        args.kmAtService !== null && sched.interval_km
          ? args.kmAtService + sched.interval_km
          : null;
      const nextDueAt = sched.interval_months
        ? new Date(Date.now() + sched.interval_months * 30.44 * 24 * 3600 * 1000)
            .toISOString()
            .slice(0, 10)
        : null;
      await query<void>(() =>
        supabase
          .from('maintenance_schedules')
          .update({
            last_done_km: args.kmAtService,
            last_done_at: new Date().toISOString(),
            next_due_km: nextDueKm,
            next_due_at: nextDueAt,
          })
          .eq('id', sched.id),
      );
      await query<void>(() =>
        supabase
          .from('maintenance_reminders')
          .update({ status: 'afgerond' })
          .eq('schedule_id', sched.id)
          .eq('status', 'open'),
      );
    }
  }
}

export async function listOpenReminders(scooterId: UUID): Promise<MaintenanceReminder[]> {
  return query<MaintenanceReminder[]>(
    () =>
      supabase
        .from('maintenance_reminders')
        .select('*')
        .eq('scooter_id', scooterId)
        .eq('status', 'open')
        .order('severity', { ascending: false }),
  );
}

export async function dismissReminder(id: UUID, status: 'afgerond' | 'genegeerd'): Promise<void> {
  await query<void>(() => supabase.from('maintenance_reminders').update({ status }).eq('id', id));
}

/** Weekoverzicht: taken die deze week of eerder toe zijn. */
export function buildWeekOverview(
  schedules: MaintenanceSchedule[],
  items: MaintenanceItem[],
  currentKm: number,
): WeekTask[] {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  return schedules
    .filter((s) => s.enabled)
    .map((s) => {
      const item = itemById.get(s.item_id);
      if (!item) return null;
      const dueKmOverdue = s.next_due_km !== null && s.next_due_km <= currentKm;
      const dueKmSoon =
        s.next_due_km !== null && s.next_due_km - currentKm <= 250 && !dueKmOverdue;
      const dueAtOverdue = s.next_due_at !== null && new Date(s.next_due_at) <= now;
      const dueAtSoon =
        s.next_due_at !== null &&
        new Date(s.next_due_at) <= weekLater &&
        !dueAtOverdue;

      const overdue = dueKmOverdue || dueAtOverdue;
      const dueThisWeek = dueKmOverdue || dueKmSoon || dueAtOverdue || dueAtSoon;

      const parts: string[] = [];
      if (s.next_due_km !== null) parts.push(`bij ${s.next_due_km.toLocaleString('nl-NL')} km`);
      if (s.next_due_at !== null)
        parts.push(
          `voor ${new Date(s.next_due_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`,
        );
      const dueLabel = parts.join(' · ') || 'interval instellen';

      return { schedule: s, item, dueLabel, overdue, dueThisWeek };
    })
    .filter((t): t is WeekTask => t !== null)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || Number(b.dueThisWeek) - Number(a.dueThisWeek));
}

/**
 * Week-voorspelling: over hoeveel weken is elke taak verwacht, gerekend met
 * het gemiddelde km-verbruik per week. Overdue-taken komen met "nu" terug;
 * taken zonder km-interval maar mét maand-interval worden op datum ingeschat.
 * Gesorteerd op urgentie (meest urgent eerst).
 */
export function buildWeekForecast(
  schedules: MaintenanceSchedule[],
  items: MaintenanceItem[],
  currentKm: number,
  avgKmPerWeek: number | null,
): WeekForecastItem[] {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const now = new Date();
  const out: WeekForecastItem[] = [];

  for (const s of schedules) {
    if (!s.enabled) continue;
    const item = itemById.get(s.item_id);
    if (!item) continue;

    // km-gebaseerde prognose
    if (s.next_due_km !== null) {
      const remainingKm = s.next_due_km - currentKm;
      if (remainingKm <= 0) {
        out.push({ schedule: s, item, weeksUntilDue: 0, overdue: true, dueLabel: 'nu aan de beurt' });
      } else if (avgKmPerWeek !== null && avgKmPerWeek > 0) {
        const weeks = remainingKm / avgKmPerWeek;
        out.push({
          schedule: s,
          item,
          weeksUntilDue: weeks,
          overdue: false,
          dueLabel: `over ~${formatWeeks(weeks)}`,
        });
      } else {
        out.push({
          schedule: s,
          item,
          weeksUntilDue: null,
          overdue: false,
          dueLabel: `over ${remainingKm.toLocaleString('nl-NL')} km`,
        });
      }
      continue;
    }

    // datum-gebaseerde prognose (maand-intervallen)
    if (s.next_due_at !== null) {
      const dueMs = new Date(s.next_due_at).getTime();
      if (Number.isNaN(dueMs)) continue;
      const weeks = (dueMs - now.getTime()) / (7 * 24 * 3600 * 1000);
      if (weeks <= 0) {
        out.push({ schedule: s, item, weeksUntilDue: 0, overdue: true, dueLabel: 'nu aan de beurt' });
      } else {
        out.push({
          schedule: s,
          item,
          weeksUntilDue: weeks,
          overdue: false,
          dueLabel: `over ~${formatWeeks(weeks)}`,
        });
      }
    }
    // geen interval → negeren in de voorspelling
  }

  return out.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      (a.weeksUntilDue ?? Number.POSITIVE_INFINITY) - (b.weeksUntilDue ?? Number.POSITIVE_INFINITY),
  );
}

/** "1 week", "3 weken", "1,5 maand" — afgerond op leesbaarheid. */
export function formatWeeks(weeks: number): string {
  if (weeks < 1) return 'minder dan een week';
  if (weeks < 4) return `${Math.ceil(weeks)} ${Math.ceil(weeks) === 1 ? 'week' : 'weken'}`;
  const months = weeks / 4.345;
  if (months < 10) return `${months.toFixed(months < 3 ? 1 : 0).replace('.', ',')} maand${months >= 2 ? 'en' : ''}`;
  return `${Math.round(months)} maanden`;
}
