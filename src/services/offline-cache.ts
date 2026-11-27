/**
 * Offline-laag op SQLite: cache van belangrijke data + sync-queue.
 * Conflict-beleid: last-write-wins per veld-groep met merge op setups;
 * server blijft source of truth bij gelijktijdige wijzigingen.
 *
 * De wachtrij onthoudt schrijfacties die door een netwerkstoring niet naar de
 * server konden. Ze blijven staan tot de flush slaagt — een rij die de server
 * weigert telt als "nog niet verzonden" en blijft zichtbaar, nooit stil als
 * mislukt of als verzonden.
 *
 * Web: expo-sqlite (wasm) kan traag/hangend zijn in dev — daar bewaren we de
 * cache én de wachtrij in localStorage, zodat het laden nooit blokkeert.
 */
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { supabase } from '@/lib/supabase';

const isWeb = Platform.OS === 'web';

// ── Web-fallback: localStorage-KV (synchron, betrouwbaar) ────
const WEB_PREFIX = 'fix50.kv.';

const webKv = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(WEB_PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(WEB_PREFIX + key, value);
    } catch {
      // Quota vol / private mode — cache is niet kritiek, negeren.
    }
  },
  delete(key: string): void {
    try {
      localStorage.removeItem(WEB_PREFIX + key);
    } catch {
      // negeren
    }
  },
};

/** Tabellen die de wachtrij mag afspelen; de server valideert verder via RLS. */
export const SYNC_QUEUE_TABLES = [
  'scooters',
  'scooter_setups',
  'maintenance_records',
  'fuel_logs',
  'tuning_changes',
  'performance_runs',
] as const;

export type SyncQueueTable = (typeof SYNC_QUEUE_TABLES)[number];

export interface QueuedRow {
  id: number;
  table_name: string;
  row_id: string;
  payload: string;
  created_at: number;
}

export interface SyncQueueSummary {
  /** Aantal rijden dat nog niet naar de server is geschreven. */
  pending: number;
  /** Moment (ms) van de oudste wachtende rij; null als de wachtrij leeg is. */
  oldestAt: number | null;
}

export interface SyncFlushResult {
  /** Rijen die nu naar de server zijn geschreven en uit de wachtrij zijn. */
  synced: number;
  /** Rijen die bleven staan (netwerk of door de server geweigerd). */
  failed: number;
  /** Nog openstaand na deze poging. */
  pending: number;
}

const WEB_QUEUE_KEY = 'sync_queue';

// ── Meldingen: schermen horen meteen dat de wachtrij veranderde ──
const listeners = new Set<() => void>();

function notifyQueueChanged(): void {
  for (const listener of listeners) listener();
}

/** Abonneer je op wijzigingen in de wachtrij; geeft een opruimfunctie. */
export function subscribeSyncQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Opslag ───────────────────────────────────────────────────
let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('fix50.db');
    await db.execAsync(`
      pragma journal_mode = WAL;
      create table if not exists cache_kv (
        key text primary key,
        value text not null,
        updated_at integer not null
      );
      create table if not exists sync_queue (
        id integer primary key autoincrement,
        table_name text not null,
        row_id text not null,
        payload text not null,
        created_at integer not null
      );
    `);
  }
  return db;
}

