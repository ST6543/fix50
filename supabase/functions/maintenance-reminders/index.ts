/**
 * maintenance-reminders — dagelijkse cron-taak.
 * 1) Maakt reminders aan voor tijdsgebonden schedules die binnen reminder_days_ahead vervallen.
 * 2) Stuurt pushnotificaties (Expo push) voor nieuwe reminders.
 * 3) Ruimt oude genegeerde reminders op.
 * Beveiliging: Authorization header moet CRON_SECRET bevatten (supabase secrets set CRON_SECRET=...).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { errorJson, json, preflight } from '../_shared/cors.ts';

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

  // 1) Tijdsgebonden schedules zonder open reminder
  const { data: due, error } = await admin.rpc('due_time_schedules', { days_ahead: 3 });
  if (error) {
    console.error('due_time_schedules fout:', error.message);
    return errorJson('Databasefout', 500, 'db_error');
  }

  let created = 0;
  const notifications: Record<string, unknown>[] = [];

  for (const row of due ?? []) {
    const { data: schedule } = await admin
      .from('maintenance_schedules')
      .select('id, next_due_at, interval_months')
      .eq('id', row.schedule_id)
      .maybeSingle();
    if (!schedule) continue;

    const { error: insErr } = await admin.from('maintenance_reminders').insert({
      user_id: row.user_id,
      scooter_id: row.scooter_id,
      schedule_id: row.schedule_id,
      severity: 'reminder',
      title: row.item_name,
      body: `Toe aan beurt rond ${row.next_due_at}.`,
      due_at: row.next_due_at,
    });
    if (insErr) {
      // Meestal: bestond al (unique index) — prima, idempotent.
      continue;
    }
    created++;

    const { data: settings } = await admin
      .from('user_settings')
      .select('maintenance_notifications, push_enabled')
      .eq('user_id', row.user_id)
      .maybeSingle();
    if (!settings?.maintenance_notifications) continue;

    const dedupeKey = `maint:${row.schedule_id}:${row.next_due_at}`;
    const { error: notifErr } = await admin.from('notifications').insert({
      user_id: row.user_id,
      scooter_id: row.scooter_id,
      type: 'maintenance',
      title: `Onderhoud: ${row.item_name}`,
      body: `Deze taak is toe aan beurt rond ${row.next_due_at}.`,
      scheduled_for: row.next_due_at ? new Date(row.next_due_at).toISOString() : null,
      dedupe_key: dedupeKey,
    });
    if (!notifErr) notifications.push({ user_id: row.user_id, title: `Onderhoud: ${row.item_name}`, body: `Toe aan beurt rond ${row.next_due_at}.` });
  }

  // 2) Pushnotificaties versturen via Expo push API
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (notifications.length > 0) {
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', Array.from(new Set(notifications.map((n) => n.user_id as string))));
    if (tokens && tokens.length > 0) {
      const messages = [];
      for (const n of notifications) {
        const token = tokens.find((t: { user_id: string }) => t.user_id === n.user_id)?.token;
        if (!token) continue;
        messages.push({
          to: token,
          title: n.title,
          body: n.body,
          sound: 'default',
        });
      }
      if (messages.length > 0) {
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

  // 3) Cleanup
  await admin.rpc('cleanup_old_reminders');

  return json({ ok: true, reminders_created: created, notifications_created: notifications.length });
});
