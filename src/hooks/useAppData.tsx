/**
 * Gedeelde datalaag — één snapshot per scooter voor onderhoud, tuning en metingen.
 *
 * Home, Werkplaats en Garage lezen allemaal uit deze context. Zo laden ze niet
 * ieder hun eigen kopie en kunnen ze nooit verschillende aantallen laten zien.
 * De cache is in-memory (per sessie) en dedupliceert gelijktijdige aanvragen:
 * drie schermen die tegelijk om dezelfde scooter vragen, doen samen één fetch.
 *
 * Verversen: `refresh()` gebruikt de TTL (snel achter elkaar focus wisselen
 * doet niets); na een wijziging roept het scherm `refresh({ force: true })`.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useScooters } from '@/hooks/useScooters';
import { estimateCurrentKm, kmAnchorLabel } from '@/lib/km-estimate';
import {
  ensureSchedulesForScooter,
  listMaintenanceItems,
  listOpenReminders,
  listSchedules,
} from '@/services/maintenance';
import { listRuns } from '@/services/performance';
import { listSetups } from '@/services/tuning';
import type {
  MaintenanceItem,
  MaintenanceReminder,
  MaintenanceSchedule,
  PerformanceRun,
  Scooter,
  TuningSetup,
} from '@/types';

export interface MaintenanceSnapshot {
  items: MaintenanceItem[];
  schedules: MaintenanceSchedule[];
  reminders: MaintenanceReminder[];
}

export interface AppDataSnapshot {
  maintenance: MaintenanceSnapshot;
  setups: TuningSetup[];
  runs: PerformanceRun[];
  fetchedAt: number;
}

/** Hoe lang een snapshot als vers telt bij een focus-refresh. */
export const APP_DATA_TTL_MS = 15_000;
/** Aantal metingen dat de gedeelde laag ophaalt (Home, GPS en geschiedenis). */
export const APP_DATA_RUNS_LIMIT = 100;

const EMPTY_MAINTENANCE: MaintenanceSnapshot = { items: [], schedules: [], reminders: [] };
const EMPTY_SETUPS: TuningSetup[] = [];
const EMPTY_RUNS: PerformanceRun[] = [];

const CACHE = new Map<string, AppDataSnapshot>();
const INFLIGHT = new Map<string, Promise<AppDataSnapshot>>();

async function fetchSnapshot(scooter: Scooter): Promise<AppDataSnapshot> {
  const [items, reminders, setups, runs] = await Promise.all([
    listMaintenanceItems(),
    listOpenReminders(scooter.id).catch(() => [] as MaintenanceReminder[]),
    listSetups(scooter.id).catch(() => [] as TuningSetup[]),
    listRuns(APP_DATA_RUNS_LIMIT, scooter.id).catch(() => [] as PerformanceRun[]),
  ]);

  let schedules = await listSchedules(scooter.id).catch(() => [] as MaintenanceSchedule[]);
  // Nieuwe of lege planning: één keer aanmaken, daarna uit dezelfde snapshot lezen.
  if (schedules.length === 0 && scooter.fuel_system) {
    await ensureSchedulesForScooter({
      id: scooter.id,
      fuel_system: scooter.fuel_system,
    }).catch(() => undefined);
    schedules = await listSchedules(scooter.id).catch(() => [] as MaintenanceSchedule[]);
  }

  return {
    maintenance: { items, schedules, reminders },
    setups,
    runs,
    fetchedAt: Date.now(),
  };
}

/** Haalt de snapshot op, met cache en dedupe van gelijktijdige aanvragen. */
export function loadAppData(scooter: Scooter, force = false): Promise<AppDataSnapshot> {
  const cached = CACHE.get(scooter.id);
  if (!force && cached && Date.now() - cached.fetchedAt < APP_DATA_TTL_MS) {
    return Promise.resolve(cached);
  }

  const running = INFLIGHT.get(scooter.id);
  if (running) return running;

  const task = fetchSnapshot(scooter).then((snapshot) => {
    CACHE.set(scooter.id, snapshot);
    return snapshot;
  });
  INFLIGHT.set(scooter.id, task);
  // Ruim de in-flight registratie op zonder een tweede (ongevangen) promise te maken.
  task.then(
    () => INFLIGHT.delete(scooter.id),
    () => INFLIGHT.delete(scooter.id),
  );
  return task;
}

