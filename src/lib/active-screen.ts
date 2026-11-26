/**
 * Naam van het scherm dat nu zichtbaar is.
 *
 * De navigator zet hem bij elke routewissel; foutlogs en de ErrorBoundary
 * lezen hem zonder de navigatie te hoeven importeren (voorkomt een zware
 * of cirkelvormige import in de foutafhandeling).
 */

let activeScreen: string | null = null;

export function setActiveScreen(name: string | null): void {
  activeScreen = name;
}

export function getActiveScreen(): string {
  return activeScreen ?? 'app';
}
