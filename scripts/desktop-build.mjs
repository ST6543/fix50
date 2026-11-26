#!/usr/bin/env node
/**
 * Desktop-build met automatische opruiming.
 *
 * Elke build landt in `desktop-build/`. Staat daar nog een build van de vorige
 * keer, dan wordt die eerst gearchiveerd als `desktop-build-v<N>`. Na een
 * geslaagde build blijven alleen de twee nieuwste buildmappen en het laatste
 * logbestand staan, zodat de schijf niet volloopt.
 *
 * Gebruik:
 *   node scripts/desktop-build.mjs               # exporteren, bouwen, opruimen
 *   node scripts/desktop-build.mjs --prune-only  # alleen opruimen
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Alleen voor tests: laat de rotatie in een andere map draaien.
const ROOT = process.env.DESKTOP_BUILD_ROOT ? path.resolve(process.env.DESKTOP_BUILD_ROOT) : PROJECT_ROOT;

const BUILD_DIR = path.join(ROOT, 'desktop-build');
const LOG_FILE = path.join(ROOT, 'desktop-build.log');
/** Hoeveel buildmappen er na een geslaagde build mogen blijven. */
const KEEP_BUILD_DIRS = 2;

const VERSIONED = /^desktop-build-v(\d+)$/;
const LOG = /^desktop-build.*\.log$/;

function entries() {
  if (!existsSync(ROOT)) return [];
  return readdirSync(ROOT);
}

/** Gearchiveerde builds, oudste eerst. */
function versionedBuilds() {
  return entries()
    .map((name) => {
      const match = VERSIONED.exec(name);
      if (!match) return null;
      const full = path.join(ROOT, name);
      if (!statSync(full).isDirectory()) return null;
      return { name, full, version: Number(match[1]) };
    })
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);
}

function nextVersion() {
  const builds = versionedBuilds();
  return builds.length > 0 ? builds[builds.length - 1].version + 1 : 1;
}

/**
 * De huidige `desktop-build/` wegzetten als versiearchief, zodat de nieuwe
 * build weer in `desktop-build/` kan landen zonder oude builds te overschrijven.
 */
function archiveCurrentBuild() {
  if (!existsSync(BUILD_DIR)) return null;
  const target = path.join(ROOT, `desktop-build-v${nextVersion()}`);
  renameSync(BUILD_DIR, target);
  return path.basename(target);
}

/**
 * Houd de nieuwste twee buildmappen en het laatste logbestand. `desktop-build/`
 * telt als de nieuwste; daaronder telt het hoogste versienummer.
 */
function prune({ keep = KEEP_BUILD_DIRS } = {}) {
  const current = existsSync(BUILD_DIR) ? 1 : 0;
  // Nieuwste eerst: de actieve build, daarna de archieven op versienummer.
  const ranked = [
    ...(current ? [{ name: 'desktop-build', full: BUILD_DIR }] : []),
    ...versionedBuilds().reverse(),
  ];

  const removedDirs = [];
  for (const dir of ranked.slice(keep)) {
    rmSync(dir.full, { recursive: true, force: true });
    removedDirs.push(dir.name);
  }

  const removedLogs = [];
  for (const name of entries()) {
    if (!LOG.test(name) || name === path.basename(LOG_FILE)) continue;
    const full = path.join(ROOT, name);
    if (!statSync(full).isFile()) continue;
    rmSync(full, { force: true });
    removedLogs.push(name);
  }

  const keptDirs = ranked.slice(0, keep).map((dir) => dir.name);
  return { keptDirs, removedDirs, removedLogs };
}

/** Commando uitvoeren en de uitvoer naar het scherm én het logbestand schrijven. */
function run(command, args) {
  appendFileSync(LOG_FILE, `\n$ ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  appendFileSync(LOG_FILE, output);
  return result.status === 0;
}

function pruneOnly() {
  const { keptDirs, removedDirs, removedLogs } = prune();
  console.log(`Bewaard: ${keptDirs.join(', ') || '(geen buildmappen)'}`);
  if (removedDirs.length > 0) console.log(`Verwijderd: ${removedDirs.join(', ')}`);
  if (removedLogs.length > 0) console.log(`Oude logs verwijderd: ${removedLogs.length}`);
  return 0;
}

function build() {
  writeFileSync(LOG_FILE, `Desktop-build ${new Date().toISOString()}\n`);

  // Eerst de vorige build veiligstellen; mislukt de nieuwe build, dan blijft de
  // oude gewoon als archief staan.
  const archived = archiveCurrentBuild();
  if (archived) console.log(`Vorige build gearchiveerd als ${archived}.`);

  if (!run('npm', ['run', 'desktop:export'])) {
    console.error('Exporteren mislukt — de oude build is niet opgeruimd.');
    return 1;
  }
  if (!run('npx', ['--no-install', 'electron-builder', '--win', 'portable', '--config', 'electron-builder.desktop.json'])) {
    console.error('electron-builder mislukt — de oude build is niet opgeruimd.');
    return 1;
  }

  const { keptDirs, removedDirs, removedLogs } = prune();
  console.log(`\nBuild klaar. Bewaard: ${keptDirs.join(', ')}`);
  if (removedDirs.length > 0) console.log(`Oude builds verwijderd: ${removedDirs.join(', ')}`);
  if (removedLogs.length > 0) console.log(`Oude logs verwijderd: ${removedLogs.length}`);
  console.log(`Log: ${path.relative(PROJECT_ROOT, LOG_FILE)}`);
  return 0;
}

const pruneOnlyMode = process.argv.includes('--prune-only');
process.exit(pruneOnlyMode ? pruneOnly() : build());
