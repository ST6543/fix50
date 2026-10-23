/**
 * register-push-token — koppelt een Expo push-token aan de ingelogde gebruiker.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { errorJson, json, preflight } from '../_shared/cors.ts';
import { pushTokenRequestSchema } from '../_shared/schemas.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return errorJson('Alleen POST toegestaan', 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return errorJson('Niet ingelogd', 401, 'unauthenticated');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return errorJson('Ongeldige sessie', 401, 'unauthenticated');

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return errorJson('Ongeldige JSON', 400, 'bad_json');
  }
  const parsed = pushTokenRequestSchema.safeParse(payload);
  if (!parsed.success) return errorJson('Ongeldig token', 400, 'bad_request');

  const { error } = await admin.from('push_tokens').upsert(
    { user_id: userData.user.id, token: parsed.data.token, platform: parsed.data.platform },
    { onConflict: 'token' },
  );
  if (error) return errorJson('Kon token niet opslaan', 500, 'db_error');
  return json({ ok: true });
});
