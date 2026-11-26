/** Onderhoudsgeschiedenis — alles wat is geregistreerd, met totaalkosten en delen. */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Loading,
  SegmentSwitch,
} from '@/components/ui';
import { ClipboardIcon, SendIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import { useMaintenanceData } from '@/hooks/useAppData';
import { listRecords } from '@/services/maintenance';
import { listInvoices } from '@/services/invoices';
import {
  exportInvoicePdf,
  exportMaintenancePdf,
  exportStoredInvoicePdf,
} from '@/services/pdf-export';
import {
  invoiceSelectionLabel,
  invoiceSnapshotTotal,
  type InvoiceRegisterEntry,
} from '@/lib/invoice-snapshot';
import { shareMaintenanceLog } from '@/lib/export';
import {
  defaultPeriod,
  isoDateToInput,
  parseDateInput,
  selectRecordsForInvoice,
  type InvoiceSelection,
} from '@/lib/invoice-selection';
import { formatDate, formatDateTime, formatKm } from '@/lib/format';
import { colors, fonts, radii, spacing, typography } from '@/theme';
import type { MaintenanceRecord } from '@/types';

/** Formateer centen als €12,50. */
function euros(cents: number): string {
  return `€${(cents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type InvoiceMode = 'period' | 'record';

export default function MaintenanceHistoryScreen() {
  const { activeScooter } = useScooters();
  const { items } = useMaintenanceData();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  /** Eerder uitgegeven facturen: nummer + bevroren snapshot. */
  const [invoices, setInvoices] = useState<InvoiceRegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  // Factuurkeuze: periode (standaard deze maand) of één losse beurt.
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>('period');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!activeScooter) {
        setLoading(false);
        return;
      }
      Promise.all([
        listRecords(activeScooter.id, 200).catch(() => [] as MaintenanceRecord[]),
        // Register is optioneel zolang de migratie nog niet is toegepast.
        listInvoices(activeScooter.id, 25).catch(() => [] as InvoiceRegisterEntry[]),
      ])
        .then(([nextRecords, nextInvoices]) => {
          setRecords(nextRecords);
          setInvoices(nextInvoices);
        })
        .finally(() => setLoading(false));
    }, [activeScooter]),
  );

  /** Naam van een registratie: eigen omschrijving, anders de onderdeelnaam. */
  const nameOf = useCallback(
    (r: MaintenanceRecord) =>
      r.custom_name ?? items.find((i) => i.id === r.item_id)?.name ?? 'Onderhoud',
    [items],
  );

  /** Voorbeeld van de selectie: zo zie je vóór het maken hoeveel beurten meegaan. */
  const invoicePreview = useMemo(() => {
    if (!invoiceOpen) return [];
    if (invoiceMode === 'record') {
      return selectedRecordId
        ? selectRecordsForInvoice(records, { kind: 'record', recordId: selectedRecordId })
        : [];
    }
    const fromIso = parseDateInput(fromText);
    const toIso = parseDateInput(toText);
    if (!fromIso || !toIso || fromIso > toIso) return [];
    return selectRecordsForInvoice(records, { kind: 'period', fromIso, toIso });
  }, [invoiceOpen, invoiceMode, selectedRecordId, records, fromText, toText]);

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

  /** Open de picker met deze maand als voorstel — nooit stilletjes alles. */
  function openInvoicePicker() {
    const range = defaultPeriod(new Date());
    setFromText(isoDateToInput(range.fromIso));
    setToText(isoDateToInput(range.toIso));
    setInvoiceMode('period');
    setSelectedRecordId(records[0]?.id ?? null);
    setInvoiceOpen(true);
  }

  async function handleInvoice() {
    if (!activeScooter) return;

    let selection: InvoiceSelection;
    if (invoiceMode === 'period') {
      const fromIso = parseDateInput(fromText);
      const toIso = parseDateInput(toText);
      if (!fromIso || !toIso) {
        Alert.alert('Datum klopt niet', 'Gebruik DD-MM-JJJJ, bijvoorbeeld 01-11-2026.');
        return;
      }
      if (fromIso > toIso) {
        Alert.alert('Periode klopt niet', 'De startdatum ligt na de einddatum.');
        return;
      }
      selection = { kind: 'period', fromIso, toIso };
    } else {
      if (!selectedRecordId) {
        Alert.alert('Kies een beurt', 'Selecteer eerst een onderhoudsbeurt.');
        return;
      }
      selection = { kind: 'record', recordId: selectedRecordId };
    }

    setInvoiceBusy(true);
    try {
      await exportInvoicePdf(activeScooter, selection);
      setInvoiceOpen(false);
      // Net uitgegeven factuur meteen in het register tonen.
      listInvoices(activeScooter.id, 25)
        .then(setInvoices)
        .catch(() => undefined);
    } catch (err) {
      console.error('[pdf] Factuur mislukt', err);
      Alert.alert(
        'Factuur mislukt',
        err instanceof Error && err.message
          ? err.message
          : 'Kon de factuur niet maken. Probeer het opnieuw.',
      );
    } finally {
      setInvoiceBusy(false);
    }
  }

  /** Eerder gedeelde factuur opnieuw delen — uit het opgeslagen snapshot. */
  async function handleReprint(entry: InvoiceRegisterEntry) {
    setReprintingId(entry.id);
    try {
      await exportStoredInvoicePdf(entry);
    } catch (err) {
      console.error('[pdf] Factuur opnieuw delen mislukt', err);
      Alert.alert(
        'Opnieuw delen mislukt',
        err instanceof Error && err.message
          ? err.message
          : 'Kon de factuur niet opnieuw maken. Probeer het opnieuw.',
      );
    } finally {
      setReprintingId(null);
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
                  label="Factuur (PDF)"
                  variant="secondary"
                  icon={<ClipboardIcon size={16} color={colors.text} />}
                  onPress={openInvoicePicker}
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
            {invoices.length > 0 ? (
              <View style={styles.invoiceBlock}>
                <Text style={typography.eyebrow}>Facturen</Text>
                {invoices.map((entry) => (
                  <View key={entry.id} style={styles.invoiceRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invoiceNo}>{entry.invoice_number}</Text>
                      <Text style={styles.invoiceMeta} numberOfLines={2}>
                        {formatDate(entry.issued_at)} · {euros(invoiceSnapshotTotal(entry.snapshot))} ·{' '}
                        {invoiceSelectionLabel(entry.selection)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Factuur ${entry.invoice_number} opnieuw delen`}
                      disabled={reprintingId !== null}
                      onPress={() => void handleReprint(entry)}
                      style={({ pressed }) => [styles.reprintBtn, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.reprintLabel}>
                        {reprintingId === entry.id ? 'Bezig…' : 'Opnieuw'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
                <Text style={styles.invoiceHint}>
                  Elke factuur bewaart zijn eigen regels en bedragen; opnieuw delen geeft
                  hetzelfde document.
                </Text>
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

      <Modal
        visible={invoiceOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInvoiceOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Factuur maken</Text>
            <Text style={styles.modalSub}>
              Kies een periode of één losse onderhoudsbeurt. Alleen die beurten komen op de
              factuur.
            </Text>

            <SegmentSwitch
              segments={[
                { key: 'period' as const, label: 'Periode' },
                { key: 'record' as const, label: 'Eén beurt' },
              ]}
              value={invoiceMode}
              onChange={setInvoiceMode}
              style={{ marginTop: spacing.m }}
            />

            {invoiceMode === 'period' ? (
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Van"
                    value={fromText}
                    onChangeText={setFromText}
                    placeholder="DD-MM-JJJJ"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Tot en met"
                    value={toText}
                    onChangeText={setToText}
                    placeholder="DD-MM-JJJJ"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                  />
                </View>
              </View>
            ) : (
              <ScrollView style={styles.pickList} showsVerticalScrollIndicator={false}>
                {records.map((record) => {
                  const selected = record.id === selectedRecordId;
                  return (
                    <Pressable
                      key={record.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Kies ${nameOf(record)} van ${formatDate(record.done_at)}`}
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedRecordId(record.id)}
                      style={[styles.pickRow, selected && styles.pickRowActive]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickName}>{nameOf(record)}</Text>
                        <Text style={styles.pickMeta}>
                          {formatDate(record.done_at)}
                          {record.cost_cents !== null
                            ? ` · ${euros(record.cost_cents)}`
                            : ' · geen bedrag'}
                        </Text>
                      </View>
                      {selected ? <Badge label="Gekozen" tone="success" /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Text
              style={[
                styles.pickCount,
                invoicePreview.length === 0 && { color: colors.warning },
              ]}
            >
              {invoicePreview.length === 0
                ? 'Geen beurten in deze selectie.'
                : `${invoicePreview.length} ${invoicePreview.length === 1 ? 'beurt' : 'beurten'} op de factuur.`}
            </Text>

            <View style={styles.modalActions}>
              <Button
                label="Annuleren"
                variant="ghost"
                onPress={() => setInvoiceOpen(false)}
                disabled={invoiceBusy}
                style={{ flex: 1 }}
              />
              <Button
                label="Factuur genereren"
                onPress={handleInvoice}
                loading={invoiceBusy}
                style={{ flex: 1 }}
              />
            </View>
            <Text style={styles.modalHint}>
              Standaard staat deze maand klaar. Kies "Eén beurt" voor een losse registratie.
            </Text>
          </View>
        </View>
      </Modal>
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
  invoiceBlock: {
    marginTop: spacing.m,
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: spacing.s,
  },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 44 },
  invoiceNo: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  invoiceMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  reprintBtn: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.m,
    paddingVertical: 6,
  },
  reprintLabel: { color: colors.primary, fontFamily: fonts.display, fontSize: 12, fontWeight: '600' },
  invoiceHint: {
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  shareBtn: { marginTop: spacing.m },
  card: { marginBottom: spacing.m },
  name: { color: colors.text, fontWeight: '700', flexShrink: 1, marginRight: spacing.s },
  date: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  parts: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 13 },
  notes: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.l,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    maxHeight: '85%',
  },
  modalTitle: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  modalSub: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  dateRow: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.m },
  pickList: { marginTop: spacing.m, maxHeight: 260 },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    borderRadius: radii.m,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.s,
  },
  pickRowActive: { borderColor: colors.primaryBorder, backgroundColor: colors.primarySubtle },
  pickName: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14.5, fontWeight: '600' },
  pickMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  pickCount: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    marginTop: spacing.m,
  },
  modalActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  modalHint: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11.5, marginTop: spacing.m, lineHeight: 16 },
});
