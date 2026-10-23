/**
 * set-ai-key.mjs — stel je OpenAI AI_API_KEY veilig in (één keer nodig).
 * 1. Vraagt de key (verborgen, komt niet in logs).
 * 2. Test de key tegen de provider (models + chat met JSON-mode).
 * 3. Zet de key in .env én in Supabase secrets (de edge function leest dáár).
 * 4. Draait optioneel direct de e2e-chattest.
 *
 * Gebruik in je eigen terminal:
 *   node scripts/set-ai-key.mjs
 */
import fs from 'node:fs';
import readline from 'node:readline';
import { execSync } from 'node:child_process';

const ENV = '.env';

// Verborgen input (echo uit tijdens het typen)
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdoutWrite = process.stdout.write.bind(process.stdout);
    let muted = false;
    process.stdout.write = (...args) => {
      if (muted) return true;
      return stdoutWrite(...args);
    };
    rl.question(question, (answer) => {
      muted = false;
      process.stdout.write = stdoutWrite;
      stdoutWrite('\n');
      rl.close();
      resolve(answer.trim());
    });
    muted = true;
  });
}

async function classifyKey(key) {
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  try {
    const m = await fetch('https://api.openai.com/v1/models', { headers });
    if (m.status === 401) return { ok: false, reason: 'INVALID', detail: 'Key is ongeldig (401). Maak een nieuwe op platform.openai.com/api-keys.' };
    const c = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    });
    if (c.ok) return { ok: true, reason: 'OK', detail: 'Key werkt — chat-calls slagen.' };
    const b = await c.json().catch(() => null);
    const code = b?.error?.code ?? b?.error?.type ?? '';
    if (c.status === 429 && /quota|credit|billing/i.test(code + String(b?.error?.message ?? ''))) {
      return { ok: false, reason: 'NO_CREDITS', detail: 'Key is geldig maar de account heeft geen credits. Laad op: platform.openai.com/settings/organization/billing.' };
    }
    return { ok: false, reason: 'OTHER', detail: `HTTP ${c.status} (${code})` };
  } catch {
    return { ok: false, reason: 'NETWORK', detail: 'Kon de provider niet bereiken — check je internet.' };
  }
}

const key = await askHidden('Plak je OpenAI key (verborgen): ');
if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) {
  console.error('✗ Dit ziet er niet als een OpenAI-key uit (verwacht: sk-…). Niets gewijzigd.');
  process.exit(1);
}

console.log('Key testen…');
const verdict = await classifyKey(key);
console.log(`→ ${verdict.reason}: ${verdict.detail}`);
if (verdict.reason === 'INVALID' || verdict.reason === 'NETWORK') process.exit(2);
if (verdict.reason === 'NO_CREDITS') {
  console.log('Let op: ik zet de key alvast goed, zodat het werkt zodra je credits hebt opgeladen.');
}

// 1) .env bijwerken
let env = fs.readFileSync(ENV, 'utf8');
if (/^AI_API_KEY=.*$/m.test(env)) env = env.replace(/^AI_API_KEY=.*$/m, `AI_API_KEY=${key}`);
else env += (env.endsWith('\n') ? '' : '\n') + `AI_API_KEY=${key}\n`;
fs.writeFileSync(ENV, env);
console.log('✓ .env bijgewerkt.');

// 2) Supabase secrets (dit is wat de chat écht gebruikt)
try {
  execSync(`supabase secrets set AI_API_KEY=${key}`, { stdio: 'inherit' });
  console.log('✓ Supabase secrets bijgewerkt (AI_API_KEY).');
} catch {
  console.log('⚠ Kon `supabase secrets set` niet automatisch uitvoeren. Draai zelf:');
  console.log(`  supabase secrets set AI_API_KEY=<jouw key>`);
}

console.log('\nKlaar. Test nu de chat end-to-end met:');
console.log('  node --env-file=.env scripts/test-chat-e2e.mjs 10');
