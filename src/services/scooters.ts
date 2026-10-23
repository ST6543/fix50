/** Scooter-service: CRUD + setup + kilometerstand + foto's. */
import { AppError, query } from './api';
import { supabase } from '@/lib/supabase';
import { base64ToBytes } from '@/lib/base64';
import type { Scooter, ScooterSetup, UUID } from '@/types';
import type { ScooterInput } from '@/lib/validation';

const PHOTO_BUCKET = 'scooter-photos';

/** Een gekozen foto: base64-data + mime (van expo-image-picker, base64: true). */
export interface PhotoPayload {
  base64: string;
  mime: string;
}

function friendlyStorageError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('row-level security') || m.includes('permission')) {
    return 'Je hebt geen toestemming om een foto te uploaden. Log opnieuw in.';
  }
  if (m.includes('bucket') || m.includes('not found')) {
    return 'De fotobucket bestaat nog niet op de server. Update de app of neem contact op met FIX50.';
  }
  if (m.includes('payload') || m.includes('too large') || m.includes('exceeded')) {
    return 'De foto is te groot. Kies een kleinere foto of maak hem opnieuw met de camera.';
  }
  return 'Foto-uploaden mislukt. Probeer het opnieuw.';
}

/** Uploadt naar de publieke fotobucket: {user_id}/{prefix}-{timestamp}.{ext}. */
async function uploadPhoto(photo: PhotoPayload, namePrefix: string): Promise<string> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new AppError('Log eerst in om een foto te uploaden.');
  const ext = photo.mime.includes('png') ? 'png' : photo.mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${user.user.id}/${namePrefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, base64ToBytes(photo.base64), { contentType: photo.mime, upsert: true });
  if (error) throw new AppError(friendlyStorageError(error.message));
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Profielfoto (profiles.avatar_url) bijwerken. */
export async function setProfileAvatar(url: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new AppError('Log eerst in.');
  await query(() => supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.user.id));
}

/**
 * Scooterfoto uploaden, opslaan op de scooter én als profielfoto zetten —
 * zo staat hij op het profiel én in het onderhoudsboekje/tuningrapport.
 */
export async function uploadScooterPhoto(scooterId: UUID, photo: PhotoPayload): Promise<string> {
  const url = await uploadPhoto(photo, `scooter-${scooterId}`);
  await query(() => supabase.from('scooters').update({ image_url: url }).eq('id', scooterId));
  await setProfileAvatar(url);
  return url;
}

/** Foto los uploaden als profielfoto (zonder gekoppelde scooter). */
export async function uploadProfilePhoto(photo: PhotoPayload): Promise<string> {
  const url = await uploadPhoto(photo, 'avatar');
  await setProfileAvatar(url);
  return url;
}

/** Scooterfoto verwijderen (alleen de verwijzing; het bestand blijft in de bucket). */
export async function clearScooterPhoto(scooterId: UUID): Promise<void> {
  await query(() => supabase.from('scooters').update({ image_url: null }).eq('id', scooterId));
}

export async function listScooters(): Promise<Scooter[]> {
  return query<Scooter[]>(
    () => supabase.from('scooters').select('*').order('created_at', { ascending: true }),
  );
}

export async function createScooter(input: ScooterInput): Promise<Scooter> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Niet ingelogd');
  return query<Scooter>(async () =>
    supabase
      .from('scooters')
      .insert({
        ...input,
        user_id: user.user!.id,
        brand: input.brand || null,
        model: input.model || null,
        year: input.year || null,
        engine_type: input.engine_type || null,
        fuel_system: input.fuel_system || null,
        license_plate: input.license_plate || null,
        notes: input.notes || null,
      })
      .select('*')
      .single(),
  );
}

export async function updateScooter(id: UUID, patch: Partial<ScooterInput>): Promise<void> {
  await query<void>(() => supabase.from('scooters').update(patch).eq('id', id));
}

/** Kilometerstand bijwerken; DB-trigger herberekent schedules + maakt reminders. */
export async function updateKilometers(id: UUID, currentKm: number): Promise<void> {
  await query<void>(() => supabase.from('scooters').update({ current_km: currentKm }).eq('id', id));
}

/** Gemiddeld km-verbruik per week opslaan (null = schatting uitzetten). */
export async function updateWeeklyKm(id: UUID, avgKmPerWeek: number | null): Promise<void> {
  await query<void>(() =>
    supabase.from('scooters').update({ avg_km_per_week: avgKmPerWeek }).eq('id', id),
  );
}

export async function deleteScooter(id: UUID): Promise<void> {
  await query<void>(() => supabase.from('scooters').delete().eq('id', id));
}

export async function getSetup(scooterId: UUID): Promise<ScooterSetup | null> {
  return query<ScooterSetup | null>(
    () => supabase.from('scooter_setups').select('*').eq('scooter_id', scooterId).maybeSingle(),
  );
}

export async function saveSetup(
  scooterId: UUID,
  setup: Partial<ScooterSetup>,
): Promise<ScooterSetup> {
  return query<ScooterSetup>(async () => {
    const existing = await supabase
      .from('scooter_setups')
      .select('id')
      .eq('scooter_id', scooterId)
      .maybeSingle();
    if (existing.data) {
      return supabase
        .from('scooter_setups')
        .update({ ...setup, updated_at: new Date().toISOString() })
        .eq('scooter_id', scooterId)
        .select('*')
        .single();
    }
    return supabase
      .from('scooter_setups')
      .insert({ scooter_id: scooterId, ...setup })
      .select('*')
      .single();
  });
}
