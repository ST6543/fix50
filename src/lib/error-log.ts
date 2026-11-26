/**
 * Eén centrale plek waar fouten met schermnaam worden gelogd.
 *
 * De ErrorBoundary gebruikt dit, en schermen kunnen het zelf aanroepen voor
 * fouten die ze afvangen (bijv. een mislukte PDF-export). Naast de console
 * houden we de laatste fouten in het geheugen, zodat een diagnosescherm of
 * supportvraag dezelfde informatie kan tonen zonder logbestanden te zoeken.
 *
 * Puur en testbaar — geen React Native, geen netwerk.
 */

export interface LoggedAppError {
  /** Schermnaam waar de fout optrad, bijv. "Home" of "Onderhoudsgeschiedenis". */
  screen: string;
  message: string;
  /** Optionele extra context, bijv. "factuur" of de componentstack. */
  context?: string;
  stack?: string;
  /** ISO-tijdstip van loggen. */
  at: string;
}

/** Aantal fouten dat in het geheugen bewaard blijft. */
export const ERROR_LOG_LIMIT = 25;

const recent: LoggedAppError[] = [];

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Logt de fout met schermnaam. Geeft het logrecord terug zodat de aanroeper
 * het kan tonen of doorsturen. `console.error` blijft de zichtbare uitgang in
 * development; later kan hier een crashdienst aan worden gehangen.
 */
export function logAppError(error: unknown, screen: string, context?: string): LoggedAppError {
  const entry: LoggedAppError = {
    screen: screen || 'onbekend',
    message: messageOf(error),
    ...(context ? { context } : {}),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    at: new Date().toISOString(),
  };

  recent.unshift(entry);
  if (recent.length > ERROR_LOG_LIMIT) recent.length = ERROR_LOG_LIMIT;

  console.error(
    `[FIX50] ${entry.screen}${entry.context ? ` (${entry.context})` : ''}: ${entry.message}`,
    error,
  );
  return entry;
}

/** Laatste fouten, nieuwste eerst. */
export function recentAppErrors(): readonly LoggedAppError[] {
  return recent;
}

/** Alleen voor tests/diagnose: het geheugen leegmaken. */
export function clearAppErrors(): void {
  recent.length = 0;
}
