/**
 * Stand van de offline-wachtrij: hoeveel schrijfacties wachten nog, en één
 * actie om ze nu te versturen. De flush gebeurt ook automatisch zodra de app
 * weer op de voorgrond komt.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  flushSyncQueue,
  subscribeSyncQueue,
  syncQueueSummary,
} from '@/services/offline-cache';

export interface SyncQueueState {
  /** Aantal schrijfacties dat nog niet op de server staat. */
  pending: number;
  /** Moment (ms) van de oudste wachtende rij; null als de wachtrij leeg is. */
  oldestAt: number | null;
  syncing: boolean;
  flush: () => Promise<void>;
}

export function useSyncQueue(): SyncQueueState {
  const [pending, setPending] = useState(0);
  const [oldestAt, setOldestAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const summary = await syncQueueSummary();
      setPending(summary.pending);
      setOldestAt(summary.oldestAt);
    } catch {
      // De wachtrij is nooit belangrijker dan het scherm zelf.
    }
  }, []);

  const flush = useCallback(async () => {
    setSyncing(true);
    try {
      await flushSyncQueue();
    } catch {
      // Netwerk nog steeds weg: de rijen blijven staan en de teller blijft zichtbaar.
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeSyncQueue(() => {
      void refresh();
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flush();
    });
    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, [refresh, flush]);

  return { pending, oldestAt, syncing, flush };
}