function webQueueRead(): QueuedRow[] {
  const raw = webKv.get(WEB_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function webQueueWrite(rows: QueuedRow[]): void {
  webKv.set(WEB_QUEUE_KEY, JSON.stringify(rows));
}

async function readQueue(): Promise<QueuedRow[]> {
  if (isWeb) return webQueueRead();
  const d = await getDb();
  return d.getAllAsync<QueuedRow>('select * from sync_queue order by created_at asc');
}

async function removeQueuedRow(id: number): Promise<void> {
  if (isWeb) {
    webQueueWrite(webQueueRead().filter((row) => row.id !== id));
    return;
  }
  const d = await getDb();
  await d.runAsync('delete from sync_queue where id = ?', id);
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  if (isWeb) {
    webKv.set(key, JSON.stringify(value));
    return;
  }
  const d = await getDb();
  await d.runAsync(
    'insert into cache_kv (key, value, updated_at) values (?, ?, ?) on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at',
    key,
    JSON.stringify(value),
    Date.now(),
  );
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (isWeb) {
    const raw = webKv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  const d = await getDb();
  const row = await d.getFirstAsync<{ value: string }>('select value from cache_kv where key = ?', [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

/**
 * Zet een schrijfactie in de wachtrij. `rowId` is het id van de rij (of het
 * groeps-id bij meerdere regels); `payload` is precies wat er verstuurd moet
 * worden, dus een object of een array.
 */
export async function queueSync(
  table: SyncQueueTable,
  rowId: string,
  payload: unknown,
): Promise<void> {
  const createdAt = Date.now();
  if (isWeb) {
    const rows = webQueueRead();
    webQueueWrite([
      ...rows,
      { id: createdAt + rows.length, table_name: table, row_id: rowId, payload: JSON.stringify(payload), created_at: createdAt },
    ]);
    notifyQueueChanged();
    return;
  }
  const d = await getDb();
  await d.runAsync(
    'insert into sync_queue (table_name, row_id, payload, created_at) values (?, ?, ?, ?)',
    table,
    rowId,
    JSON.stringify(payload),
    createdAt,
  );
  notifyQueueChanged();
}

/** Hoeveel schrijfacties wachten nog, en sinds wanneer. */
export async function syncQueueSummary(): Promise<SyncQueueSummary> {
  const rows = await readQueue();
  return {
    pending: rows.length,
    oldestAt: rows.length > 0 ? (rows[0]?.created_at ?? null) : null,
  };
}

export async function pendingSyncCount(): Promise<number> {
  return (await syncQueueSummary()).pending;
}

/**
 * Schrijft één wachtrij-rij naar de server. Supabase meldt fouten via `error`
 * in plaats van te gooien; die controleren we hier expliciet, zodat een
 * geweigerde rij niet als verzonden telt.
 */
async function sendQueuedRow(row: QueuedRow, payload: unknown): Promise<void> {
  const assertNoError = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  switch (row.table_name) {
    case 'scooters': {
      const { error } = await supabase
        .from('scooters')
        .update(payload as Record<string, unknown>)
        .eq('id', row.row_id);
      assertNoError(error);
      return;
    }
    case 'scooter_setups': {
      const { error } = await supabase
        .from('scooter_setups')
        .upsert({ id: row.row_id, ...(payload as Record<string, unknown>) });
      assertNoError(error);
      return;
    }
    case 'maintenance_records':
    case 'fuel_logs':
    case 'tuning_changes':
    case 'performance_runs': {
      const { error } = await supabase.from(row.table_name).insert(payload as never);
      assertNoError(error);
      return;
    }
    default:
      throw new Error(`Onbekende tabel in de wachtrij: ${row.table_name}`);
  }
}

/**
 * Voert de sync-queue uit zodra er weer internet is. Rijen die niet lukken
 * blijven staan en worden als `pending` teruggegeven — nooit stil weggegooid.
 */
export async function flushSyncQueue(): Promise<SyncFlushResult> {
  const rows = await readQueue();
  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as unknown;
      await sendQueuedRow(row, payload);
      await removeQueuedRow(row.id);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  const pending = await pendingSyncCount();
  if (synced > 0) notifyQueueChanged();
  return { synced, failed, pending };
}

/** Verwijdert de lokale cache (o.a. bij accountverwijdering of uitloggen). */
export async function clearCache(): Promise<void> {
  if (isWeb) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(WEB_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // negeren
    }
    notifyQueueChanged();
    return;
  }
  const d = await getDb();
  await d.execAsync('delete from cache_kv; delete from sync_queue;');
  notifyQueueChanged();
}
