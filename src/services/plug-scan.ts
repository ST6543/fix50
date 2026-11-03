/**
 * Bougie-scan (plug chop via foto): foto van de uitgedraaide bougie →
 * kleuroordeel volgens de NGK-kennisbank + richting-advies voor sproeier/
 * hittegraad. De AI ("plug-photo" Edge Function) beschrijft alleen het
 * uiterlijk; het advies is een vaste mapping server-side (richtlijn, geen
 * zekerheid). Er wordt niets weggeschreven.
 */
import { AppError } from './api';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';

export type PlugCondition =
  | 'koffiebruin-gezond'
  | 'lichtgrijs-as'
  | 'te-rijk'
  | 'te-veel-olie'
  | 'te-arm-te-heet'
  | 'oververhitting';

export type ScanConfidence = 'hoog' | 'gemiddeld' | 'laag';

export interface PlugScanResult {
  found: boolean;
  confidence: ScanConfidence;
  condition: PlugCondition | null;
  condition_label: string | null;
  code_detected: string | null;
  heat_estimate: number | null;
  jet_direction: 'rijker' | 'rijker aftoppen; sproeier kleiner' | null;
  plug_grade_direction: 'kouder' | 'heter' | null;
  explanation: string | null;
  description: string | null;
  warning?: string;
}

export async function scanPlugPhoto(args: {
  base64: string;
  mime: string;
  scooterId: string | null;
}): Promise<PlugScanResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new AppError('Je bent uitgelogd. Log opnieuw in.');

  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/plug-photo`, {
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
      }),
    });
  } catch {
    throw new AppError('Er is geen internetverbinding. Bougie-foto werkt online; probeer het later opnieuw.');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AppError(body?.error ?? 'Bougie-foto is tijdelijk niet beschikbaar.');
  }
  return (await res.json()) as PlugScanResult;
}


