/**
 * Offline-laag op SQLite: cache van belangrijke data + sync-queue.
 * Conflict-beleid: last-write-wins per veld-groep met merge op setups;
 * server blijft source of truth bij gelijktijdige wijzigingen.
 *
 * Web: expo-sqlite (wasm) kan traag/hangend zijn in dev — daar gebruiken we
 * een simpele localStorage-fallback, zodat het laden nooit blokkeert.
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

export async function queueSync(table: string, rowId: string, payload: unknown): Promise<void> {
  if (isWeb) {
    // Web heeft (nog) geen offline-wachtrij; schrijfacties gaan direct naar de server.
    return;
  }
  const d = await getDb();
  await d.runAsync(
    'insert into sync_queue (table_name, row_id, payload, created_at) values (?, ?, ?, ?)',
    table,
    rowId,
    JSON.stringify(payload),
    Date.now(),
  );
}

/** Voert de sync-queue uit zodra er weer internet is. */
export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  const d = await getDb();
  const rows = await d.getAllAsync<{
    id: number;
    table_name: string;
    row_id: string;
    payload: string;
  }>('select * from sync_queue order by created_at asc');
  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      // Slechts enkele whitelisted tabellen; server valideert verder via RLS.
      if (row.table_name === 'scooters') {
        await supabase.from('scooters').update(payload).eq('id', row.row_id);
      } else if (row.table_name === 'scooter_setups') {
        await supabase.from('scooter_setups').upsert({ id: row.row_id, ...payload });
      } else if (row.table_name === 'maintenance_records') {
        await supabase.from('maintenance_records').insert(payload);
      } else {
        failed++;
        continue;
      }
      await d.runAsync('delete from sync_queue where id = ?', row.id);
      synced++;
    } catch {
      failed++;
    }
  }
  return { synced, failed };
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
    return;
  }
  const d = await getDb();
  await d.execAsync('delete from cache_kv; delete from sync_queue;');
}
