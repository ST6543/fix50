/** Gespreksgeschiedenis — overzicht, bekijken en verwijderen. */
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Button, Card, EmptyState, Loading, SectionTitle } from '@/components/ui';
import { MiniBarChart } from '@/components/charts';
import { FadeInView } from '@/components/motion';
import { ChatIcon } from '@/components/icons';
import * as chatService from '@/services/chat';
import { activityLast7Days, formatDateTime } from '@/lib/format';
import { colors, spacing } from '@/theme';
import type { ChatSession } from '@/types';

type Nav = AppNav;

export default function ChatHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      chatService
        .listSessions()
        .then(setSessions)
        .catch(() => setSessions([]))
        .finally(() => setLoading(false));
    }, []),
  );

  function confirmDelete(id: string) {
    Alert.alert('Gesprek verwijderen?', 'Dit kan niet ongedaan worden.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: async () => {
          await chatService.deleteSession(id).catch(() => undefined);
          setSessions((prev) => prev.filter((s) => s.id !== id));
        },
      },
    ]);
  }

  if (loading) return <Loading label="Gesprekken laden…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          sessions.length > 0 ? (
            <FadeInView>
              <SectionTitle>Overzicht</SectionTitle>
              <Card style={styles.summaryCard}>
                <MiniBarChart data={activityLast7Days(sessions, (s) => s.updated_at)} height={90} />
                <Text style={styles.summaryCaption}>
                  {sessions.length} gesprek{sessions.length === 1 ? '' : 'ken'} · activiteit per dag
                </Text>
              </Card>
            </FadeInView>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={ChatIcon}
            title="Nog geen gesprekken"
            subtitle="Start je eerste diagnose in de chat."
            actionLabel="Diagnose starten"
            onAction={() => navigation.navigate('ChatDetail')}
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView index={index + 1} style={{ marginBottom: spacing.m }}>
            <Card>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.date}>{formatDateTime(item.updated_at)}</Text>
              <View style={styles.row}>
                <Button label="Openen" onPress={() => navigation.navigate('ChatDetail', { sessionId: item.id })} style={styles.btn} />
                <Button label="Verwijderen" variant="secondary" onPress={() => confirmDelete(item.id)} style={styles.btn} />
              </View>
            </Card>
          </FadeInView>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.l, paddingBottom: spacing.xxl },
  summaryCard: { paddingVertical: spacing.l, marginBottom: spacing.xl },
  summaryCaption: { color: colors.textMuted, fontSize: 12, marginTop: spacing.m, textAlign: 'center' },
  title: { color: colors.text, fontWeight: '700', fontSize: 15 },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.s },
  row: { flexDirection: 'row', gap: spacing.s },
  btn: { flex: 1, minHeight: 40 },
});
