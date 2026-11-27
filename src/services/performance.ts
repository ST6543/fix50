/** Performance-service: runs opslaan en analyseren. */
import { randomUUID } from 'expo-crypto';

import { isOfflineError, query } from './api';
import { currentUserId } from './offline-queue';
import { queueSync } from './offline-cache';
import { supabase } from '@/lib/supabase';
import type { PerformancePoint, PerformanceRun, UUID } from '@/types';
import type { PerformanceRunInput } from '@/lib/validation';

export type { PerformanceRun };

/** Een opgeslagen meting; `queued` betekent lokaal bewaard, nog niet verzonden. */
export interface SaveRunResult {
  run: PerformanceRun;
  queued: boolean;
}

export async function saveRun(args: {
  scooterId: UUID | null;
  setupId: UUID | null;
  run: PerformanceRunInput & { gps_quality: 'goed' | 'matig' | 'slecht'; points: unknown[]; started_at: string };
}): Promise<SaveRunResult> {
  const userId = await currentUserId();
  const endedAt = new Date().toISOString();
  const payload = {
    id: randomUUID(),
    user_id: userId,
    scooter_id: args.scooterId,
    setup_id: args.setupId,
    started_at: args.run.started_at,
    ended_at: endedAt,
    duration_s: args.run.duration_s,
    distance_m: args.run.distance_m,
    max_speed_kmh: args.run.max_speed_kmh,
    avg_speed_kmh: args.run.avg_speed_kmh,
    t0_50_s: args.run.t0_50_s ?? null,
    t0_80_s: args.run.t0_80_s ?? null,
    t50_80_s: args.run.t50_80_s ?? null,
    gps_quality: args.run.gps_quality,
    points: args.run.points,
    notes: null,
  };

  try {
    const saved = await query<PerformanceRun>(() =>
      supabase.from('performance_runs').insert(payload).select('*').single(),
    );
    return { run: saved, queued: false };
  } catch (err) {
    if (!isOfflineError(err)) throw err;
    // Offline: de meting wacht in de wachtrij en het scherm zegt dat eerlijk.
    await queueSync('performance_runs', payload.id, payload);
    return {
      run: {
        id: payload.id,
        scooter_id: payload.scooter_id,
        setup_id: payload.setup_id,
        started_at: payload.started_at,
        ended_at: endedAt,
        duration_s: payload.duration_s,
        distance_m: payload.distance_m,
        max_speed_kmh: payload.max_speed_kmh,
        avg_speed_kmh: payload.avg_speed_kmh,
        t0_50_s: payload.t0_50_s,
        t0_80_s: payload.t0_80_s,
        t50_80_s: payload.t50_80_s,
        gps_quality: payload.gps_quality,
        points: payload.points as PerformancePoint[],
        notes: null,
        created_at: endedAt,
      },
      queued: true,
    };
  }
}

export async function listRuns(limit = 50, scooterId?: UUID): Promise<PerformanceRun[]> {
  return query<PerformanceRun[]>(
    () => {
      let req = supabase
        .from('performance_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      // Metingen zijn scooter-gebonden: een Aerox-meting hoort niet bij de schakel.
      if (scooterId) req = req.eq('scooter_id', scooterId);
      return req;
    },
  );
}

export async function deleteRun(id: UUID): Promise<void> {
  await query<void>(() => supabase.from('performance_runs').delete().eq('id', id));
}

export function bestRun(runs: PerformanceRun[], metric: 't0_50_s' | 't0_80_s' | 'max_speed_kmh'): PerformanceRun | null {
  const withValue = runs.filter((r) => r[metric] !== null);
  if (withValue.length === 0) return null;
  const isTime = metric !== 'max_speed_kmh';
  return withValue.reduce((best, r) => {
    const bv = best[metric] as number;
    const rv = r[metric] as number;
    return (isTime ? rv < bv : rv > bv) ? r : best;
  }, withValue[0]!);
}
