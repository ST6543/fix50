/** Meldingenoverzicht — in-app notificaties + push-registratie. */
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Badge, Button, EmptyState, LoadError, Loading } from '@/components/ui';
import { BellIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import { useMaintenanceData } from '@/hooks/useAppData';
import { enablePush, listNotifications, markRead } from '@/services/notifications';
import { resolveNotificationTarget } from '@/lib/notification-links';
import { timeAgo } from '@/lib/format';
import { colors, fonts, spacing } from '@/theme';
import type { AppNav } from '@/navigation/types';
import type { AppNotification } from '@/types';

export default function NotificationsScreen() {
  const navigation = useNavigation<AppNav>();
  const { activeScooter } = useScooters();
  const { schedules, items: maintenanceItems, km } = useMaintenanceData();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  /** Een mislukte query is geen lege meldingenlijst — die laten we zien. */
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    listNotifications()
      .then(setItems)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unread = items.filter((i) => !i.read_at).length;

  /**
   * Onderhoud → de taak die erbij hoort, verbruik → tankboek, prestatie →
   * metingen, diagnose → gesprekken. Alleen 'algemeen' heeft geen bestemming.
   */
  function handleOpen(notification: AppNotification) {
    if (!notification.read_at) {
      markRead(notification.id).catch(() => undefined);
      setItems((prev) =>
        prev.map((x) =>
          x.id === notification.id ? { ...x, read_at: new Date().toISOString() } : x,
        ),
      );
    }
    const target = resolveNotificationTarget({
      notification,
      schedules,
      items: maintenanceItems,
      currentKm: km,
      fuelSystem: activeScooter?.fuel_system ?? null,
    });
    if (!target) return;
    switch (target.screen) {
      case 'MaintenanceDetail':
        navigation.navigate('MaintenanceDetail', { scheduleId: target.scheduleId });
        break;
      case 'Garage':
        navigation.navigate('Main', { screen: 'Garage', params: { segment: target.segment } });
        break;
      case 'PerformanceHistory':
        navigation.navigate('PerformanceHistory');
        break;
      case 'ChatHistory':
        navigation.navigate('ChatHistory');
        break;
    }
  }

  if (loading) return <Loading label="Meldingen laden…" />;

  if (failed) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadError
          title="Meldingen niet geladen"
          subtitle="Je meldingen konden niet worden opgehaald. Controleer je verbinding en probeer het opnieuw."
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.unreadText}>{pushStatus ?? (unread > 0 ? `${unread} ongelezen` : 'Alles gelezen')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.s }}>
          {unread > 0 ? (
            <Button
              label="Alles lezen"
              variant="secondary"
              onPress={async () => {
                setBusy(true);
                await Promise.all(items.filter((i) => !i.read_at).map((i) => markRead(i.id))).catch(() => undefined);
                setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
                setBusy(false);
              }}
              loading={busy}
            />
          ) : null}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon={BellIcon}
            title="Geen meldingen"
            subtitle="Onderhoudsherinneringen verschijnen hier automatisch."
            actionLabel="Push aanzetten"
            onAction={async () => {
              setPushStatus(await enablePush() ? 'Push staat aan — je krijgt meldingen bij onderhoud.' : 'Push kon niet worden aangezet (web/Expo Go ondersteunt dit niet).');
            }}
          />
        }
        renderItem={({ item }) => {
          const target = resolveNotificationTarget({
            notification: item,
            schedules,
            items: maintenanceItems,
            currentKm: km,
            fuelSystem: activeScooter?.fuel_system ?? null,
          });
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={target ? `${item.title} — openen` : item.title}
              onPress={() => handleOpen(item)}
              style={[styles.card, !item.read_at && styles.unread]}
            >
              <View style={styles.cardRow}>
                <Text style={styles.title}>{item.title}</Text>
                <Badge
                  label={item.type === 'warning' ? 'Waarschuwing' : item.type === 'maintenance' ? 'Onderhoud' : 'Info'}
                  tone={item.type === 'warning' ? 'danger' : item.type === 'maintenance' ? 'warning' : 'info'}
                />
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <View style={styles.cardFoot}>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                {target ? (
                  <Text style={styles.openHint}>
                    {target.screen === 'MaintenanceDetail' ? 'Open taak ›' : 'Openen ›'}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
  },
  unreadText: { color: colors.textMuted, fontSize: 13 },
  list: { padding: spacing.l },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    marginBottom: spacing.m,
    opacity: 0.75,
  },
  unread: { opacity: 1, borderColor: colors.primary },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontWeight: '700', flexShrink: 1, marginRight: spacing.s },
  body: { color: colors.textMuted, marginTop: spacing.xs, lineHeight: 19 },
  time: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.xs },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.s,
  },
  openHint: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});
