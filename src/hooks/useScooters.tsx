/** Scooter-context: alle schermen delen de scooterlijst en de actieve scooter. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { cacheGet, cacheSet } from '@/services/offline-cache';
import * as scootersService from '@/services/scooters';
import { useAuth } from './useAuth';
import type { Scooter, ScooterSetup } from '@/types';

interface ScootersContextValue {
  scooters: Scooter[];
  activeScooter: Scooter | null;
  setup: ScooterSetup | null;
  loading: boolean;
  reload: () => Promise<void>;
  setActiveScooterId: (id: string | null) => void;
  updateKm: (km: number) => Promise<void>;
}

const ScootersContext = createContext<ScootersContextValue | null>(null);
const ACTIVE_KEY = 'active_scooter_id';

export function ScootersProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [scooters, setScooters] = useState<Scooter[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [setup, setSetup] = useState<ScooterSetup | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await scootersService.listScooters();
      setScooters(list);
      await cacheSet('scooters', list);
      const stored = await cacheGet<string>(ACTIVE_KEY);
      const nextActive = list.find((s) => s.id === (stored ?? '')) ?? list[0] ?? null;
      setActiveId(nextActive?.id ?? null);
    } catch {
      // Offline: toon gecachete data
      const cached = await cacheGet<Scooter[]>('scooters');
      if (cached) setScooters(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setScooters([]);
      setActiveId(null);
      setSetup(null);
      return;
    }
    void reload();
  }, [session, reload]);

  useEffect(() => {
    if (activeId) void cacheSet(ACTIVE_KEY, activeId);
    if (!activeId) {
      setSetup(null);
      return;
    }
    scootersService
      .getSetup(activeId)
      .then((s) => {
        setSetup(s);
        if (s) void cacheSet(`setup:${activeId}`, s);
      })
      .catch(async () => {
        setSetup(await cacheGet<ScooterSetup>(`setup:${activeId}`));
      });
  }, [activeId]);

  const updateKm = useCallback(
    async (km: number) => {
      if (!activeId) return;
      await scootersService.updateKilometers(activeId, km);
      setScooters((prev) => prev.map((s) => (s.id === activeId ? { ...s, current_km: km } : s)));
    },
    [activeId],
  );

  const value = useMemo<ScootersContextValue>(
    () => ({
      scooters,
      activeScooter: scooters.find((s) => s.id === activeId) ?? null,
      setup,
      loading,
      reload,
      setActiveScooterId: setActiveId,
      updateKm,
    }),
    [scooters, activeId, setup, loading, reload, updateKm],
  );

  return <ScootersContext.Provider value={value}>{children}</ScootersContext.Provider>;
}

export function useScooters(): ScootersContextValue {
  const ctx = useContext(ScootersContext);
  if (!ctx) throw new Error('useScooters moet binnen ScootersProvider worden gebruikt');
  return ctx;
}
