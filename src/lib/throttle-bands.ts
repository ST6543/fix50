/**
 * Gasstandsbanden — de enige bron voor de bereiken waarin we het mengsel
 * indelen (0–1/8, 1/8–3/4, 3/4–volgas).
 *
 * De afstelkaart (THROTTLE_MAP), de sproeier-simulator en het
 * carburateurdiagram lezen hier allemaal uit, zodat de aanduidingen en de
 * grenzen niet uit elkaar kunnen lopen.
 */

export type ThrottleBandId = 'idle' | 'mid' | 'full';

export interface ThrottleBandDefinition {
  id: ThrottleBandId;
  /** Korte aanduiding met streepje, voor diagrammen, chips en de simulator. */
  label: string;
  /** Volledige omschrijving zoals op de afstelkaart. */
  range: string;
  /** Bovengrens van deze band in procenten gas (de volgende band begint hier). */
  maxPct: number;
}

export const THROTTLE_BANDS: readonly ThrottleBandDefinition[] = [
  { id: 'idle', label: '0 – 1/8 gas', range: '0 tot ±1/8 gas', maxPct: 12.5 },
  { id: 'mid', label: '1/8 – 3/4 gas', range: '±1/8 tot ±3/4 gas', maxPct: 75 },
  { id: 'full', label: '3/4 – volgas', range: '±3/4 tot volgas', maxPct: 100 },
];

/** Grens tussen stationair en halfgas, in procenten gas. */
export const IDLE_MAX_PCT = THROTTLE_BANDS[0]!.maxPct;
/** Grens tussen halfgas en volgas, in procenten gas. */
export const MID_MAX_PCT = THROTTLE_BANDS[1]!.maxPct;

export function throttleBand(id: ThrottleBandId): ThrottleBandDefinition {
  const band = THROTTLE_BANDS.find((b) => b.id === id);
  if (!band) throw new Error(`Onbekende gasstandsband: ${id}`);
  return band;
}

/** Korte aanduiding, bijv. "1/8 – 3/4 gas". */
export function throttleBandLabel(id: ThrottleBandId): string {
  return throttleBand(id).label;
}
