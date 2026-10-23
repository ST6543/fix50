/** Onderhoudsgeschiedenis — alles wat is geregistreerd, met totaalkosten en delen. */
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Badge, Button, Card, EmptyState, Loading } from '@/components/ui';
import { ClipboardIcon, SendIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import { listMaintenanceItems, listRecords } from '@/services/maintenance';
import { exportMaintenancePdf } from '@/services/pdf-export';
import { buildMaintenanceSummary, shareMaintenanceLog } from '@/lib/export';
import { formatDateTime, formatKm } from '@/lib/format';
import { colors, fonts, spacing, typography } from '@/theme';
import type { MaintenanceItem, MaintenanceRecord } from '@/types';

/** Formateer centen als €12,50. */
function euros(cents: number): string {
  return `€${(cents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MaintenanceHistoryScreen() {
  const { activeScooter } = useScooters();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!activeScooter) {
        setLoading(false);
        return;
      }
      listRecords(activeScooter.id, 200)
        .then(setRecords)
        .catch(() => setRecords([]))
        .finally(() => setLoading(false));
      listMaintenanceItems()
        .then(setItems)
        .catch(() => setItems([]));
    }, [activeScooter]),
  );

  /** Naam van een registratie: eigen omschrijving, anders de onderdeelnaam. */
  const nameOf = useCallback(
    (r: MaintenanceRecord) =>
      r.custom_name ?? items.find((i) => i.id === r.item_id)?.name ?? 'Onderhoud',
    [items],
  );

  if (loading) return <Loading label="Geschiedenis laden…" />;

  const totalCents = records.reduce((sum, r) => sum + (r.cost_cents ?? 0), 0);
  const withCost = records.filter((r) => r.cost_cents !== null).length;

  async function handleShare() {
    if (!activeScooter) return;
    setSharing(true);
    try {
      await shareMaintenanceLog(records, activeScooter.name, nameOf);
    } catch {
      Alert.alert('Delen mislukt', 'Kon het logboek niet delen. Probeer het opnieuw.');
    } finally {
      setSharing(false);
    }
  }

  async function handlePdf() {
    if (!activeScooter) return;
    setPdfBusy(true);
    try {
      await exportMaintenancePdf(activeScooter);
    } catch (err) {
      console.error('[pdf] Onderhoudspaspoort mislukt', err);
      Alert.alert(
        'PDF mislukt',
        err instanceof Error && err.message
          ? err.message
          : 'Kon het onderhoudspaspoort niet maken. Probeer het opnieuw.',
      );
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Card style={styles.summary}>
            <View style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>TOTAAL GEGISTREERD</Text>
                <Text style={styles.summaryValue}>
                  {records.length} beurt{records.length === 1 ? '' : 'en'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>TOTAALKOSTEN</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  {euros(totalCents)}
                </Text>
                {withCost > 0 ? (
                  <Text style={styles.summarySub}>van {withCost} beurten met kosten</Text>
                ) : null}
              </View>
            </View>
            {records.length > 0 ? (
              <View style={{ gap: spacing.s, marginTop: spacing.m }}>
                <Button
                  label="PDF-boekje downloaden"
                  icon={<ClipboardIcon size={16} color={colors.background} />}
                  onPress={handlePdf}
                  loading={pdfBusy}
                />
                <Button
                  label="Logboek delen (CSV)"
                  variant="secondary"
                  icon={<SendIcon size={16} color={colors.text} />}
                  onPress={handleShare}
                  loading={sharing}
                />
              </View>
            ) : null}
          </Card>
        }
        ListEmptyComponent={
          <EmptyState
            icon={ClipboardIcon}
            title="Nog geen onderhoud geregistreerd"
            subtitle="Alles wat je doet, komt hier in de historie — handig bij verkoop."
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.s }}>
              <Text style={styles.name}>{nameOf(item)}</Text>
              {item.cost_cents !== null ? <Badge label={euros(item.cost_cents)} tone="info" /> : null}
              {item.km_at_service !== null ? <Badge label={formatKm(item.km_at_service)} /> : null}
            </View>
            <Text style={styles.date}>{formatDateTime(item.done_at)}</Text>
            {item.parts ? <Text style={styles.parts}>Onderdelen: {item.parts}</Text> : null}
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.l, paddingBottom: spacing.xxl },
  summary: { marginBottom: spacing.m },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { ...typography.eyebrow },
  summaryValue: { fontFamily: fonts.displayBold, fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 2 },
  summarySub: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  shareBtn: { marginTop: spacing.m },
  card: { marginBottom: spacing.m },
  name: { color: colors.text, fontWeight: '700', flexShrink: 1, marginRight: spacing.s },
  date: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  parts: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 13 },
  notes: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 13 },
});
