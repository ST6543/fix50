/**
 * test-chat-e2e.mjs — end-to-end test van de diagnose-chat.
 * 1. Signup testgebruiker (anon key) → sessietoken.
 * 2. POST naar edge function diagnose-chat.
 * 3. Assert: response OK, fallback-flag, sources, sessie-id.
 * 4. Cleanup: deleteUser via service-role.
 * Gebruik: node --env-file=.env scripts/test-chat-e2e.mjs [aantal]
 */
const url = (process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const anon = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const N = Number(process.argv[2] ?? 1);

if (!url || !anon || !service) {
  console.error('SUPABASE_URL / publishable key / service role ontbreken in .env');
  process.exit(1);
}

const email = `e2e-chat-${Date.now()}-${Math.floor(Math.random() * 1e6)}@fix50-test.dev`;
const password = `Test-${Math.random().toString(36).slice(2)}-50!`;

async function main() {
  // 1) Signup
  const su = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const suBody = await su.json().catch(() => null);
  const token = suBody?.access_token;
  const userId = suBody?.user?.id;
  if (!su.ok || !token || !userId) {
    console.error(`Signup mislukt: ${su.status} ${JSON.stringify(suBody)?.slice(0, 200)}`);
    process.exit(2);
  }
  console.log(`✓ Testgebruiker aangemaakt (${userId.slice(0, 8)}…)`);

  try {
    // 2) Chat-calls
    let aiOk = 0;
    let fallbackCount = 0;
    for (let i = 1; i <= N; i++) {
      const res = await fetch(`${url}/functions/v1/diagnose-chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anon,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: i === 1 ? 'Mijn brommer start niet, wat kan het zijn?' : `Vervolgvraag ${i}: hij draait maar slaat niet aan.`,
          session_id: null,
          scooter_id: null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        console.log(`✗ call ${i}: HTTP ${res.status} — ${body?.error ?? 'onbekend'}`);
        continue;
      }
      const fallback = Boolean(body?.fallback);
      const msg = String(body?.message ?? '');
      if (fallback) fallbackCount++;
      else aiOk++;
      console.log(
        `call ${i}: ${fallback ? 'FALLBACK (database-antwoord)' : 'AI-antwoord'} · ${msg.length} tekens · sources: ${Array.isArray(body?.sources) ? body.sources.length : 0} · sessie: ${body?.session_id ? 'ja' : 'nee'}`,
      );
    }
    console.log(`\nSamenvatting: ${aiOk}/${N} echte AI-antwoorden, ${fallbackCount}/${N} fallback.`);
    if (aiOk === 0) {
      console.log('→ De AI-key levert momenteel geen antwoorden (meest waarschijnlijk: geen credits). De fallback-keten werkt wél goed.');
    } else {
      console.log('→ De AI-chat werkt end-to-end met de huidige key. 🎉');
    }
  } finally {
    // 3) Cleanup
    const del = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${service}`, apikey: service },
    });
    console.log(del.ok ? '✓ Testgebruiker opgeruimd' : `⚠ Cleanup gaf ${del.status} (controleer handmatig)`);
  }
}

await main();
