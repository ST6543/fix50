/** Tuninggeschiedenis — elke wijziging met resultaat en notitie + PDF-rapport. */
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Button, Card, EmptyState, Loading } from '@/components/ui';
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

  if (loading) return <Loading label="Tuninggeschiedenis laden…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={changes}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.m }}>
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
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.part}>{item.part}</Text>
            {item.old_value || item.new_value ? (
              <Text style={styles.change}>
                {item.old_value ?? '—'} <Text style={{ color: colors.primary }}>→</Text> {item.new_value ?? '—'}
              </Text>
            ) : null}
            <Text style={styles.meta}>
              {formatDateTime(item.changed_at)}
              {item.km_at_change !== null ? ` · ${item.km_at_change.toLocaleString('nl-NL')} km` : ''}
            </Text>
            {item.result ? <Text style={styles.result}>Resultaat: {item.result}</Text> : null}
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
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
  part: { color: colors.text, fontWeight: '700', fontSize: 16 },
  change: { color: colors.text, fontSize: 15, marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
  result: { color: colors.success, fontSize: 13.5, marginTop: spacing.xs },
  notes: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
