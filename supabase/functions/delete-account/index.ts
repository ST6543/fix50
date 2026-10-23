/**
 * delete-account — verwijdert het account van de ingelogde gebruiker.
 * Vereist voor App Store guideline 5.1.1(v) (in-app accountdeletion) en AVG.
 *
 * Flow: auth (eigen JWT) → eigen storage-foto's wissen → auth-user verwijderen.
 * Alle tabellen cascaden via FK's `on delete cascade` op user_id/scooter_id,
 * dus één admin.deleteUser() ruimt profiel, scooters, onderhoud, tuning,
 * metingen, chat en instellingen op.
 *
 * Response: { ok: true }  (daarna logt de app uit en vernietigt de lokale sessie)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Inline CORS (zelfde als _shared/cors.ts — de deployer bundelt per functie).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function errorJson(message: string, status = 400, code?: string): Response {
  return json({ error: message, code: code ?? null }, status);
}
function preflight(): Response {
  return new Response('ok', { headers: corsHeaders });
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

  // 2) Eigen foto's uit de scooter-photos-bucket wissen (FK-cascade geldt niet voor storage).
  const prefix = userId;
  const { data: files } = await admin.storage.from('scooter-photos').list(prefix);
  const names = (files ?? []).map((f) => f.name).filter((n) => typeof n === 'string' && n.length > 0);
  const ids = names.map((n) => `${prefix}/${n}`);
  if (ids.length > 0) {
    const { error: rmErr } = await admin.storage.from('scooter-photos').remove(ids);
    if (rmErr) console.error('delete-account: foto-opruimen faalde:', rmErr.message);
  }

  // 3) Account + alle data verwijderen (cascade via FK's)
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return errorJson('Kon het account niet verwijderen. Probeer het opnieuw.', 500, 'db_error');

  return json({ ok: true });
});
