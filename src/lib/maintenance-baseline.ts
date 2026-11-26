/**
 * Onderhoudsbaseline bij onboarding.
 *
 * Een nieuwe gebruiker weet vaak nog wanneer de laatste beurt was. Die km en
 * datum zijn het eerlijke startpunt van de planning: daar rekenen we de eerste
 * vervalstand en vervaldatum vandaan, in plaats van vanaf de dag van aanmelden.
 * Zonder beurt ("net gekocht") blijft de bestaande regel gelden: rekenen vanaf
 * de huidige stand en vandaag, en dat ook zo benoemen.
 *
 * Puur en testbaar — geen Supabase, geen React Native.
 */
import { addMonthsIso } from '@/lib/maintenance-plan';

export interface ServiceBaseline {
  /** Kilometerstand bij de laatste beurt; null als die niet bekend is. */
  km: number | null;
  /** Datum van de laatste beurt als jjjj-mm-dd; null als die niet bekend is. */
  doneAtIso: string | null;
}

export interface BaselineDueFields {
  last_done_km: number | null;
  last_done_at: string | null;
  next_due_km: number | null;
  next_due_at: string | null;
}

/** Vaste tijd op de beurtdatum: 12:00 UTC houdt de lokale kalenderdag gelijk. */
const BASELINE_TIME = 'T12:00:00.000Z';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Vulvelden voor een nieuwe schedule op basis van de opgegeven beurt.
 * Zonder bruikbare baseline blijven alle velden leeg: dan geldt "vanaf nu".
 */
export function baselineDueFields(args: {
  baseline: ServiceBaseline | null;
  intervalKm: number | null;
  intervalMonths: number | null;
}): BaselineDueFields {
  const empty: BaselineDueFields = {
    last_done_km: null,
    last_done_at: null,
    next_due_km: null,
    next_due_at: null,
  };
  const baseline = args.baseline;
  if (!baseline) return empty;

  const km =
    baseline.km !== null && Number.isFinite(baseline.km) && baseline.km >= 0
      ? Math.round(baseline.km)
      : null;
  const doneAt = baseline.doneAtIso && ISO_DATE.test(baseline.doneAtIso) ? baseline.doneAtIso : null;
  if (km === null && doneAt === null) return empty;

  return {
    last_done_km: km,
    last_done_at: doneAt ? `${doneAt}${BASELINE_TIME}` : null,
    next_due_km:
      km !== null && args.intervalKm !== null && args.intervalKm > 0 ? km + args.intervalKm : null,
    next_due_at:
      doneAt !== null && args.intervalMonths !== null && args.intervalMonths > 0
        ? addMonthsIso(doneAt, args.intervalMonths)
        : null,
  };
}
