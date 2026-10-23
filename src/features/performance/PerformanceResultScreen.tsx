/** Resultaatpagina na een meting. */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';

import { Badge, Button, Card, EmptyState, Loading, SectionTitle } from '@/components/ui';
import { SpeedChart } from '@/components/charts';
import { CountUp, FadeInView } from '@/components/motion';
import { FlagIcon } from '@/components/icons';
import * as perfService from '@/services/performance';
import { useScooters } from '@/hooks/useScooters';
import { formatDateTime, formatDistance, formatSeconds, formatSpeed } from '@/lib/format';
import { colors, spacing, typography } from '@/theme';
import type { PerformanceRun } from '@/types';

type RouteParams = { PerformanceResult: { runId: string } };

export default function PerformanceResultScreen() {
  const route = useRoute<RouteProp<RouteParams, 'PerformanceResult'>>();
  const { activeScooter } = useScooters();
  const [run, setRun] = useState<PerformanceRun | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      perfService
        .listRuns(100, activeScooter?.id)
        .then((runs) => setRun(runs.find((r) => r.id === route.params.runId) ?? null))
        .catch(() => setRun(null))
        .finally(() => setLoading(false));
    }, [route.params.runId, activeScooter]),
  );

  if (loading) return <Loading label="Resultaat laden…" />;
  if (!run) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState icon={FlagIcon} title="Meting niet gevonden" />
      </SafeAreaView>
    );
  }

  const qualityTone = run.gps_quality === 'goed' ? 'success' : run.gps_quality === 'matig' ? 'warning' : 'danger';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.date}>{formatDateTime(run.started_at)}</Text>
        <View style={styles.badgeRow}>
          <Badge
            label={`GPS: ${run.gps_quality}`}
            tone={qualityTone}
          />
        </View>

        <FadeInView>
          <Card style={styles.hero}>
            <Text style={styles.heroLabel}>0–50 km/h</Text>
            {run.t0_50_s != null && !Number.isNaN(run.t0_50_s) ? (
              <CountUp value={run.t0_50_s} decimals={2} suffix=" s" style={styles.heroValue} />
            ) : (
              <Text style={styles.heroValue}>{formatSeconds(run.t0_50_s, 2)}</Text>
            )}
          </Card>
        </FadeInView>

        <View style={styles.grid}>
          <Card style={styles.cell}>
            <Text style={styles.label}>0–80 km/h</Text>
            <Text style={styles.value}>{formatSeconds(run.t0_80_s, 2)}</Text>
          </Card>
          <Card style={styles.cell}>
            <Text style={styles.label}>50–80 km/h</Text>
            <Text style={styles.value}>{formatSeconds(run.t50_80_s, 2)}</Text>
          </Card>
          <Card style={styles.cell}>
            <Text style={styles.label}>Topsnelheid</Text>
            <Text style={styles.value}>{formatSpeed(run.max_speed_kmh)}</Text>
          </Card>
          <Card style={styles.cell}>
            <Text style={styles.label}>Gemiddeld</Text>
            <Text style={styles.value}>{formatSpeed(run.avg_speed_kmh)}</Text>
          </Card>
          <Card style={styles.cell}>
            <Text style={styles.label}>Afstand</Text>
            <Text style={styles.value}>{formatDistance(run.distance_m)}</Text>
          </Card>
          <Card style={styles.cell}>
            <Text style={styles.label}>Duur</Text>
            <Text style={styles.value}>{formatSeconds(run.duration_s, 1)}</Text>
          </Card>
        </View>

        <SectionTitle>Snelheidsverloop</SectionTitle>
        <Card>
          {run.points?.length > 4 ? <SpeedChart points={run.points} /> : <Text style={styles.hint}>Te weinig punten voor een grafiek.</Text>}
        </Card>

        {run.notes ? <Text style={styles.notes}>{run.notes}</Text> : null}

        <Button
          label="Verwijderen"
          variant="ghost"
          onPress={async () => {
            await perfService.deleteRun(run.id).catch(() => undefined);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  date: { color: colors.textMuted, marginBottom: spacing.xs },
  badgeRow: { flexDirection: 'row', marginBottom: spacing.l },
  hero: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.m },
  heroLabel: { color: colors.textMuted, fontSize: 15 },
  heroValue: { ...typography.metric, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m },
  cell: { width: '47.5%', alignItems: 'center' },
  label: { color: colors.textMuted, fontSize: 13 },
  value: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  hint: { color: colors.textMuted, textAlign: 'center' },
  notes: { color: colors.textMuted, marginTop: spacing.m, lineHeight: 19 },
});
