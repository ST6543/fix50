/**
 * diagnose-chat — beveiligde Edge Function.
 * Flow: auth → rate limit → scooter-eigenaarscheck → database search →
 * AI (redeneerlaag) → output-validatie (Zod) → chat opslaan → antwoord.
 * Fallback zonder AI: toon direct de beste database-hits.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { errorJson, json, preflight } from '../_shared/cors.ts';
import { aiResponseSchema, chatRequestSchema, type AiResponse } from '../_shared/schemas.ts';
import { callAi } from '../_shared/ai.ts';
import { buildSystemPrompt, buildUserTurn } from '../_shared/prompt.ts';
import {
  formatDiagnosisForPrompt,
  getMaintenanceContext,
  getRecentMessages,
  getScooterContext,
  searchWithFallback,
  type SearchedDiagnosis,
} from '../_shared/context.ts';

const DAILY_USER_LIMIT = Number(Deno.env.get('AI_DAILY_USER_LIMIT') ?? '60');

async function checkRateLimit(admin: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', startOfDay.toISOString());
  // eenvoudige globale limiet per dag is te grof; hier: per-user limiet via eigen berichten
  void count;
  void error;
  // Per-user telling via chat_sessions join is duur; gebruik een ruwe RPC-loze benadering:
  // tel user-berichten in sessies van deze gebruiker.
  const { data: sessions } = await admin
    .from('chat_sessions')
    .select('id')
    .eq('user_id', userId);
  const ids = (sessions ?? []).map((s: { id: string }) => s.id);
  if (ids.length === 0) return true;
  const { count: userMsgs } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .in('chat_session_id', ids)
    .eq('role', 'user')
    .gte('created_at', startOfDay.toISOString());
  return (userMsgs ?? 0) < DAILY_USER_LIMIT;
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

  // 1) Authenticatie — verify the JWT with the auth server.
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
  const parsed = chatRequestSchema.safeParse(payload);
  if (!parsed.success) return errorJson('Ongeldig verzoek', 400, 'bad_request');
  const { message, session_id, scooter_id } = parsed.data;

  // 3) Rate limit (AI-kostenbeheersing)
  if (!(await checkRateLimit(admin, userId))) {
    return errorJson('Dagelijks berichtenlimiet bereikt. Probeer het morgen weer.', 429, 'rate_limited');
  }

  // 4) Scooter-eigenaarscheck + context
  let scooter = null;
  if (scooter_id) {
    scooter = await getScooterContext(admin as never, userId, scooter_id);
    if (!scooter) return errorJson('Scooter niet gevonden', 403, 'forbidden');
  }

  // 5) Sessie beheren (title afgeleid van eerste bericht)
  let sessionId = session_id ?? null;
  if (sessionId) {
    const { data: sess } = await admin
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!sess) sessionId = null;
  }
  if (!sessionId) {
    const title = message.length > 48 ? `${message.slice(0, 45)}…` : message;
    const { data: newSession, error: sessErr } = await admin
      .from('chat_sessions')
      .insert({ user_id: userId, scooter_id: scooter_id ?? null, title })
      .select('id')
      .single();
    if (sessErr || !newSession) return errorJson('Kon gesprek niet opslaan', 500, 'db_error');
    sessionId = (newSession as { id: string }).id;
  }

  // 6) Database eerst: relevante FIX50-records ophalen
  const engineType = scooter?.engine_type ?? null;
  const diagnosisRows = await searchWithFallback(admin as never, message, engineType);
  const maintenance = scooter
    ? await getMaintenanceContext(admin as never, scooter.id)
    : { recent: [], openReminders: [] };

  // Gebruikersbericht opslaan vóór de AI-call (ook bij timeout zit het gesprek vast in de geschiedenis).
  await admin.from('chat_messages').insert({ chat_session_id: sessionId, role: 'user', message });

  const diagnosisBlock = formatDiagnosisForPrompt(diagnosisRows);
  const recent = await getRecentMessages(admin as never, sessionId, 8);

  // 7) AI redeneerlaag
  let assistantMessage: string | null = null;
  let action: AiResponse['action'] = null;
  let usedFallback = false;

  const turns = [
    { role: 'system' as const, content: buildSystemPrompt({ scooter, diagnosisRows, maintenance }) },
    ...recent.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: buildUserTurn(message, diagnosisBlock) },
  ];

  const ai = await callAi(turns);
  if (ai.ok && ai.content) {
    try {
      const jsonText = ai.content.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
      const validated = aiResponseSchema.safeParse(JSON.parse(jsonText));
      if (validated.success) {
        assistantMessage = validated.data.message;
        action = validated.data.action ?? null;
      } else {
        console.error('AI-output faalde schema-validatie:', validated.error.issues[0]?.message);
      }
    } catch {
      console.error('AI-output was geen geldige JSON');
    }
  }

  // 8) Fallback: database-antwoord zonder AI — diagnose blijft deels bruikbaar.
  if (!assistantMessage) {
    usedFallback = true;
    assistantMessage = buildFallbackMessage(message, diagnosisRows);
  }

  // 9) Assistant-bericht met metadata opslaan
  await admin.from('chat_messages').insert({
    chat_session_id: sessionId,
    role: 'assistant',
    message: assistantMessage,
    metadata: {
      diagnosis_ids: diagnosisRows.slice(0, 8).map((r) => r.id),
      action_proposed: action ?? null,
      fallback: usedFallback,
    },
  });
  await admin
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  return json({
    session_id: sessionId,
    message: assistantMessage,
    action: action,
    fallback: usedFallback,
    sources: diagnosisRows.slice(0, 5).map((r: SearchedDiagnosis) => ({
      id: r.id,
      category: r.category,
      problem: r.problem,
      score: r.score,
    })),
  });
});

function buildFallbackMessage(message: string, rows: SearchedDiagnosis[]): string {
  if (rows.length === 0) {
    return 'Ik kan dit op basis van de beschikbare FIX50-gegevens nog niet betrouwbaar bepalen. ' +
      'Kun je iets meer vertellen, bijvoorbeeld of de motor start en of het probleem koud of warm optreedt?';
  }
  const top = rows.slice(0, 3);
  const lines: string[] = [
    'Ik kan de AI-assistent momenteel niet bereiken. Deze FIX50-diagnoses passen het meest bij je klacht:',
    '',
  ];
  for (const r of top) {
    lines.push(`• ${r.problem}${r.symptoms ? ` — ${r.symptoms}` : ''}`);
    if (r.causes) lines.push(`  Mogelijke oorzaak: ${r.causes}`);
    if (r.solution) lines.push(`  Oplossing: ${r.solution}`);
    lines.push('');
  }
  lines.push('Controleer eerst wat je zelf veilig kunt zien, en deel het resultaat hier voor een gerichtere diagnose.');
  return lines.join('\n');
}
