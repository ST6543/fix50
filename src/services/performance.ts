/** Performance-service: runs opslaan en analyseren. */
import { query } from './api';
import { supabase } from '@/lib/supabase';
import type { PerformanceRun, UUID } from '@/types';
import type { PerformanceRunInput } from '@/lib/validation';

export type { PerformanceRun };

export async function saveRun(args: {
  scooterId: UUID | null;
  setupId: UUID | null;
  run: PerformanceRunInput & { gps_quality: 'goed' | 'matig' | 'slecht'; points: unknown[]; started_at: string };
}): Promise<PerformanceRun> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Niet ingelogd');
  return query<PerformanceRun>(() =>
    supabase
      .from('performance_runs')
      .insert({
        user_id: user.user!.id,
        scooter_id: args.scooterId,
        setup_id: args.setupId,
        started_at: args.run.started_at,
        ended_at: new Date().toISOString(),
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
      })
      .select('*')
      .single(),
  );
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
