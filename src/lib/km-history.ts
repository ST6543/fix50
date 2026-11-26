/**
 * Kilometerstand vs. laatste beurt — één controle voor het onderhoudsplan.
 *
 * De planning rekent vanaf de kilometerstand van de laatst geregistreerde beurt.
 * Een stand die daaronder ligt maakt elke taak "te laat" en is bijna altijd een
 * typefout. Daarom waarschuwen we vóór het opslaan en in de plan-hero.
 * Puur en testbaar — geen Supabase, geen React Native.
 */
import { formatKm } from '@/lib/format';
import type { MaintenanceRecord, MaintenanceSchedule } from '@/types';

/** Hoogste km waarop een beurt is geregistreerd; null zonder bruikbare beurt. */
export function lastServiceKmFromRecords(
  records: Pick<MaintenanceRecord, 'km_at_service'>[],
): number | null {
  let highest: number | null = null;
  for (const record of records) {
    const km = record.km_at_service;
    if (km === null || !Number.isFinite(km) || km < 0) continue;
    if (highest === null || km > highest) highest = km;
  }
  return highest;
}

/** Hoogste `last_done_km` uit de planning zelf; null als er nog geen beurt in zit. */
export function highestDoneKm(schedules: Pick<MaintenanceSchedule, 'last_done_km'>[]): number | null {
  let highest: number | null = null;
  for (const schedule of schedules) {
    const km = schedule.last_done_km;
    if (km === null || !Number.isFinite(km) || km < 0) continue;
    if (highest === null || km > highest) highest = km;
  }
  return highest;
}

/** Ligt deze stand onder de laatst geregistreerde beurt? */
export function isBelowLastService(km: number, lastServiceKm: number | null): boolean {
  return lastServiceKm !== null && Number.isFinite(km) && km < lastServiceKm;
}

/** Uitleg voor de bevestiging bij opslaan: waarom de lagere stand het plan verstoort. */
export function kmBehindMessage(km: number, lastServiceKm: number): string {
  return (
    `Je laatste beurt staat op ${formatKm(lastServiceKm)}. ` +
    `Een stand van ${formatKm(km)} ligt daaronder: het plan rekent vanaf die beurt en toont taken dan onterecht te laat. ` +
    'Controleer je invoer of sla toch op als de teller echt is teruggezet.'
  );
}
