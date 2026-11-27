/**
 * Meldingen → schermen.
 *
 * Twee koppelingen, allebei zuiver en testbaar:
 * 1. Een tik op een onderhoudsmelding wijst de juiste taak aan: eerst op naam
 *    uit de meldingstekst, anders de meest urgente (te late) taak van het plan.
 * 2. De kilometerstand bepaalt welke lokale herinneringen horen te verschijnen:
 *    taken die binnen de ingestelde km-marge of al over het interval zijn.
 *
 * Geen React Native, geen Supabase, geen expo-notifications.
 */
import { buildMaintenancePlan } from '@/lib/maintenance-plan';
import { formatKm } from '@/lib/format';
import type { AppNotification, MaintenanceItem, MaintenanceSchedule } from '@/types';

/** Standaard marge (km) waarbinnen we vooraf waarschuwen. */
export const DEFAULT_REMINDER_KM = 250;

/** Schermen waar een melding naartoe kan wijzen. */
export type NotificationTarget =
  | { screen: 'MaintenanceDetail'; scheduleId: string }
  | { screen: 'Garage'; segment: 'tankbeurten' }
  | { screen: 'PerformanceHistory' }
  | { screen: 'ChatHistory' }
  | null;

/**
 * Welke onderhoudstaak hoort bij deze melding?
 * `null` als de melding niet over onderhoud gaat of er geen plan is.
 */
export function resolveMaintenanceTarget(args: {
  notification: Pick<AppNotification, 'type' | 'title' | 'body'>;
  schedules: MaintenanceSchedule[];
  items: MaintenanceItem[];
  currentKm: number;
  fuelSystem: string | null;
  today?: Date;
}): NotificationTarget {
  const plan = buildMaintenancePlan({
    items: args.items,
    schedules: args.schedules,
    currentKm: args.currentKm,
    fuelSystem: args.fuelSystem,
    today: args.today,
  });
  if (plan.length === 0) return null;

  const text = `${args.notification.title} ${args.notification.body}`.toLowerCase();
  const byName = plan.find((entry) => text.includes(entry.item.name.toLowerCase()));
  if (byName) return { screen: 'MaintenanceDetail', scheduleId: byName.schedule.id };

  // Geen taaknaam in de tekst: alleen onderhoudsmeldingen vallen terug op het plan.
  if (args.notification.type !== 'maintenance') return null;

  const overdue = plan.find((entry) => entry.status === 'te laat');
  return { screen: 'MaintenanceDetail', scheduleId: (overdue ?? plan[0]!).schedule.id };
}

/**
 * Waar landt een tik op deze melding?
 *
 * Onderhoud wijst de taak aan (zie `resolveMaintenanceTarget`). De overige
 * signalen hebben geen taak-id in de melding, maar wél een logische plek:
 * verbruik → tankboek, prestatie → metingen, diagnose → gesprekken. Zo doet
 * een tik nooit niets, ook niet als er (nog) geen onderhoudsplan is.
 */
export function resolveNotificationTarget(args: {
  notification: Pick<AppNotification, 'type' | 'title' | 'body'>;
  schedules: MaintenanceSchedule[];
  items: MaintenanceItem[];
  currentKm: number;
  fuelSystem: string | null;
  today?: Date;
}): NotificationTarget {
  const maintenance = resolveMaintenanceTarget(args);
  if (maintenance) return maintenance;

  switch (args.notification.type) {
    case 'warning':
      return { screen: 'Garage', segment: 'tankbeurten' };
    case 'performance':
      return { screen: 'PerformanceHistory' };
    case 'diagnosis':
      return { screen: 'ChatHistory' };
    default:
      // 'maintenance' zonder plan en 'general' hebben geen logische bestemming.
      return null;
  }
}

export interface LocalReminderCandidate {
  scheduleId: string;
  itemName: string;
  /** Eenmalig per taak én vervalstand: een nieuwe beurt geeft een nieuwe sleutel. */
  key: string;
  title: string;
  body: string;
  dueKm: number;
}

/**
 * Lokale herinneringen die op basis van de huidige km-stand horen te verschijnen.
 * Alleen taken met een km-vervalstand; datum-only taken hebben geen km-prikkel.
 */
export function localReminderCandidates(args: {
  schedules: MaintenanceSchedule[];
  items: MaintenanceItem[];
  currentKm: number;
  fuelSystem: string | null;
  thresholdKm?: number;
  today?: Date;
}): LocalReminderCandidate[] {
  const threshold = Math.max(0, args.thresholdKm ?? DEFAULT_REMINDER_KM);
  return buildMaintenancePlan({
    items: args.items,
    schedules: args.schedules,
    currentKm: args.currentKm,
    fuelSystem: args.fuelSystem,
    today: args.today,
  })
    .filter(
      (entry) =>
        entry.dueKm !== null && entry.remainingKm !== null && entry.remainingKm <= threshold,
    )
    .map((entry) => {
      const dueKm = entry.dueKm!;
      const remaining = entry.remainingKm!;
      const late = remaining <= 0;
      return {
        scheduleId: entry.schedule.id,
        itemName: entry.item.name,
        key: `${entry.schedule.id}:${dueKm}`,
        title: late ? `${entry.item.name} is te laat` : `${entry.item.name} komt eraan`,
        body: late
          ? `Je bent ${formatKm(Math.abs(remaining))} over het interval. Open de taak om hem af te vinken of uit te stellen.`
          : `Nog ${formatKm(remaining)} tot je volgende beurt (bij ${formatKm(dueKm)}).`,
        dueKm,
      };
    });
}
