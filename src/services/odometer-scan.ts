/**
 * Teller-scan (fase D van docs/AI-SLIMMER-PLAN.md): foto van de kilometerstand
 * → voorstel voor het tankbeurtformulier. De AI draait server-side in de
 * `scan-odometer` Edge Function (auth via eigen JWT — geen keys in de app).
 * Er wordt niets weggeschreven; de read-out is een prefill-suggestie.
 */
import { AppError } from './api';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';

export type ScanConfidence = 'hoog' | 'gemiddeld' | 'laag';

export interface OdometerScanResult {
  found: boolean;
  km: number | null;
  confidence: ScanConfidence;
  raw_text: string | null;
  warning?: string;
}

/**
 * Plausibiliteitscheck (client-zijde): een afgelezen stand die ver onder de
 * laatst bekende km ligt is waarschijnlijk een oudere foto of een andere
 * brommer. Tolereert 100 km opschuiving (foto net vóór het logboek).
 */
export function isPlausibleOdometerScan(km: number, currentKm: number | null): boolean {
  if (currentKm === null) return true;
  return km >= currentKm - 100;
}

export async function scanOdometer(args: {
  base64: string;
  mime: string;
  scooterId: string | null;
  currentKm: number | null;
}): Promise<OdometerScanResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new AppError('Je bent uitgelogd. Log opnieuw in.');

  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/scan-odometer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_base64: args.base64,
        mime: args.mime,
        scooter_id: args.scooterId,
        current_km: args.currentKm,
      }),
    });
  } catch {
    throw new AppError(
      'Er is geen internetverbinding. Teller scannen werkt online; probeer het later opnieuw.',
    );
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AppError(body?.error ?? 'Teller scannen is tijdelijk niet beschikbaar.');
  }
  return (await res.json()) as OdometerScanResult;
}
