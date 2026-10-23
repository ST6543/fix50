/**
 * test-ai.mjs — test AI_API_KEY uit .env rechtstreeks tegen de provider.
 * Fase 1: één volledige call (incl. JSON-mode zoals de edge function).
 * Fase 2: 100 mini-calls in batches van 10 → success-rate en statuscodes.
 * De key wordt NIET gelogd.
 * Gebruik: node --env-file=.env scripts/test-ai.mjs
 */
const base = (process.env.AI_API_BASE ?? 'https://api.openai.com/v1').replace(/\/$/, '');
const key = process.env.AI_API_KEY ?? '';
const model = process.env.AI_MODEL ?? 'gpt-4o-mini';

if (!key) {
  console.error('AI_API_KEY ontbreekt in .env');
  process.exit(1);
}
console.log(`Provider: ${base}  model: ${model}  key: ${key.slice(0, 7)}...(${key.length} tekens)`);

async function oneCall(i, prompt, useJsonMode) {
  const body = {
    model,
    messages: [
      { role: 'system', content: 'Antwoord altijd in strikte JSON: {"message": string, "action": null}' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 60,
  };
  if (useJsonMode) body.response_format = { type: 'json_object' };
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const detail = text.slice(0, 160).replace(/\s+/g, ' ');
      return { i, ok: false, status: res.status, ms, detail };
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    let jsonOk = null;
    try {
      JSON.parse(content);
      jsonOk = true;
    } catch {
      jsonOk = false;
    }
    return { i, ok: true, status: 200, ms, jsonOk, content: String(content).slice(0, 80) };
  } catch (err) {
    return { i, ok: false, status: 0, ms: Date.now() - t0, detail: err instanceof Error ? err.message : 'netwerkfout' };
  }
}

// Fase 1: één volledige call mét JSON-mode
console.log('\n— Fase 1: volledige call (JSON-mode) —');
const probe = await oneCall(0, 'Draai een simpele diagnose-check: motor start niet.', true);
console.log(
  probe.ok
    ? `OK  ${probe.ms}ms  json=${probe.jsonOk}  antwoord: ${probe.content}`
    : `FAAL: status=${probe.status}  ${probe.ms}ms  ${probe.detail ?? ''}`,
);

// Fase 2: 100 mini-calls
console.log('\n— Fase 2: 100 calls —');
const N = 100;
const results = [];
for (let start = 1; start <= N; start += 10) {
  const batch = [];
  for (let i = start; i < start + 10; i++) {
    batch.push(oneCall(i, `Test ${i}: antwoord kort in JSON.`, true));
  }
  results.push(...(await Promise.all(batch)));
  process.stdout.write(`  ${Math.min(start + 9, N)}/${N}\n`);
}
const okCount = results.filter((r) => r.ok).length;
const statuses = {};
for (const r of results) {
  const k = r.ok ? '200' : String(r.status);
  statuses[k] = (statuses[k] ?? 0) + 1;
}
const lat = results.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
const badJson = results.filter((r) => r.ok && r.jsonOk === false).length;
console.log(`\nResultaat: ${okCount}/${N} geslaagd (${((okCount / N) * 100).toFixed(0)}%)`);
console.log(`Statusverdeling: ${JSON.stringify(statuses)}`);
if (lat.length) {
  console.log(`Latency p50=${lat[Math.floor(lat.length / 2)]}ms  p95=${lat[Math.floor(lat.length * 0.95)]}ms  max=${lat[lat.length - 1]}ms`);
}
console.log(`JSON-parse fouten bij geslaagde calls: ${badJson}`);
