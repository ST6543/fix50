/**
 * Tankbeurt-service: registreren, lijst en verbruiksberekening.
 * Verbruik wordt berekend tussen opeenvolgende tankbeurten:
 * liters bij de latere beurt gedeeld door de gereden km ertussen.
 * We tonen het als "1 op X" (km per liter) — L/100km blijft intern beschikbaar
 * (o.a. voor het PDF-boekje). De allereerste beurt heeft geen beginstand en
 * levert dus geen verbruik op.
 */
import { query } from './api';
import { supabase } from '@/lib/supabase';
import type { FuelLog, UUID } from '@/types';

export async function listFuelLogs(scooterId: UUID, limit = 200): Promise<FuelLog[]> {
  return query<FuelLog[]>(
    () =>
      supabase
        .from('fuel_logs')
        .select('*')
        .eq('scooter_id', scooterId)
        .order('odometer_km', { ascending: false })
        .limit(limit),
  );
}

export async function addFuelLog(args: {
  scooterId: UUID;
  odometerKm: number;
  liters: number;
  filledAt?: string;
  pricePerLiterCents?: number | null;
  totalCents?: number | null;
  station?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Niet ingelogd');

  await query<void>(() =>
    supabase.from('fuel_logs').insert({
      user_id: user.user!.id,
      scooter_id: args.scooterId,
      odometer_km: args.odometerKm,
      liters: args.liters,
      filled_at: args.filledAt ?? new Date().toISOString(),
      price_per_liter_cents: args.pricePerLiterCents ?? null,
      total_cents: args.totalCents ?? null,
      station: args.station ?? null,
      notes: args.notes ?? null,
    }),
  );
}

export async function deleteFuelLog(id: UUID): Promise<void> {
  await query<void>(() => supabase.from('fuel_logs').delete().eq('id', id));
}

/** Eén verbruiksmeting tussen twee tankbeurten. */
export interface ConsumptionPoint {
  /** L/100km tussen de vorige en deze beurt (intern/afgeleid). */
  lPer100km: number;
  /** Km per liter tussen de vorige en deze beurt — de "1 op X"-waarde. */
  kmPerLiter: number;
  /** Gereden km tussen de beurten. */
  distanceKm: number;
  /** Kilometerstand van de latere beurt. */
  odometerKm: number;
  /** Tankdatum van de latere beurt (voor seizoens-/trendanalyse). */
  filledAtIso: string;
}

/** Totaaloverzicht voor de tankbeurt-statistiek. */
export interface FuelStats {
  /** Per beurt het verbruik t.o.v. de vorige (oudste eerst). */
  points: ConsumptionPoint[];
  /** Gemiddeld verbruik over alle tussenruimtes; null met minder dan 2 beurten. */
  avgLPer100km: number | null;
  /** Gemiddeld verbruik als km per liter ("1 op X"); null met minder dan 2 beurten. */
  avgKmPerLiter: number | null;
  /** Totaal getankte liters. */
  totalLiters: number;
  /** Totaal betaald in centen (alleen beurten met total_cents of prijs×liters). */
  totalCents: number;
  /** Aantal geregistreerde beurten. */
  count: number;
}

/**
 * Bereken verbruik uit tankbeurten, chronologisch gesorteerd op tankdatum.
 * Bij gelijke datum telt de invoervolgorde (stabiele sort). Beurten met
 * dezelfde/lagere stand dan de vorige beurt in tijd (typfout of dubbele invoer)
 * worden volledig overgeslagen en vervuilen het gemiddelde niet.
 * Zuivere functie — unit-getest.
 */
export function computeFuelStats(logs: FuelLog[]): FuelStats {
  const sorted = [...logs].sort((a, b) => a.filled_at.localeCompare(b.filled_at));

  const points: ConsumptionPoint[] = [];
  let prev: FuelLog | null = null;
  let totalLiters = 0;
  let totalCents = 0;

  for (const log of sorted) {
    totalLiters += log.liters;
    if (log.total_cents !== null) {
      totalCents += log.total_cents;
    } else if (log.price_per_liter_cents !== null) {
      totalCents += Math.round(log.liters * log.price_per_liter_cents);
    }

    if (prev !== null && log.odometer_km > prev.odometer_km) {
      const distanceKm = log.odometer_km - prev.odometer_km;
      const lPer100km = (log.liters / distanceKm) * 100;
      points.push({
        distanceKm,
        odometerKm: log.odometer_km,
        lPer100km,
        kmPerLiter: lPer100km > 0 ? 100 / lPer100km : 0,
        filledAtIso: log.filled_at,
      });
      // Alleen een geldige vooruitgang is het nieuwe referentiepunt;
      // typfouten (zelfde/lagere stand) worden volledig genegeerd.
      prev = log;
    } else if (prev === null) {
      prev = log;
    }
  }

  const avgLPer100km =
    points.length > 0
      ? points.reduce((sum, p) => sum + p.lPer100km * p.distanceKm, 0) /
        points.reduce((sum, p) => sum + p.distanceKm, 0)
      : null;

  const avgKmPerLiter = avgLPer100km !== null && avgLPer100km > 0 ? 100 / avgLPer100km : null;

  return { points, avgLPer100km, avgKmPerLiter, totalLiters, totalCents, count: logs.length };
}

/** Format "3,4 L/100km" (komma als decimaalteken, 1 decimaal). */
export function formatLPer100km(lPer100km: number): string {
  return `${lPer100km.toFixed(1).replace('.', ',')} L/100km`;
}

/** Format km per liter als "1 op 25,0" (1 decimaal, Nederlandse komma). */
export function formatKmPerLiter(kmPerLiter: number): string {
  return `1 op ${kmPerLiter.toFixed(1).replace('.', ',')}`;
}

/** L/100km ↔ km per liter: 2,5 L/100km = 40 km per liter. */
export function lPer100kmToKmPerLiter(lPer100km: number): number {
  return lPer100km > 0 ? 100 / lPer100km : 0;
}

/** Format kosten in centen als "€12,50" of "€1.234,56". */
export function formatCents(cents: number): string {
  return `€${(cents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
