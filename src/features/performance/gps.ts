/**
 * GPS-meetlogica voor de performance-meter.
 * Eenvoudige exponential smoothing tegen GPS-ruis (volgens O&O-onderzoek);
 * alle resultaten worden als indicatief gepresenteerd — geen misleidende precisie.
 */
import * as Location from 'expo-location';

export interface GpsSample {
  t: number; // ms sinds start
  speedKmh: number; // gesmoothed
  rawSpeedKmh: number;
  lat: number | null;
  lon: number | null;
  accuracy: number | null;
}

export interface RunMetrics {
  durationS: number;
  distanceM: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  t0_50: number | null;
  t0_80: number | null;
  t50_80: number | null;
  gpsQuality: 'goed' | 'matig' | 'slecht';
}

const ALPHA = 0.25; // smoothing factor: lager = rustiger, hoger = reactiever

export function smoothSpeed(prev: number, rawKmh: number): number {
  return prev + ALPHA * (rawKmh - prev);
}

/** Haversine-afstand in meters. */
export function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** GPS-kwaliteit op basis van gemiddelde accuracy. */
export function gpsQuality(accuracySamples: (number | null)[]): 'goed' | 'matig' | 'slecht' {
  const valid = accuracySamples.filter((a): a is number => typeof a === 'number');
  if (valid.length === 0) return 'slecht';
  const avg = valid.reduce((s, a) => s + a, 0) / valid.length;
  if (avg <= 8) return 'goed';
  if (avg <= 20) return 'matig';
  return 'slecht';
}

/** Berekent run-metrics uit alle samples (tijd in ms, snelheden in km/h). */
export function computeMetrics(samples: GpsSample[]): RunMetrics | null {
  if (samples.length < 2) return null;

  const last = samples[samples.length - 1]!;
  const durationS = (last.t - samples[0]!.t) / 1000;

  // Afstand via punten waar die betrouwbaar is.
  let distanceM = 0;
  for (let i = 1; i < samples.length; i++) {
    const p = samples[i]!;
    const prev = samples[i - 1]!;
    if (p.lat !== null && p.lon !== null && prev.lat !== null && prev.lon !== null) {
      distanceM += haversineM(prev.lat, prev.lon, p.lat, p.lon);
    }
  }

  const maxSpeedKmh = Math.max(...samples.map((s) => s.speedKmh));
  const avgSpeedKmh = samples.reduce((s, x) => s + x.speedKmh, 0) / samples.length;

  function crossingTime(from: number, to: number): number | null {
    let startT: number | null = null;
    for (const s of samples) {
      if (startT === null && s.speedKmh >= from) startT = s.t;
      if (startT !== null && s.speedKmh >= to) return (s.t - startT) / 1000;
    }
    return null;
  }

  const t050 = crossingTime(0, 50);
  const t080 = crossingTime(0, 80);
  const t5080 = crossingTime(50, 80);

  return {
    durationS,
    distanceM,
    maxSpeedKmh,
    avgSpeedKmh,
    t0_50: t050,
    t0_80: t080,
    t50_80: t5080,
    gpsQuality: gpsQuality(samples.map((s) => s.accuracy)),
  };
}

/** Veiligheidscheck vóór het starten van een meting. */
export function isStationaryEnough(location: Location.LocationObject | null): boolean {
  if (!location) return false;
  const kmh = (location.coords.speed ?? 0) * 3.6;
  return kmh < 3;
}
