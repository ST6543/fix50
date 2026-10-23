/** Metingsgeschiedenis — alle runs met GPS-kwaliteit. */
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Card, EmptyState, Loading } from '@/components/ui';
import { FlagIcon } from '@/components/icons';
import * as perfService from '@/services/performance';
import { useScooters } from '@/hooks/useScooters';
import { formatDateTime, formatSeconds, formatSpeed } from '@/lib/format';
import { colors, spacing } from '@/theme';
import type { PerformanceRun } from '@/types';

type Nav = AppNav;

export default function PerformanceHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  const [runs, setRuns] = useState<PerformanceRun[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      // Alleen metingen van de actieve scooter.
      perfService
        .listRuns(100, activeScooter?.id)
        .then(setRuns)
        .catch(() => setRuns([]))
        .finally(() => setLoading(false));
    }, [activeScooter]),
  );

  if (loading) return <Loading label="Metingen laden…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={runs}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon={FlagIcon} title="Nog geen metingen" subtitle="Start je eerste meting vanaf de Performance tab." />
        }
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => navigation.navigate('PerformanceResult', { runId: item.id })}
          >
            <View style={styles.row}>
              <Text style={styles.main}>
                0–50: {formatSeconds(item.t0_50_s, 1)} · Top: {formatSpeed(item.max_speed_kmh)}
              </Text>
              <Badge
                label={item.gps_quality}
                tone={item.gps_quality === 'goed' ? 'success' : item.gps_quality === 'matig' ? 'warning' : 'danger'}
              />
            </View>
            <Text style={styles.meta}>{formatDateTime(item.started_at)}</Text>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.l },
  card: { marginBottom: spacing.m },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  main: { color: colors.text, fontWeight: '700', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
});
