/** Tuning-service: setups, wijzigingen en vergelijken. */
import { query } from './api';
import { supabase } from '@/lib/supabase';
import type { TuningChange, TuningSetup, UUID } from '@/types';
import { JET_PART_LABELS, newGroupId } from '@/lib/jet-log';

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

/** De actieve setup van een scooter, of null als er (nog) geen actief is. */
export async function getActiveSetup(scooterId: UUID): Promise<TuningSetup | null> {
  const setups = await listSetups(scooterId);
  return setups.find((s) => s.is_active) ?? null;
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
        .select('*, run:performance_runs(id, max_speed_kmh, t0_50_s, gps_quality, started_at)')
        .eq('scooter_id', scooterId)
        .order('changed_at', { ascending: false })
        .limit(limit),
  );
}

/**
 * Koppelt een opgeslagen GPS-test aan precies de gekozen sproeierwissel. De
 * keuze komt uit het scherm (of uit "test deze wissel"), niet uit een
 * tijdvenster: zo hoort een meting nooit per ongeluk bij de verkeerde wissel.
 *
 * Geeft het aantal regels terug dat echt gekoppeld is. 0 betekent: geen keuze
 * gemaakt, of de wissel bestaat niet meer. Zo kan het scherm dat melden in
 * plaats van een meting stil ongekoppeld op te slaan.
 */
export async function attachRunToJetChange(args: { runId: UUID; changeIds: UUID[] }): Promise<number> {
  if (args.changeIds.length === 0) return 0;
  const updated = await query<{ id: string }[]>(() =>
    supabase.from('tuning_changes').update({ run_id: args.runId }).in('id', args.changeIds).select('id'),
  );
  return updated?.length ?? 0;
}

/**
 * De sproeierwissel die bij een meting hoort, voor het resultaatscherm.
 * Meerdere regels horen bij dezelfde wissel; de volgorde is die van de wissel.
 */
export async function listRunJetChanges(runId: UUID): Promise<TuningChange[]> {
  return query<TuningChange[]>(
    () =>
      supabase
        .from('tuning_changes')
        .select('*')
        .eq('run_id', runId)
        .in('part', [...JET_PART_LABELS])
        .order('changed_at', { ascending: true }),
  );
}

/**
 * Corrigeert een verkeerd gelogde wijziging: alleen de tekst van de regel,
 * zodat een gekoppelde GPS-meting en de rest van de geschiedenis blijven staan.
 */
export async function updateChange(
  id: UUID,
  patch: Partial<Pick<TuningChange, 'old_value' | 'new_value' | 'notes' | 'result'>>,
): Promise<void> {
  await query<void>(() => supabase.from('tuning_changes').update(patch).eq('id', id));
}

/** Verwijdert een foutief gelogde wissel in één keer (alle regels ervan). */
export async function deleteChanges(ids: UUID[]): Promise<void> {
  if (ids.length === 0) return;
  await query<void>(() => supabase.from('tuning_changes').delete().in('id', ids));
}

/**
 * Zet verwijderde wissels terug, met hun oorspronkelijke id en tijdstip, zodat
 * een gekoppelde GPS-meting en de plek in de geschiedenis bewaard blijven.
 */
export async function restoreChanges(rows: TuningChange[]): Promise<void> {
  if (rows.length === 0) return;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Niet ingelogd');
  const payload = rows.map((row) => ({
    id: row.id,
    user_id: user.user!.id,
    scooter_id: row.scooter_id,
    setup_id: row.setup_id ?? null,
    run_id: row.run_id ?? null,
    group_id: row.group_id ?? null,
    changed_at: row.changed_at,
    km_at_change: row.km_at_change ?? null,
    part: row.part,
    old_value: row.old_value ?? null,
    new_value: row.new_value ?? null,
    result: row.result ?? null,
    notes: row.notes ?? null,
  }));
  await query<void>(() => supabase.from('tuning_changes').insert(payload));
}

export interface NewChangeRow {
  part: string;
  oldValue?: string | null;
  newValue?: string | null;
  result?: string | null;
  notes?: string | null;
}

/**
 * Logt de regels van één wissel in één insert, met hetzelfde groeps-id en
 * tijdstip. Zo horen ze ook na een herstart expliciet bij elkaar, zonder dat
 * een tijdvenster hoeft te raden.
 */
export async function addChanges(args: {
  scooterId: UUID;
  setupId?: UUID | null;
  rows: NewChangeRow[];
  kmAtChange?: number | null;
  /** Hergebruik een bestaand groeps-id; standaard komt er een nieuwe. */
  groupId?: UUID | null;
}): Promise<void> {
  if (args.rows.length === 0) return;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Niet ingelogd');

  const groupId = args.groupId ?? newGroupId();
  const changedAt = new Date().toISOString();
  const payload = args.rows.map((row) => ({
    user_id: user.user!.id,
    scooter_id: args.scooterId,
    setup_id: args.setupId ?? null,
    group_id: groupId,
    part: row.part,
    old_value: row.oldValue ?? null,
    new_value: row.newValue ?? null,
    result: row.result ?? null,
    notes: row.notes ?? null,
    km_at_change: args.kmAtChange ?? null,
    changed_at: changedAt,
  }));
  await query<void>(() => supabase.from('tuning_changes').insert(payload));
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
  await addChanges({
    scooterId: args.scooterId,
    setupId: args.setupId,
    kmAtChange: args.kmAtChange,
    rows: [
      {
        part: args.part,
        oldValue: args.oldValue,
        newValue: args.newValue,
        result: args.result,
        notes: args.notes,
      },
    ],
  });
}
