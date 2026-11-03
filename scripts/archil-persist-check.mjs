/**
 * archil-persist-check.mjs — bewijst dat de Archil-disk bestanden bewaart
 * tussen twee losse execs (twee verse containers).
 *
 * Stap 1: schrijf een unieke regel in een nieuwe job-submap (exec #1).
 * Stap 2: lees dat bestand terug in een aparte exec (#2).
 * De check faalt (exit 1) als de teruggelezen inhoud de geschreven regel niet bevat.
 *
 * Gebruik: npm run archil:check   (leest .env)
 * Zonder ARCHIL_DISK_ID maakt de check één disk aan en zet de id in .env.
 * De mount-token van een nieuwe disk wordt nooit geprint.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import * as storage from './archil-storage.mjs';

const ENV_FILE = '.env';
const DISK_NAME = `fix50-data-${Date.now().toString(36)}`;

if (!process.env.ARCHIL_API_KEY?.trim()) {
  console.error(
    'ARCHIL_API_KEY ontbreekt. Zet de API key (begint met key-, van https://console.archil.com/api-keys) in .env en run opnieuw: npm run archil:check',
  );
  process.exit(1);
}

/** Zet ARCHIL_DISK_ID in .env zodat volgende runs dezelfde disk gebruiken. */
function saveDiskId(id) {
  let env = '';
  try {
    env = fs.readFileSync(ENV_FILE, 'utf8');
  } catch {
    env = '';
  }
  const line = `ARCHIL_DISK_ID=${id}`;
  env = /^ARCHIL_DISK_ID=.*$/m.test(env)
    ? env.replace(/^ARCHIL_DISK_ID=.*$/m, line)
    : `${env}${env === '' || env.endsWith('\n') ? '' : '\n'}${line}\n`;
  fs.writeFileSync(ENV_FILE, env);
  process.env.ARCHIL_DISK_ID = id;
  console.log(`  ${line} opgeslagen in ${ENV_FILE}`);
}

const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const jobDir = `jobs/${runId}`;
const filePath = `${jobDir}/persist.txt`;
const line = `FIX50 Archil-persistentiecheck ${new Date().toISOString()} run=${runId}`;

try {
  let disk;
  let created = false;
  if (process.env.ARCHIL_DISK_ID?.trim()) {
    disk = await storage.getDisk();
  } else {
    console.log(`Geen ARCHIL_DISK_ID — disk "${DISK_NAME}" aanmaken…`);
    disk = await storage.findOrCreateDisk(DISK_NAME);
    created = true;
    saveDiskId(disk.id);
  }

  console.log(`Disk: ${disk.name} (${disk.id})  regio: ${disk.region || storage.region()}`);

  console.log(`\n— Exec #1: schrijven naar ${filePath} —`);
  await storage.writeFile(disk, filePath, `${line}\n`);
  console.log('  geschreven');

  console.log('\n— Exec #2: teruglezen (nieuwe container) —');
  const readBack = await storage.readFile(disk, filePath);
  console.log(`  inhoud: ${readBack.trim()}`);

  if (!readBack.includes(line)) {
    console.error('\nFAAL: de teruggelezen inhoud bevat de geschreven regel niet.');
    process.exit(1);
  }

  console.log(`\nOK: bestand overleefde de tweede exec. Disk ${disk.id}${created ? ' (nieuw aangemaakt)' : ''}.`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nFAAL: ${message}`);
  if (/\b401\b|unauthori[sz]ed/i.test(message)) {
    console.error(
      'De key is waarschijnlijk een disk/mount token (adt_…) of hoort bij een andere regio. Gebruik een API key (key-…) uit dezelfde regio als de disk.',
    );
  }
  process.exit(1);
}
