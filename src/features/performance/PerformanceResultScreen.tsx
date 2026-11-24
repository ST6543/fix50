/** Resultaatpagina na een meting. */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, EmptyState, Loading, SectionTitle } from '@/components/ui';
import { SpeedChart } from '@/components/charts';
import { CountUp, FadeInView } from '@/components/motion';
import { FlagIcon } from '@/components/icons';
import * as perfService from '@/services/performance';
import * as tuningService from '@/services/tuning';
import { jetRunLinkLine, runDeleteNotice } from '@/lib/jet-log';
import { useScooters } from '@/hooks/useScooters';
import { formatDateTime, formatDistance, formatSeconds, formatSpeed } from '@/lib/format';
import { colors, spacing, typography } from '@/theme';
import type { PerformanceRun, TuningChange } from '@/types';

type RouteParams = { PerformanceResult: { runId: string; linkIssue?: 'niet-gevonden' | 'opslaan-mislukt' } };

export default function PerformanceResultScreen() {
  const route = useRoute<RouteProp<RouteParams, 'PerformanceResult'>>();
  const navigation = useNavigation<AppNav>();
  const { activeScooter } = useScooters();
  const [run, setRun] = useState<PerformanceRun | null>(null);
  // De sproeierwissel waar deze meting bij hoort (leeg = geen koppeling).
  const [linked, setLinked] = useState<TuningChange[]>([]);
  const [loading, setLoading] = useState(true);
  // Verwijderen vraagt eerst bevestiging: de koppeling verdwijnt mee.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      perfService
        .listRuns(100, activeScooter?.id)
        .then((runs) => setRun(runs.find((r) => r.id === route.params.runId) ?? null))
        .catch(() => setRun(null))
        .finally(() => setLoading(false));
      tuningService
        .listRunJetChanges(route.params.runId)
        .then(setLinked)
        .catch(() => setLinked([]));
    }, [route.params.runId, activeScooter]),
  );

  /** Verwijdert de meting en gaat terug; de wissel wacht daarna weer op een meting. */
  async function handleDelete() {
    if (!run) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await perfService.deleteRun(run.id);
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('Main');
    } catch {
      setDeleteError('Verwijderen mislukt — controleer je verbinding en probeer het opnieuw.');
      setDeleting(false);
    }
  }

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

        <Card style={styles.linkCard}>
          <Text style={styles.linkLabel}>DEZE METING HOORT BIJ</Text>
          <Text style={styles.linkValue}>{jetRunLinkLine(linked)}</Text>
          {linked[0] ? <Text style={styles.linkMeta}>{formatDateTime(linked[0].changed_at)}</Text> : null}
        </Card>

        {route.params.linkIssue ? (
          <Card style={styles.linkWarnCard}>
            <Text style={styles.linkWarnLabel}>KOPPELING MISLUKT</Text>
            <Text style={styles.linkWarnText}>
              {route.params.linkIssue === 'niet-gevonden'
                ? 'De gekozen sproeierwissel bestaat niet meer. De meting is opgeslagen zonder koppeling.'
                : 'De meting is opgeslagen, maar het koppelen aan de sproeierwissel mislukte. Probeer het later opnieuw.'}
            </Text>
          </Card>
        ) : null}

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

        {confirmDelete ? (
          <Card style={styles.deleteBlock}>
            <Text style={styles.deleteWarn}>{runDeleteNotice(linked.length > 0)}</Text>
            {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
            <View style={styles.deleteActions}>
              <Button
                label="Ja, verwijderen"
                variant="danger"
                loading={deleting}
                onPress={() => void handleDelete()}
                style={styles.deleteBtn}
              />
              <Button
                label="Annuleren"
                variant="secondary"
                disabled={deleting}
                onPress={() => {
                  setConfirmDelete(false);
                  setDeleteError(null);
                }}
                style={styles.deleteBtn}
              />
            </View>
          </Card>
        ) : (
          <Button label="Verwijderen" variant="ghost" onPress={() => setConfirmDelete(true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  date: { color: colors.textMuted, marginBottom: spacing.xs },
  badgeRow: { flexDirection: 'row', marginBottom: spacing.l },
  linkCard: { marginBottom: spacing.m },
  linkLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  linkValue: { color: colors.text, fontSize: 14.5, fontWeight: '700', lineHeight: 20, marginTop: 4 },
  linkMeta: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  linkWarnCard: { marginBottom: spacing.m, borderColor: colors.warning },
  linkWarnLabel: { color: colors.warning, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  linkWarnText: { color: colors.text, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  hero: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.m },
  heroLabel: { color: colors.textMuted, fontSize: 15 },
  heroValue: { ...typography.metric, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m },
  cell: { width: '47.5%', alignItems: 'center' },
  label: { color: colors.textMuted, fontSize: 13 },
  value: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  hint: { color: colors.textMuted, textAlign: 'center' },
  notes: { color: colors.textMuted, marginTop: spacing.m, lineHeight: 19 },
  deleteBlock: { marginTop: spacing.m, borderColor: colors.danger },
  deleteWarn: { color: colors.warning, fontSize: 13, lineHeight: 19 },
  deleteError: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  deleteActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  deleteBtn: { flex: 1 },
});
