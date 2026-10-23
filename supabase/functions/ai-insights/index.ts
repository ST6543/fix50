/**
 * ai-insights — fase B van het AI-plan (docs/AI-SLIMMER-PLAN.md).
 *
 * Flow: auth → kill-switch → rate limit → cache-check (48 u) → scooter-context →
 * diagnose-zoek (bestaande RPC) → AI verwoordt de fase-A-signalen →
 * Zod-validatie → opslag met dedupe-op-signaalsleutel → antwoord.
 *
 * Zonder AI_API_KEY of bij een fout geeft deze functie een deterministische
 * DB-gebaseerde afgeleide van de signalen terug (source: 'fallback') — de app
 * faalt dus nooit in donker, maar verzint ook nooit cijfers.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { errorJson, json, preflight } from '../_shared/cors.ts';
import {
  insightsRequestSchema,
  insightsResponseSchema,
  type InsightsResponse,
} from '../_shared/schemas.ts';
import { callAi } from '../_shared/ai.ts';
import {
  formatDiagnosisForPrompt,
  getScooterContext,
  searchWithFallback,
  type SearchedDiagnosis,
} from '../_shared/context.ts';

const CACHE_HOURS = 48;
const DAILY_INSIGHT_LIMIT = Number(Deno.env.get('AI_DAILY_USER_LIMIT') ?? '60');

/** Deterministische sleutel voor de cache/dedupe: alleen de stabiele inhoud. */
async function signalKeyOf(payment: { signals: { kind: string; title: string; detail: string; evidence: string }[] }): Promise<string> {
  const normalized = payment.signals
    .map((s) => `${s.kind}|${s.title}|${s.detail}|${s.evidence ?? ''}`)
    .join('::');
  // SHA-256 hex — SubtleCrypto is in Edge Functions standaard beschikbaar.
  const bytes = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function buildSystemPrompt(scooterName: string | null): string {
  return [
    'Je bent de onderhouds-assistent van FIX50, een app voor brommer- en scooterrijders in Nederland.',
    'Krijgt een lijst met berekende signalen (cijfers + onderbouwing) over één scooter en verwoord deze kort, concreet en persoonlijk in het Nederlands.',
    'Regels:',
    '- Gebruik ALLÉén de cijfers in de signalen. Verzin geen percentages, km-standen of tijden die er niet staan.',
    '- Geen technische stelligheid: schrijf "vaak voorkomende oorzaak — controleer X", nooit "het defect is X".',
    '- Maximaal 2 zinnen per signaal; spreek de gebruiker aan met "je".',
    '- Gebruik combinatie-advies als twee signalen bij elkaar horen (bijv. verbruik + V-snaar-interval).',
    '- Titel: max 8 woorden, concreet. Detail: max 220 tekens.',
  ].join('\n') + (scooterName ? `\nScooter: ${scooterName}.` : '\nScooter: onbekend.');
}

function buildUserTurn(
  signals: { index: number; kind: string; severity: string; title: string; detail: string; evidence: string }[],
  scooterContext: { engine_type: string | null; current_km: number } | null,
  diagnosisBlock: string,
): string {
  const lines: string[] = signals.map(
    (s) =>
      `Signaal ${s.index} [${s.kind} · ${s.severity}] ${s.title}\n  Feit: ${s.detail}\n  Onderbouwing: ${s.evidence}`,
  );
  const ctx = scooterContext
    ? `Scootergegevens: bloktype ${scooterContext.engine_type ?? 'onbekend'}, kilometerstand ${scooterContext.current_km} km.`
    : 'Scootergegevens: geen.';
  return `${ctx}\n\nFIX50-diagnosedatabase (bron van waarheid):\n${diagnosisBlock}\n\nVerwoord per signaal een titel en detail. Antwoord in dit exacte JSON-formaat:\n{"verwoording": [{"index": <getal>, "title": "...", "detail": "..."}]}`;
}

/** Deterministische fallback-zonder-AI: dezelfde signalen, aangevuld met top-oorzaken uit de database. */
function buildFallback(
  signals: { index: number; kind: string; severity: string; title: string; detail: string; evidence: string }[],
  rows: SearchedDiagnosis[],
) {
  const topCause = (rowIdx: number): string => {
    const r = rows[rowIdx];
    if (!r || !r.causes) return '';
    return ` Veel voorkomende oorzaak: ${r.causes.split(/[.;]/)[0]!.trim().toLowerCase()}.`;
  };
  return signals.map((s, i) => ({
    index: s.index,
    title: s.title,
    detail: `${s.detail}${topCause(i)}`.slice(0, 600),
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return errorJson('Alleen POST toegestaan', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return errorJson('Niet ingelogd', 401, 'unauthenticated');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1) Authenticatie
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return errorJson('Ongeldige sessie', 401, 'unauthenticated');
  const userId = userData.user.id;

  // 2) Input-validatie
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return errorJson('Ongeldige JSON', 400, 'bad_json');
  }
  const parsed = insightsRequestSchema.safeParse(payload);
  if (!parsed.success) return errorJson('Ongeldig verzoek', 400, 'bad_request');
  const { scooter_id, signals } = parsed.data;
  const indexed = signals.map((s, index) => ({ ...s, index }));

  // 3) Kill switch: "AI meekijken" uit → geen kosten, geen calls.
  const { data: settings } = await admin
    .from('user_settings')
    .select('ai_watch_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (settings && (settings as { ai_watch_enabled: boolean }).ai_watch_enabled === false) {
    return json({ disabled: true, insights: [], fallback: false });
  }

  const signal_key = await signalKeyOf({ signals });

  // 4) Cache-check: dezelfde signalenset binnen 48 u → direct terug, geen AI-call.
  const cacheSince = new Date(Date.now() - CACHE_HOURS * 3_600_000).toISOString();
  const { data: cachedRows } = await admin
    .from('ai_insights')
    .select('title, detail, diagnosis_ids, source')
    .eq('user_id', userId)
    .eq('scooter_id', scooter_id ?? null)
    .eq('signal_key', signal_key)
    .gte('created_at', cacheSince)
    .order('created_at', { ascending: false })
    .limit(1);
  const cached = (cachedRows ?? [])[0] as
    | { title: string; detail: string; diagnosis_ids: string[]; source: string }
    | undefined;
  if (cached) {
    return json({
      insights: indexed.map((s) => ({
        index: s.index,
        title: cached.title,
        detail: cached.detail,
        source: cached.source,
        diagnosis_ids: cached.diagnosis_ids ?? [],
      })),
      fallback: cached.source !== 'ai',
      cached: true,
    });
  }

  // 5) Rate limit: telling van verse AI-rijen vandaag.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count: todaysCount } = await admin
    .from('ai_insights')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'ai')
    .gte('created_at', startOfDay.toISOString());
  const callCount = Number(todaysCount ?? 0);
  if (callCount >= DAILY_INSIGHT_LIMIT) {
    return errorJson('Dagelijkse AI-limit bereikt. De signalen blijven gewoon zichtbaar in de app.', 429, 'rate_limited');
  }

  // 6) Scooter-context (eigendomscheck zit in de query)
  let scooterContext = null;
  if (scooter_id) {
    scooterContext = await getScooterContext(admin as never, userId, scooter_id);
    if (!scooterContext) return errorJson('Scooter niet gevonden', 403, 'forbidden');
  }

  // 7) Diagnose-database: de bron van waarheid blijft de kennislaag.
  const searchQuery = indexed
    .map((s) => `${s.title} ${s.evidence}`)
    .join(' ');
  const diagnosisRows = await searchWithFallback(admin as never, searchQuery, scooterContext?.engine_type ?? null);
  const diagnosisBlock = formatDiagnosisForPrompt(diagnosisRows);

  // 8) AI verwoording + strikte output-validatie
  let verwoording: InsightsResponse['verwoording'] | null = null;
  let usedFallback = false;

  const turns = [
    { role: 'system' as const, content: buildSystemPrompt(scooterContext ? (scooterContext as { name?: string }).name ?? null : null) },
    { role: 'user' as const, content: buildUserTurn(indexed, scooterContext, diagnosisBlock) },
  ];
  const ai = await callAi(turns);
  if (ai.ok && ai.content) {
    try {
      const jsonText = ai.content.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
      const validated = insightsResponseSchema.safeParse(JSON.parse(jsonText));
      if (validated.success) {
        // Alleen indexen die ook écht bestaan mogen doorgaan.
        const validIdx = new Set(indexed.map((s) => s.index));
        verwoording = validated.data.verwoording.filter((v) => validIdx.has(v.index));
        if (verwoording.length === 0) verwoording = null;
      } else {
        console.error('AI-inzichten output faalde schema:', validated.error.issues[0]?.message);
      }
    } catch {
      console.error('AI-inzichten output was geen geldige JSON');
    }
  }
  if (!verwoording) {
    usedFallback = true;
    verwoording = buildFallback(indexed, diagnosisRows);
  }

  // 9) Opslag (dedupe: bestaande rij met dezelfde sleutel wordt bijgewerkt)
  const { data: existing } = await admin
    .from('ai_insights')
    .select('id')
    .eq('user_id', userId)
    .eq('scooter_id', scooter_id ?? null)
    .eq('signal_key', signal_key)
    .order('created_at', { ascending: false })
    .limit(1);
  const combinedTitle = verwoording.map((v) => v.title).join(' · ').slice(0, 120);
  const combinedDetail = verwoording.map((v) => v.detail).join(' | ').slice(0, 600);
  const row = {
    user_id: userId,
    scooter_id: scooter_id ?? null,
    signal_key: signal_key,
    kind: indexed[0]!.kind,
    severity: indexed[0]!.severity,
    title: combinedTitle,
    detail: combinedDetail,
    diagnosis_ids: diagnosisRows.slice(0, 8).map((r) => r.id),
    source: usedFallback ? 'fallback' : 'ai',
  };
  if (existing && existing[0]) {
    await admin.from('ai_insights').update({ ...row, created_at: new Date().toISOString() }).eq('id', (existing[0] as { id: string }).id);
  } else {
    await admin.from('ai_insights').insert(row);
  }

  return json({
    insights: verwoording.map((v) => ({
      index: v.index,
      title: v.title,
      detail: v.detail,
      source: usedFallback ? 'fallback' : 'ai',
      diagnosis_ids: diagnosisRows.slice(0, 5).map((r) => r.id),
    })),
    fallback: usedFallback,
    cached: false,
  });
});
