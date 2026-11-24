/**
 * Tuninggeschiedenis — elke wijziging met resultaat en notitie + PDF-rapport.
 * Sproeierwissels gebruiken dezelfde kaart en acties als het logblok in de
 * Afstelhulp (zie JetChangeCard), zodat de koppel-flow op één plek zit.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Button, Card, EmptyState, Loading } from '@/components/ui';
import { groupHistoryRows, isJetChangePart, splitJetNotes } from '@/lib/jet-log';
import { JetChangeCard, JetUndoStrip, useJetChangeActions } from './JetChangeCard';
import { SlidersIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import { exportTuningPdf } from '@/services/pdf-export';
import { formatDateTime } from '@/lib/format';
import { colors, spacing } from '@/theme';
import type { TuningChange } from '@/types';

type Nav = AppNav;

export default function TuningHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  const [changes, setChanges] = useState<TuningChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function handlePdf() {
    if (!activeScooter) return;
    setPdfBusy(true);
    try {
      await exportTuningPdf(activeScooter);
    } catch (err) {
      console.error('[pdf] Tuningrapport mislukt', err);
      Alert.alert(
        'PDF mislukt',
        err instanceof Error && err.message
          ? err.message
          : 'Kon het tuningrapport niet maken. Probeer het opnieuw.',
      );
    } finally {
      setPdfBusy(false);
    }
  }

  /** Laat de geschiedenis opnieuw zien na een correctie of verwijdering. */
  async function reload() {
    if (!activeScooter) return;
    const rows = await tuningService.listChanges(activeScooter.id);
    setChanges(rows);
  }

  useFocusEffect(
    useCallback(() => {
      if (!activeScooter) {
        setLoading(false);
        return;
      }
      tuningService
        .listChanges(activeScooter.id)
        .then(setChanges)
        .catch(() => setChanges([]))
        .finally(() => setLoading(false));
    }, [activeScooter]),
  );

  const jetCount = changes.filter((c) => isJetChangePart(c.part)).length;
  const rows = useMemo(() => groupHistoryRows(changes), [changes]);

  const jetActions = useJetChangeActions({
    busy,
    setBusy,
    reload,
    onStartTest: (group) => {
      const key = group[0]?.id;
      if (key) navigation.navigate('PerformanceRun', { jetChangeKey: key });
    },
    setNote,
    messages: {
      edited: 'Sproeierwissel gecorrigeerd in de geschiedenis.',
      undone: 'Verwijderen ongedaan gemaakt — de wissel staat weer in de geschiedenis.',
    },
  });

  if (loading) return <Loading label="Tuninggeschiedenis laden…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={(entry) => (entry.kind === 'jet' ? `jet-${entry.rows[0]?.id ?? ''}` : entry.row.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.m }}>
            {jetCount > 0 ? (
              <Text style={styles.jetSummary}>
                {`${jetCount} sproeierwissel${jetCount === 1 ? '' : 's'} gelogd vanuit de simulator — met mengselresultaat per gasstand, de gekoppelde GPS-meting (top en 0–50) en de volgende stap.`}
              </Text>
            ) : null}
            <JetUndoStrip actions={jetActions} />
            {note ? <Text style={styles.note}>{note}</Text> : null}
            <Button
              label="Setup-rapport als PDF"
              variant="secondary"
              icon={<SlidersIcon size={16} color={colors.text} />}
              onPress={handlePdf}
              loading={pdfBusy}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={SlidersIcon}
            title="Nog geen tuningwijzigingen"
            subtitle='Log elke aanpassing, bijv. "Hoofdsproeier 92 → 90".'
            actionLabel="Wijziging toevoegen"
            onAction={() => navigation.navigate('SetupDetail', {})}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'single') {
            const change = item.row;
            const { testNote, nextStep } = splitJetNotes(change.notes);
            return (
              <Card style={styles.card}>
                <View style={styles.partRow}>
                  <Text style={styles.part}>{change.part}</Text>
                </View>
                {change.old_value || change.new_value ? (
                  <Text style={styles.change}>
                    {change.old_value ?? '—'} <Text style={{ color: colors.primary }}>→</Text>{' '}
                    {change.new_value ?? '—'}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  {formatDateTime(change.changed_at)}
                  {change.km_at_change !== null ? ` · ${change.km_at_change.toLocaleString('nl-NL')} km` : ''}
                </Text>
                {change.result ? <Text style={styles.result}>{`Resultaat: ${change.result}`}</Text> : null}
                {testNote ? <Text style={styles.notes}>{testNote}</Text> : null}
                {nextStep ? <Text style={styles.nextStep}>{`Volgende stap: ${nextStep}`}</Text> : null}
              </Card>
            );
          }

          return <JetChangeCard group={item.rows} actions={jetActions} variant="history" />;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.l },
  card: { marginBottom: spacing.m },
  part: { color: colors.text, fontWeight: '700', fontSize: 16 },
  partRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.s },
  jetSummary: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.m },
  change: { color: colors.text, fontSize: 15, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
  result: { color: colors.success, fontSize: 13.5, marginTop: spacing.xs },
  notes: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  nextStep: { color: colors.primary, fontSize: 13, lineHeight: 18, marginTop: 4, fontWeight: '600' },
  note: { color: colors.text, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.m },
});
