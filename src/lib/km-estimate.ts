/**
 * Automatische kilometerstand-schatting.
 * Basis: de laatst bekende kilometerstand (current_km) + het moment waarop die
 * is vastgesteld (updated_at, wordt server-side gebumpt bij elke update) +
 * het gemiddelde verbruik per week (avg_km_per_week, gebruikersinvoer).
 *
 * De schatting is bewust conservatief: nooit hoger dan een plafonneerbare
 * bovengrens en nooit ongeldig — bij twijfel valt alles terug op de echte
 * kilometerstand. De echte stand blijft leidend; "geschat" is een status, geen feit.
 */
import type { Scooter } from '@/types';

/** Max weken vooruit extrapoleren — daarna is de schatting niet meer betrouwbaar. */
const MAX_EXTRAPOLATION_WEEKS = 26;

/** Resultaat van een km-schatting. */
export interface KmEstimate {
  /** Geschatte huidige kilometerstand (afgerond op hele km). */
  estimatedKm: number;
  /** True als er een schatting is gemaakt op basis van km-per-week. */
  isEstimated: boolean;
  /** Aantal dagen sinds de kilometerstand voor het laatst handmatig is bijgewerkt. */
  daysSinceUpdate: number | null;
  /** Hoeveel km de schatting boven de laatste bekende stand zit. */
  addedKm: number;
  /** True als de schatting is gekapt op de extrapolatiegrens. */
  capped: boolean;
}

const MS_PER_DAY = 24 * 3600 * 1000;

/**
 * Schat de huidige kilometerstand van een scooter.
 * Zonder avg_km_per_week is het resultaat gewoon de laatste bekende stand.
 */
export function estimateCurrentKm(scooter: Pick<Scooter, 'current_km' | 'avg_km_per_week' | 'updated_at'>, now: Date = new Date()): KmEstimate {
  const base = Math.max(0, Math.floor(scooter.current_km));
  const perWeek = scooter.avg_km_per_week;

  // == null vangt óók undefined (veld ontbreekt nog in DB) veilig af.
  if (perWeek == null || perWeek <= 0) {
    return { estimatedKm: base, isEstimated: false, daysSinceUpdate: null, addedKm: 0, capped: false };
  }

  const anchorMs = new Date(scooter.updated_at).getTime();
  if (Number.isNaN(anchorMs)) {
    return { estimatedKm: base, isEstimated: false, daysSinceUpdate: null, addedKm: 0, capped: false };
  }

  const daysSince = Math.max(0, (now.getTime() - anchorMs) / MS_PER_DAY);
  const weeks = daysSince / 7;
  const capped = weeks > MAX_EXTRAPOLATION_WEEKS;
  const effectiveWeeks = Math.min(weeks, MAX_EXTRAPOLATION_WEEKS);
  const addedKm = Math.floor(perWeek * effectiveWeeks);

  return {
    estimatedKm: base + addedKm,
    isEstimated: addedKm > 0,
    daysSinceUpdate: Math.floor(daysSince),
    addedKm,
    capped,
  };
}

/**
 * Rekent km-per-dag om naar km-per-week (1 decimaal) — voor de invoer in EditScooter.
 */
export function weeklyFromDaily(kmPerDay: number): number {
  return Math.round(kmPerDay * 7 * 10) / 10;
}

/**
 * Rekent km-per-week om naar km-per-dag (1 decimaal).
 */
export function dailyFromWeekly(kmPerWeek: number): number {
  return Math.round((kmPerWeek / 7) * 10) / 10;
}

/** Kort menselijk label zoals "3 dagen geleden" of "2 weken geleden" (voor bij de schatting). */
export function kmAnchorLabel(daysSince: number | null): string | null {
  if (daysSince === null) return null;
  if (daysSince <= 0) return 'vandaag bijgewerkt';
  if (daysSince === 1) return '1 dag geleden bijgewerkt';
  if (daysSince < 14) return `${daysSince} dagen geleden bijgewerkt`;
  const weeks = Math.floor(daysSince / 7);
  return weeks === 1 ? '1 week geleden bijgewerkt' : `${weeks} weken geleden bijgewerkt`;
}
