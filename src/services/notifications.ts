/**
 * Notificatie-service: in-app meldingen + echte push-herinneringen.
 *
 * expo-notifications wordt lazy geïmporteerd mét try/catch zodat de app nooit
 * crasht als de native module ontbreekt (web, of Expo Go op Android waar de
 * push-API beperkt is). Zonder module valt alles terug op de in-app meldingen.
 */
import { Platform } from 'react-native';

import { query } from './api';
import { supabase } from '@/lib/supabase';
import {
  insightToNotificationPayload,
  isoWeekKey,
  type Insight,
} from '@/lib/insights';
import type { AppNotification } from '@/types';

/** Dynamisch de notifications-module laden; null als dat niet kan. */
async function loadNotifications(): Promise<typeof import('expo-notifications') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

/** Vraag notificatie-permissie; true bij granted (of eerder verleend). */
export async function requestPermission(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted || existing.status === 'granted') return true;
    const request = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return request.granted || request.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Registreer het apparaat bij Expo push en koppel het token aan de gebruiker
 * via de register-push-token Edge Function. Fouten zijn zacht: push is een
 * verrijking, geen harde eis — bij falen doen in-app meldingen het werk.
 */
export async function registerPushToken(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  try {
    // ExpoPushToken: de Edge Function verstuurt via de Expo push API
    // (exp.host), dus we moeten een Expo-token registreren — geen rauw
    // FCM-token (dat geeft getDevicePushTokenAsync en wordt door de
    // Expo-push-API geweigerd). getExpoPushTokenAsync vereist een
    // projectId (uit app.json extra.eas).
    const Constants = await import('expo-constants');
    const projectId =
      (Constants.default.expoConfig?.extra?.eas?.projectId as string | undefined) ?? null;
    if (!projectId) {
      console.log('[push] Geen projectId in extra.eas — run `eas init` eerst.');
      return false;
    }
    const device = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = device.data;
    if (!token || !token.startsWith('ExponentPushToken')) {
      console.log('[push] Ongeldig of onverwacht push-token:', token?.slice(0, 20));
      return false;
    }

    await query<void>(() =>
      supabase.functions.invoke('register-push-token', {
        body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      }),
    );

    // Android-kanaal instellen (kunnen we bijhouden met de standaardinstellingen).
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('onderhoud', {
        name: 'Onderhoud',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#FF6B00',
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** Eén knop: permissie + registratie in één keer; true als push aan staat. */
export async function enablePush(): Promise<boolean> {
  const ok = await requestPermission();
  if (!ok) return false;
  return registerPushToken();
}

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  return query<AppNotification[]>(
    () =>
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
  );
}

export async function markRead(id: string): Promise<void> {
  await query<void>(() =>
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id),
  );
}

export async function unreadCount(): Promise<number> {
  return query<number>(async () => {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    return { data: error ? 0 : (count ?? 0), error: null };
  });
}

export async function getUserSettings() {
  return query<Record<string, unknown> | null>(
    () => supabase.from('user_settings').select('*').maybeSingle(),
  );
}

export async function updateUserSettings(patch: Record<string, unknown>): Promise<void> {
  await query<void>(() => supabase.from('user_settings').update(patch));
}

/**
 * Push bij verslechtering (fase C van het AI-plan): zet waarschuwingssignalen
 * ('let op'/'risico') om in in-app meldingen. Guardrails:
 * - info-signalen pushen nooit (die staan al op de Home-kaart);
 * - de gebruikersinstellingen tellen mee: onderhoudssignalen volgen
 *   `maintenance_notifications`, de rest volgt `push_enabled`;
 * - melding dtypeen maximaal één keer per week per signaal (dedupe_key);
 * - fouten zijn stil: dit is best-effort, Home blijft altijd werken.
 */
export async function notifyDeterioration(
  scooterId: string | null,
  insights: Insight[],
): Promise<number> {
  const payloads = insights
    .map((ins) => insightToNotificationPayload(ins, isoWeekKey()))
    .filter((p): p is NonNullable<ReturnType<typeof insightToNotificationPayload>> => p !== null);
  if (payloads.length === 0) return 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  // Instellingen (best-effort; null ≡ standaard aan).
  const { data: settings } = await supabase
    .from('user_settings')
    .select('push_enabled, maintenance_notifications')
    .eq('user_id', user.id)
    .maybeSingle();
  const s = (settings as { push_enabled?: boolean; maintenance_notifications?: boolean } | null) ?? null;
  const allowed = (kind: Insight['kind']): boolean =>
    kind === 'onderhoud' ? s?.maintenance_notifications !== false : s?.push_enabled !== false;

  const rows = payloads
    .filter((p, i) => allowed(insights[i]!.kind))
    .map((p) => ({ user_id: user.id, scooter_id: scooterId, ...p }));
  if (rows.length === 0) return 0;

  // Bestaande keys overslaan (dedupe-index is expressie-gebaseerd, dus geen onConflict).
  const keys = rows.map((r) => r.dedupe_key);
  const { data: existing } = await supabase
    .from('notifications')
    .select('dedupe_key')
    .in('dedupe_key', keys);
  const seen = new Set((existing ?? []).map((e: { dedupe_key: string }) => e.dedupe_key));
  const fresh = rows.filter((r) => !seen.has(r.dedupe_key));
  if (fresh.length === 0) return 0;

  const { error } = await supabase.from('notifications').insert(fresh);
  if (error) return 0; // stil: best-effort
  return fresh.length;
}
