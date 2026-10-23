/**
 * key-status.mjs — classificeert de huidige AI_API_KEY:
 * missing → invalid → no-credits → OK (met echte chat-call incl. JSON-mode).
 * Print nooit de key zelf.
 * Gebruik: node --env-file=.env scripts/key-status.mjs
 */
const key = process.env.AI_API_KEY ?? '';
if (!key) {
  console.log('STATUS: AI_API_KEY is NIET gezet in .env (of nog leeg).');
  process.exit(1);
}
console.log(`STATUS: AI_API_KEY gezet (${key.length} tekens, begint met ${key.slice(0, 7)}…)`);

const base = 'https://api.openai.com/v1';
const models = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
console.log(`/models → ${models.status}`);
if (models.status === 401) {
  console.log('STATUS: key is ONGELDIG (401). Vraag een nieuwe key aan.');
  process.exit(2);
}

const chat = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Antwoord in strikte JSON: {"message": string, "action": null}' },
      { role: 'user', content: 'Test: motor start niet. Kort.' },
    ],
    temperature: 0.3,
    max_tokens: 50,
    response_format: { type: 'json_object' },
  }),
});
console.log(`/chat → ${chat.status}`);
if (chat.ok) {
  const data = await chat.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  try {
    JSON.parse(content);
    console.log('STATUS: ALLES WERKT ✅ (chat + JSON-mode OK).');
    console.log(`  voorbeeldantwoord: ${String(content).slice(0, 90)}`);
  } catch {
    console.log('STATUS: chat OK maar JSON-mode gaf geen JSON — controleer model.');
  }
  process.exit(0);
}
const body = await chat.json().catch(() => null);
const code = body?.error?.code ?? body?.error?.type ?? '?';
console.log(`error.code: ${code}`);
console.log(`error.message: ${String(body?.error?.message ?? '').slice(0, 220)}`);
if (chat.status === 429 && /quota|credit|billing/i.test(String(body?.error?.message ?? '') + code)) {
  console.log('STATUS: key geldig maar GEEN CREDITS — laad op op platform.openai.com/settings/organization/billing.');
  process.exit(3);
}
console.log(`STATUS: onbekende fout (${chat.status}/${code}).`);
process.exit(4);
