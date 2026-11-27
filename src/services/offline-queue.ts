/**
 * Schrijven met een offline-val: probeert de server, en bewaart de rij in de
 * sync-wachtrij als het netwerk ontbreekt. Andere fouten (RLS, validatie)
 * worden gewoon doorgegeven — die horen niet in de wachtrij.
 */
import { isOfflineError } from './api';
import { queueSync, type SyncQueueTable } from './offline-cache';
import { supabase } from '@/lib/supabase';

/** 'queued' betekent: lokaal bewaard, nog niet op de server. */
export type SendResult = 'sent' | 'queued';

export async function sendOrQueue(
  table: SyncQueueTable,
  rowId: string,
  payload: unknown,
  send: () => Promise<unknown>,
): Promise<SendResult> {
  try {
    await send();
    return 'sent';
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    await queueSync(table, rowId, payload);
    return 'queued';
  }
}

/**
 * Gebruiker uit de lokale sessie. `getUser()` vraagt de server om bevestiging
 * en faalt daardoor offline; `getSession()` leest de opgeslagen sessie en werkt
 * ook zonder netwerk, zodat we de rij toch kunnen bewaren.
 */
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Niet ingelogd');
  return id;
}
