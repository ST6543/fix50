/** Meldingenoverzicht — in-app notificaties + push-registratie. */
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Badge, Button, EmptyState, Loading } from '@/components/ui';
import { BellIcon } from '@/components/icons';
import { enablePush, listNotifications, markRead } from '@/services/notifications';
import { timeAgo } from '@/lib/format';
import { colors, spacing } from '@/theme';
import type { AppNotification } from '@/types';

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      listNotifications()
        .then(setItems)
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, []),
  );

  const unread = items.filter((i) => !i.read_at).length;

  if (loading) return <Loading label="Meldingen laden…" />;

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
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (!item.read_at) {
                markRead(item.id).catch(() => undefined);
                setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x)));
              }
            }}
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
            <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
          </Pressable>
        )}
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
});
