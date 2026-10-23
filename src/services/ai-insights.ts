/**
 * AI-inzichten-service (fase B van het AI-plan).
 *
 * Roept de Edge Function `ai-insights` aan die de deterministische fase-A-signalen
 * verwoordt met de diagnose-database als bron van waarheid. Misoorzaken (offline,
 * rate limit, fout) blijven stíl: de signaalkaart op Home toont dan gewoon de
 * vaste deterministische teksten — nooit een leeg scherm, nooit ingezonden ruis.
 */
import { AppError } from './api';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { UUID } from '@/types';
import type { Insight } from '@/lib/insights';

/** Verwoording zoals de Edge Function die teruggaf (index verwijst naar het signaal). */
export interface AiText {
  index: number;
  title: string;
  detail: string;
  source: 'ai' | 'fallback';
  diagnosis_ids: string[];
}

/** Stille fetch: null betekent "geen AI-verruiming beschikbaar" (geen throw). */
export async function fetchAiVerwoording(
  scooterId: UUID | null,
  insights: Insight[],
): Promise<AiText[] | null> {
  if (insights.length === 0) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  // Uitgelogd: tijdelijk geen AI-verwoording (de signalen blijven zichtbaar).
  if (!token) return null;

  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/ai-insights`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scooter_id: scooterId,
        signals: insights.map((ins) => ({
          kind: ins.kind,
          severity: ins.severity,
          title: ins.title,
          detail: ins.detail,
          evidence: ins.evidence,
        })),
      }),
    });
  } catch {
    // Offline / netwerkfout: val gerust terug op de vaste teksten.
    return null;
  }

  if (!res.ok) {
    // Rate limit of backend-fout: bewust stille fallback.
    return null;
  }

  try {
    const body = (await res.json()) as { insights?: AiText[]; fallback?: boolean };
    if (!Array.isArray(body.insights)) return null;
    // Alleen valide items doorlaten (numerieke index, minimaal gevulde tekst).
    return body.insights.filter(
      (r) =>
        typeof r?.index === 'number' &&
        Number.isInteger(r.index) &&
        r.index >= 0 &&
        typeof r?.title === 'string' &&
        typeof r?.detail === 'string',
    );
  } catch {
    return null;
  }
}

/** Alarm-bouwer (niet gebruikt bij deze stille service, maar houdt de API consistent). */
export function aiInsightsUnavailable(e: unknown): string {
  return e instanceof AppError ? e.message : 'AI-inzichten zijn tijdelijk niet beschikbaar.';
}
