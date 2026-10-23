import fs from 'node:fs';
const LOG = '.expo/dev/logs/start.log';
const ENV = '.env';
const log = fs.readFileSync(LOG, 'utf8');
const key = ([...new Set(log.match(/sk-[A-Za-z0-9_-]{20,}/g) ?? [])])[0];
if (!key) {
  console.error('Geen key in log.');
  process.exit(1);
}
let env = fs.readFileSync(ENV, 'utf8');
env = env.replace(/^AI_API_KEY=.*$/m, `AI_API_KEY=${key}`);
fs.writeFileSync(ENV, env);
console.log('.env: AI_API_KEY gevuld (zie je niet, niet geprint).');
fs.writeFileSync(LOG, log.replace(/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED]'));
console.log('Log geschrubd.');
