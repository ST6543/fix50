/** Tuning-service: setups, wijzigingen en vergelijken. */
import { query } from './api';
import { supabase } from '@/lib/supabase';
import type { TuningChange, TuningSetup, UUID } from '@/types';

export async function listSetups(scooterId: UUID): Promise<TuningSetup[]> {
  return query<TuningSetup[]>(
    () =>
      supabase
        .from('tuning_setups')
        .select('*')
        .eq('scooter_id', scooterId)
        .order('is_active', { ascending: false })
        .order('name'),
  );
}

export async function createSetup(
  scooterId: UUID,
  name: string,
  parts: Record<string, string | number | null>,
): Promise<TuningSetup> {
  return query<TuningSetup>(
    () => supabase.from('tuning_setups').insert({ scooter_id: scooterId, name, parts }).select('*').single(),
  );
}

export async function updateSetup(
  id: UUID,
  patch: Partial<Pick<TuningSetup, 'name' | 'parts' | 'is_active' | 'notes'>>,
): Promise<void> {
  await query<void>(() => supabase.from('tuning_setups').update(patch).eq('id', id));
}

/** Zet één setup actief en de rest inactief (per scooter). */
export async function activateSetup(scooterId: UUID, setupId: UUID): Promise<void> {
  await query<void>(() =>
    supabase.from('tuning_setups').update({ is_active: false }).eq('scooter_id', scooterId),
  );
  await query<void>(() => supabase.from('tuning_setups').update({ is_active: true }).eq('id', setupId));
}

export async function deleteSetup(id: UUID): Promise<void> {
  await query<void>(() => supabase.from('tuning_setups').delete().eq('id', id));
}

export async function listChanges(scooterId: UUID, limit = 100): Promise<TuningChange[]> {
  return query<TuningChange[]>(
    () =>
      supabase
        .from('tuning_changes')
        .select('*')
        .eq('scooter_id', scooterId)
        .order('changed_at', { ascending: false })
        .limit(limit),
  );
}

export async function addChange(args: {
  scooterId: UUID;
  setupId?: UUID | null;
  part: string;
  oldValue?: string | null;
  newValue?: string | null;
  result?: string | null;
  notes?: string | null;
  kmAtChange?: number | null;
}): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Niet ingelogd');
  await query<void>(() =>
    supabase.from('tuning_changes').insert({
      user_id: user.user!.id,
      scooter_id: args.scooterId,
      setup_id: args.setupId ?? null,
      part: args.part,
      old_value: args.oldValue ?? null,
      new_value: args.newValue ?? null,
      result: args.result ?? null,
      notes: args.notes ?? null,
      km_at_change: args.kmAtChange ?? null,
      changed_at: new Date().toISOString(),
    }),
  );
}
