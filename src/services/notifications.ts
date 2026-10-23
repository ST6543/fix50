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