/** Alleen voor tests/diagnose: de gedeelde cache leegmaken. */
export function clearAppDataCache(): void {
  CACHE.clear();
}

interface AppDataContextValue {
  maintenance: MaintenanceSnapshot;
  setups: TuningSetup[];
  runs: PerformanceRun[];
  /** Zelfde kilometerstand als Home gebruikt (geschat waar nodig). */
  km: number;
  kmIsEstimated: boolean;
  /** Bijv. "3 dagen geleden bijgewerkt" of null. */
  kmAnchor: string | null;
  /** True zolang er voor deze scooter nog geen snapshot is. */
  loading: boolean;
  /** True tijdens een achtergrond-verversing (data blijft zichtbaar). */
  refreshing: boolean;
  error: boolean;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { activeScooter } = useScooters();
  const [snapshot, setSnapshot] = useState<AppDataSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = activeScooter?.id ?? null;
  }, [activeScooter?.id]);

  // Bij een andere scooter (of een gewijzigde scooter) opnieuw laden.
  useEffect(() => {
    const scooter = activeScooter;
    if (!scooter) {
      setSnapshot(null);
      setLoading(false);
      setError(false);
      return;
    }

    let alive = true;
    const cached = CACHE.get(scooter.id);
    setSnapshot(cached ?? null);
    setLoading(!cached);
    setError(false);

    loadAppData(scooter)
      .then((next) => {
        if (alive && activeIdRef.current === scooter.id) setSnapshot(next);
      })
      .catch(() => {
        if (alive && activeIdRef.current === scooter.id) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [activeScooter?.id, activeScooter?.fuel_system, activeScooter?.updated_at]);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    const scooter = activeScooter;
    if (!scooter) return;
    setRefreshing(true);
    try {
      const next = await loadAppData(scooter, opts?.force ?? false);
      if (activeIdRef.current === scooter.id) {
        setSnapshot(next);
        setError(false);
      }
    } catch {
      if (activeIdRef.current === scooter.id) setError(true);
    } finally {
      setRefreshing(false);
    }
    // activeScooter bewust via de ref-achtige closure: refresh blijft stabiel
    // voor useFocusEffect, zodat schermen niet bij elke km-update opnieuw laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScooter?.id, activeScooter?.fuel_system]);

  const estimate = activeScooter ? estimateCurrentKm(activeScooter) : null;
  const km = estimate?.estimatedKm ?? activeScooter?.current_km ?? 0;
  const kmIsEstimated = estimate?.isEstimated ?? false;
  const kmAnchor = estimate ? kmAnchorLabel(estimate.daysSinceUpdate) : null;

  const value = useMemo<AppDataContextValue>(
    () => ({
      maintenance: snapshot?.maintenance ?? EMPTY_MAINTENANCE,
      setups: snapshot?.setups ?? EMPTY_SETUPS,
      runs: snapshot?.runs ?? EMPTY_RUNS,
      km,
      kmIsEstimated,
      kmAnchor,
      loading: Boolean(activeScooter) && loading,
      refreshing,
      error,
      refresh,
    }),
    [snapshot, km, kmIsEstimated, kmAnchor, loading, refreshing, error, refresh, activeScooter],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData moet binnen AppDataProvider worden gebruikt');
  return ctx;
}

/** Onderhoud: items, planning en herinneringen uit dezelfde snapshot als Home. */
export function useMaintenanceData() {
  const data = useAppData();
  return {
    items: data.maintenance.items,
    schedules: data.maintenance.schedules,
    reminders: data.maintenance.reminders,
    km: data.km,
    kmIsEstimated: data.kmIsEstimated,
    kmAnchor: data.kmAnchor,
    loading: data.loading,
    refreshing: data.refreshing,
    error: data.error,
    refresh: data.refresh,
  };
}

/** Tuning: setups uit dezelfde snapshot als Home en de setup-editor. */
export function useTuningData() {
  const data = useAppData();
  return {
    setups: data.setups,
    loading: data.loading,
    error: data.error,
    refresh: data.refresh,
  };
}

/** Metingen: runs uit dezelfde snapshot als Home en de GPS-geschiedenis. */
export function usePerformanceData() {
  const data = useAppData();
  return {
    runs: data.runs,
    loading: data.loading,
    error: data.error,
    refresh: data.refresh,
  };
}
