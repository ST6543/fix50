/**
 * Factuur-scan: foto van een factuur/werkplaatsbon → gestructureerd
 * onderhoudsvoorstel. De AI draait server-side in de `scan-invoice`
 * Edge Function (auth via eigen JWT — geen keys in de app).
 */
import { AppError } from './api';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';

export interface InvoiceSuggestion {
  item_name: string | null;
  custom_name: string | null;
  km_at_service: number | null;
  service_date: string | null;
  cost_cents: number | null;
  parts: string | null;
  notes: string | null;
  workshop_name: string | null;
}

export interface InvoiceScanResult {
  found: boolean;
  confidence: 'hoog' | 'gemiddeld' | 'laag';
  suggestion: InvoiceSuggestion | null;
  missing_fields: string[];
  raw_text: string | null;
  warning?: string;
}

export async function scanInvoice(args: {
  base64: string;
  mime: string;
  scooterId: string | null;
}): Promise<InvoiceScanResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new AppError('Je bent uitgelogd. Log opnieuw in.');

  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/scan-invoice`, {
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
    throw new AppError(
      'Er is geen internetverbinding. Factuur scannen werkt online; probeer het later opnieuw.',
    );
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AppError(body?.error ?? 'Factuur scannen is tijdelijk niet beschikbaar.');
  }
  return (await res.json()) as InvoiceScanResult;
}
