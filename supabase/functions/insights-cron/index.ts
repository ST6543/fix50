/**
 * insights-cron — nachtelijke cron-taak (afronding fase C van docs/AI-SLIMMER-PLAN.md).
 *
 * Herrekent de kernsignalen (verbruikstrend, prestatie-daling, meet-trend)
 * server-side voor alle actieve scooters en stuurt, bij verslechtering,
 * in-app notificaties + Expo push — ook als de app nergens open staat.
 *
 * Guardrails (het plan, afdekt doorGuardrails):
 * - alleen 'let op'-nivo-signalen worden gemeld (geen info-ruis);
 * - dag-1op-1 key-format met de client (`sig:<kind>:<title>:<week>`) + de
 *   unieke dedupe-index in de DB: maximaal één melding per week per signaal;
 * - kill switch `ai_watch_enabled`: uit → helemaal geen nachtbericht;
 * - gebruikersinstelling: verbruik/performance volgen `push_enabled`;
 * - CRON_SECRET-beveiliging, zelfde patroon als maintenance-reminders.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { errorJson, json, preflight } from '../_shared/cors.ts';
import {
  detectFuelTrendServer,
  detectPerformanceDropServer,
  detectRunTrendServer,
  isoWeekKeyServer,
  type RunPoint,
  type SignalRow,
} from '../_shared/signals.ts';

const MAX_SCOOTERS = 200;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();

  const cronSecret = Deno.env.get('CRON_SECRET');
  const auth = req.headers.get('Authorization') ?? '';
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return errorJson('Unauthorized', 401, 'unauthorized');
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const weekKey = isoWeekKeyServer();

  // Actieve scooters: alleen signalen voor scooters met recente data (30 dagen).
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: scooters, error: scootersErr } = await admin
    .from('scooters')
    .select('id, user_id, name')
    .gte('updated_at', since)
    .limit(MAX_SCOOTERS);
  if (scootersErr) return errorJson('Databasefout', 500, 'db_error');

  let signalsFound = 0;
  let notificationsCreated = 0;
  const pushes: { user_id: string; title: string; body: string }[] = [];

  for (const sc of scooters ?? []) {
    // Kill switch + instellingen (1 query per user).
    const { data: settings } = await admin
      .from('user_settings')
      .select('ai_watch_enabled, push_enabled')
      .eq('user_id', sc.user_id)
      .maybeSingle();
    if ((settings as { ai_watch_enabled: boolean } | null)?.ai_watch_enabled === false) continue;
    if ((settings as { push_enabled: boolean } | null)?.push_enabled === false) continue;

    const [fuelRes, runRes] = await Promise.all([
      admin
        .from('fuel_logs')
        .select('odometer_km, liters, filled_at')
        .eq('scooter_id', sc.id)
        .order('filled_at', { ascending: true })
        .limit(30),
      admin
        .from('performance_runs')
        .select('setup_id, t0_50_s, started_at')
        .eq('scooter_id', sc.id)
        .not('t0_50_s', 'is', null)
        .order('started_at', { ascending: true })
        .limit(60),
    ]);

    const signals: SignalRow[] = [];
    const fuelRows = (fuelRes.data ?? []) as { odometer_km: number; liters: number; filled_at: string }[];
    const fuelSignal = fuelRows.length >= 3 ? detectFuelTrendServer(fuelRows) : null;
    if (fuelSignal) signals.push(fuelSignal);

    const runRows = (runRes.data ?? []) as unknown as RunPoint[];
    const dropSignal = runRows.length >= 2 ? detectPerformanceDropServer(runRows) : null;
    if (dropSignal) signals.push(dropSignal);
    const trendSignal = runRows.length >= 6 ? detectRunTrendServer(runRows) : null;
    if (trendSignal) signals.push(trendSignal);
    // Als de meet-trend én de losse meting-daling tegelijk opduiken, is de
    // trend (3+3 metingen) de sterkere variant: alleen die wordt gemeld, de
    // losse meting-daling (zelfde oorzaak) valt weg.
    const cleanSignals =
      trendSignal && dropSignal
        ? signals.filter((s) => s.title !== 'Trager dan je beste meting')
        : signals;
    signalsFound += cleanSignals.length;

    for (const sig of cleanSignals) {
      const dedupeKey = `sig:${sig.kind}:${sig.title}:${weekKey}`;
      const { error: insErr } = await admin.from('notifications').insert({
        user_id: sc.user_id,
        scooter_id: sc.id,
        type: sig.kind === 'verbruik' ? 'warning' : 'performance',
        title: sig.title,
        body: sig.detail,
        dedupe_key: dedupeKey,
      });
      if (insErr) continue; // bestond al deze week — idempotent, geen push
      notificationsCreated++;
      pushes.push({ user_id: sc.user_id, title: sig.title, body: sig.detail });
    }
  }

  // Expo push voor de nét aangemaakte meldingen (zelfde patroon als maintenance-reminders).
  if (pushes.length > 0) {
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', Array.from(new Set(pushes.map((p) => p.user_id))));
    if (tokens && tokens.length > 0) {
      const messages = pushes
        .map((p) => {
          const token = tokens.find((t: { user_id: string }) => t.user_id === p.user_id)?.token;
          return token ? { to: token, title: p.title, body: p.body, sound: 'default' } : null;
        })
        .filter((m): m is { to: string; title: string; body: string; sound: string } => m !== null);
      if (messages.length > 0) {
        const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) console.error('Expo push fout:', res.status);
      }
    }
  }

  return json({
    ok: true,
    scooters_checked: scooters?.length ?? 0,
    signals_found: signalsFound,
    notifications_created: notificationsCreated,
  });
});
