/**
 * archil-storage.mjs — server-side opslag op een Archil-disk.
 *
 * De FIX50-app draait op het toestel (Expo/React Native); dit bestand hoort bij
 * de server-side scripts in scripts/ en regelt bestanden die een run moeten
 * overleven: onderhoudsdossiers, PDF-exports, scans. Archil bewaart ze op een
 * disk; elke exec start een verse container, maar de disk blijft staan.
 *
 * Configuratie via env:
 * - ARCHIL_API_KEY  verplicht, begint met `key-` (API key, geen disk/mount token)
 * - ARCHIL_REGION   standaard aws-us-east-1 (keys zijn regio-gebonden)
 * - ARCHIL_DISK_ID  de `dsk-…` van de disk
 *
 * De key blijft server-side: importeer dit bestand nooit vanuit src/ (app-code)
 * en zet hem nooit achter EXPO_PUBLIC_.
 *
 * Gebruik:
 *   import * as storage from './archil-storage.mjs';
 *   const disk = await storage.getDisk();
 *   const { stdout } = await storage.runCommand(disk, 'ls -la');
 */
import * as archil from 'disk';

export const DEFAULT_REGION = 'aws-us-east-1';

/** Regio uit ARCHIL_REGION, met aws-us-east-1 als standaard. */
export function region() {
  return process.env.ARCHIL_REGION?.trim() || DEFAULT_REGION;
}

/** De API key uit ARCHIL_API_KEY; faalt duidelijk als hij ontbreekt of verkeerd is. */
export function apiKey() {
  const key = process.env.ARCHIL_API_KEY?.trim() ?? '';
  if (!key) {
    throw new Error(
      'ARCHIL_API_KEY ontbreekt. Zet hem in .env (API key van https://console.archil.com/api-keys, begint met key-).',
    );
  }
  if (!key.startsWith('key-')) {
    throw new Error(
      'ARCHIL_API_KEY is geen API key: die begint met key-. Een disk/mount token (adt_…) geeft HTTP 401.',
    );
  }
  return key;
}

/** De disk-id uit ARCHIL_DISK_ID. */
export function diskId() {
  const id = process.env.ARCHIL_DISK_ID?.trim() ?? '';
  if (!id) {
    throw new Error('ARCHIL_DISK_ID ontbreekt. Zet de dsk-… van je disk in .env.');
  }
  return id;
}

/** Configureert de SDK met de env-waarden (idempotent). */
export function configure() {
  archil.configure({ apiKey: apiKey(), region: region() });
}

/** De disk uit ARCHIL_DISK_ID. */
export async function getDisk() {
  configure();
  return archil.getDisk(diskId());
}

/** Zoekt een disk op naam en maakt hem anders aan. De mount-token wordt nooit teruggegeven. */
export async function findOrCreateDisk(name) {
  configure();
  const existing = (await archil.listDisks()).find((d) => d.name === name);
  if (existing) return existing;
  const { disk } = await archil.createDisk({ name });
  return disk;
}

/**
 * Draait één commando op de disk. De disk staat in de container op /mnt/data en
 * is de working directory. Elke exec is een verse container: bestanden op de
 * disk blijven, container-state niet.
 */
export async function runCommand(disk, command) {
  const res = await disk.exec(command);
  return { stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode, timing: res.timing };
}

/** Quotet een pad voor de shell. */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/** Pad naar de bovenliggende map, of '' als het bestand in de root staat. */
function dirnameOf(path) {
  const cut = path.lastIndexOf('/');
  return cut > 0 ? path.slice(0, cut) : '';
}

/**
 * Schrijft een bestand op de disk in één exec. Schrijf in een verse submap per
 * job (die claimt de schrijfrechten) of checkout het pad eerst met
 * `archil checkout <pad>`, anders kan de mount read-only zijn.
 */
export async function writeFile(disk, path, contents) {
  const dir = dirnameOf(path);
  const b64 = Buffer.from(contents, 'utf8').toString('base64');
  const mkdir = dir ? `mkdir -p ${shellQuote(dir)} && ` : '';
  const res = await disk.exec(`${mkdir}printf %s ${shellQuote(b64)} | base64 -d > ${shellQuote(path)}`);
  if (res.exitCode !== 0) {
    throw new Error(`Schrijven naar ${path} faalde (exit ${res.exitCode}): ${res.stderr.trim()}`);
  }
  return path;
}

/** Leest een bestand van de disk in één exec en geeft de inhoud als string terug. */
export async function readFile(disk, path) {
  const res = await disk.exec(`cat ${shellQuote(path)}`);
  if (res.exitCode !== 0) {
    throw new Error(`Lezen van ${path} faalde (exit ${res.exitCode}): ${res.stderr.trim()}`);
  }
  return res.stdout;
}

/** Draait een commando op de disk uit ARCHIL_DISK_ID. */
export async function exec(command) {
  return runCommand(await getDisk(), command);
}
