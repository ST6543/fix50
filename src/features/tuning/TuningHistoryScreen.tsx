/**
 * Tuninggeschiedenis — elke wijziging met resultaat en notitie + PDF-rapport.
 * Sproeierwissels staan hier gegroepeerd, met dezelfde correctie- en
 * verwijderacties als in het sproeierlogblok van de Afstelhulp.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, EmptyState, Input, Loading } from '@/components/ui';
import {
  composeJetNotes,
  groupHistoryRows,
  isJetChangePart,
  jetGroupHasRun,
  jetUndoNotice,
  JET_RETEST_WARNING,
  measuredResultLine,
  splitJetNotes,
} from '@/lib/jet-log';
import { SlidersIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import { exportTuningPdf } from '@/services/pdf-export';
import { formatDateTime } from '@/lib/format';
import { colors, radii, spacing } from '@/theme';
import type { TuningChange } from '@/types';

type Nav = AppNav;

/** Eén regel binnen een correctie: de oorspronkelijke waarden plus zijn eigen volgende stap. */
type JetEditRow = { id: string; part: string; oldValue: string; newValue: string; nextStep: string | null };
type JetEdit = { key: string; note: string; rows: JetEditRow[] };

export default function TuningHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  const [changes, setChanges] = useState<TuningChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  // Welke wissel wordt op dit moment gecorrigeerd?
  const [jetEdit, setJetEdit] = useState<JetEdit | null>(null);
  // Welke wissel wacht op bevestiging voordat hij verwijderd wordt?
  const [jetDeleteId, setJetDeleteId] = useState<string | null>(null);
  // Welke wissel wacht op bevestiging voordat een nieuwe meting de oude vervangt?
  const [jetRetestId, setJetRetestId] = useState<string | null>(null);
  // Zojuist verwijderde wissel, klaar om terug te zetten (ongedaan maken).
  const [jetUndo, setJetUndo] = useState<TuningChange[] | null>(null);
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

  /** Zet een wissel in de corrigeerstand, met de waarden zoals ze er nu staan. */
  function startJetEdit(group: TuningChange[]) {
    const first = group[0];
    if (!first) return;
    setJetDeleteId(null);
    setJetRetestId(null);
    setJetEdit({
      key: first.id,
      note: splitJetNotes(first.notes).testNote ?? '',
      rows: group.map((c) => ({
        id: c.id,
        part: c.part,
        oldValue: c.old_value ?? '',
        newValue: c.new_value ?? '',
        nextStep: splitJetNotes(c.notes).nextStep,
      })),
    });
  }

  function editJetRow(id: string, field: 'oldValue' | 'newValue', value: string) {
    setJetEdit((prev) =>
      prev ? { ...prev, rows: prev.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)) } : prev,
    );
  }

  async function saveJetEdit() {
    if (!jetEdit) return;
    setBusy(true);
    try {
      for (const row of jetEdit.rows) {
        await tuningService.updateChange(row.id, {
          old_value: row.oldValue.trim() || null,
          new_value: row.newValue.trim() || null,
          notes: composeJetNotes(jetEdit.note, row.nextStep),
        });
      }
      setJetEdit(null);
      await reload();
      setNote('Sproeierwissel gecorrigeerd in de geschiedenis.');
    } catch {
      setNote('Correctie opslaan mislukt — controleer je verbinding.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteJetGroup(group: TuningChange[]) {
    const first = group[0];
    if (!first) return;
    setJetEdit(null);
    setJetDeleteId(first.id);
  }

  async function deleteJetGroup(group: TuningChange[]) {
    setBusy(true);
    try {
      await tuningService.deleteChanges(group.map((c) => c.id));
      if (jetEdit && group.some((c) => c.id === jetEdit.key)) setJetEdit(null);
      setJetDeleteId(null);
      // Bewaar de regels zodat een verkeerde klik terug te draaien is.
      setJetUndo(group);
      await reload();
      // De strook met "Ongedaan maken" meldt dit al; geen dubbele regel eronder.
      setNote(null);
    } catch {
      setNote('Verwijderen mislukt — controleer je verbinding.');
    } finally {
      setBusy(false);
    }
  }

  /** Zet de zojuist verwijderde wissel terug, met dezelfde id en hetzelfde tijdstip. */
  async function undoJetDelete() {
    if (!jetUndo) return;
    setBusy(true);
    try {
      await tuningService.restoreChanges(jetUndo);
      setJetUndo(null);
      await reload();
      setNote('Verwijderen ongedaan gemaakt — de wissel staat weer in de geschiedenis.');
    } catch {
      setNote('Ongedaan maken mislukt — controleer je verbinding.');
    } finally {
      setBusy(false);
    }
  }

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
            {jetUndo ? (
              <View style={styles.jetUndoBlock}>
                <Text style={styles.jetUndoText}>{jetUndoNotice(jetUndo)}</Text>
                <Pressable
                  style={styles.sugApply}
                  disabled={busy}
                  accessibilityLabel="Verwijderen ongedaan maken"
                  onPress={() => void undoJetDelete()}
                >
                  <Text style={styles.sugApplyText}>{busy ? 'Bezig…' : 'Ongedaan maken'}</Text>
                </Pressable>
              </View>
            ) : null}
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

          const group = item.rows;
          const first = group[0]!;
          const { testNote, nextStep } = splitJetNotes(first.notes);
          const edit = jetEdit && jetEdit.key === first.id ? jetEdit : null;
          return (
            <Card style={styles.card}>
              <View style={styles.partRow}>
                <Text style={styles.part}>
                  {group.length === 1 ? first.part : `Wissel · ${group.length} onderdelen`}
                </Text>
                <Badge label="sproeierwissel" tone="info" />
              </View>
              {group.map((c) => (
                <Text key={c.id} style={styles.change}>
                  {group.length > 1 ? `${c.part}: ` : null}
                  {c.old_value ?? '—'} <Text style={{ color: colors.primary }}>→</Text> {c.new_value ?? '—'}
                </Text>
              ))}
              <Text style={styles.meta}>
                {formatDateTime(first.changed_at)}
                {first.km_at_change !== null ? ` · ${first.km_at_change.toLocaleString('nl-NL')} km` : ''}
              </Text>
              {first.result ? <Text style={styles.result}>{`Mengsel: ${first.result}`}</Text> : null}
              {first.run ? <Text style={styles.measured}>{measuredResultLine(first.run)}</Text> : null}
              {testNote ? <Text style={styles.notes}>{testNote}</Text> : null}
              {nextStep ? <Text style={styles.nextStep}>{`Volgende stap: ${nextStep}`}</Text> : null}

              {edit ? (
                <View style={styles.jetEditBlock}>
                  {edit.rows.map((row) => (
                    <View key={row.id} style={styles.jetEditRow}>
                      <Text style={styles.jetEditPart}>{row.part}</Text>
                      <Input
                        label="Oude waarde"
                        value={row.oldValue}
                        onChangeText={(t) => editJetRow(row.id, 'oldValue', t)}
                      />
                      <Input
                        label="Nieuwe waarde"
                        value={row.newValue}
                        onChangeText={(t) => editJetRow(row.id, 'newValue', t)}
                      />
                    </View>
                  ))}
                  <Input
                    label="Testresultaat"
                    value={edit.note}
                    onChangeText={(t) => setJetEdit((prev) => (prev ? { ...prev, note: t } : prev))}
                    placeholder="Wat deed hij op de testrit?"
                    multiline
                    style={styles.jetEditNote}
                  />
                  <Text style={styles.editHint}>
                    Alleen de logregel wordt aangepast; de volgende stap en een gekoppelde GPS-meting blijven staan.
                  </Text>
                  <View style={styles.jetLogActions}>
                    <Pressable style={styles.sugApply} disabled={busy} onPress={() => void saveJetEdit()}>
                      <Text style={styles.sugApplyText}>{busy ? 'Opslaan…' : 'Correctie opslaan'}</Text>
                    </Pressable>
                    <Pressable style={styles.sugApply} onPress={() => setJetEdit(null)}>
                      <Text style={styles.sugApplyText}>Annuleren</Text>
                    </Pressable>
                  </View>
                </View>
              ) : jetDeleteId === first.id ? (
                <View style={styles.jetDeleteBlock}>
                  <Text style={styles.jetDeleteWarn}>
                    {`Deze wissel${group.length > 1 ? ` (${group.length} regels)` : ''} verdwijnt uit de tuninggeschiedenis.`}
                  </Text>
                  <View style={styles.jetLogActions}>
                    <Pressable
                      style={[styles.sugApply, styles.jetLogDelete]}
                      disabled={busy}
                      onPress={() => void deleteJetGroup(group)}
                    >
                      <Text style={[styles.sugApplyText, styles.jetLogDeleteText]}>
                        {busy ? 'Verwijderen…' : 'Ja, verwijderen'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.sugApply} onPress={() => setJetDeleteId(null)}>
                      <Text style={styles.sugApplyText}>Annuleren</Text>
                    </Pressable>
                  </View>
                </View>
              ) : jetRetestId === first.id ? (
                <View style={styles.jetDeleteBlock}>
                  <Text style={styles.jetDeleteWarn}>{JET_RETEST_WARNING}</Text>
                  <View style={styles.jetLogActions}>
                    <Pressable
                      style={styles.sugApply}
                      accessibilityLabel="Bestaande meting vervangen"
                      onPress={() => {
                        setJetRetestId(null);
                        navigation.navigate('PerformanceRun', { jetChangeKey: first.id });
                      }}
                    >
                      <Text style={styles.sugApplyText}>Ja, opnieuw testen</Text>
                    </Pressable>
                    <Pressable style={styles.sugApply} onPress={() => setJetRetestId(null)}>
                      <Text style={styles.sugApplyText}>Annuleren</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.jetLogActions}>
                  <Pressable
                    style={styles.sugApply}
                    accessibilityLabel="GPS-test voor deze sproeierwissel"
                    onPress={() =>
                      jetGroupHasRun(group)
                        ? setJetRetestId(first.id)
                        : navigation.navigate('PerformanceRun', { jetChangeKey: first.id })
                    }
                  >
                    <Text style={styles.sugApplyText}>
                      {jetGroupHasRun(group) ? 'Opnieuw testen' : 'Test deze wissel'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.sugApply}
                    accessibilityLabel="Sproeierwissel corrigeren"
                    onPress={() => startJetEdit(group)}
                  >
                    <Text style={styles.sugApplyText}>Corrigeren</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.sugApply, styles.jetLogDelete]}
                    accessibilityLabel="Sproeierwissel verwijderen"
                    onPress={() => confirmDeleteJetGroup(group)}
                  >
                    <Text style={[styles.sugApplyText, styles.jetLogDeleteText]}>Verwijderen</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          );
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
  measured: { color: colors.success, fontSize: 13, lineHeight: 18, marginTop: 3, fontWeight: '700' },
  nextStep: { color: colors.primary, fontSize: 13, lineHeight: 18, marginTop: 4, fontWeight: '600' },
  note: { color: colors.text, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.m },
  jetUndoBlock: {
    marginBottom: spacing.m,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.s,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    padding: spacing.s,
    gap: spacing.xs,
  },
  jetUndoText: { color: colors.text, fontSize: 12.5, lineHeight: 18 },
  sugApply: {
    alignSelf: 'flex-start',
    marginTop: spacing.s,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  sugApplyText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  jetLogActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s, flexWrap: 'wrap' },
  jetEditBlock: {
    marginTop: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.s,
  },
  jetEditRow: { marginTop: spacing.s },
  jetEditPart: { color: colors.text, fontSize: 13.5, fontWeight: '800', marginBottom: 2 },
  jetEditNote: { minHeight: 64, textAlignVertical: 'top' },
  editHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.xs },
  jetLogDelete: { borderColor: 'rgba(239,68,68,0.45)', backgroundColor: 'rgba(239,68,68,0.10)' },
  jetLogDeleteText: { color: colors.danger },
  jetDeleteBlock: { marginTop: spacing.s, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.s },
  jetDeleteWarn: { color: colors.warning, fontSize: 12, lineHeight: 17 },
});
