/**
 * Sproeierwissel-kaart — één component voor het sproeierlogblok in de
 * Afstelhulp én de tuninggeschiedenis. De kaart toont de wissel, het
 * mengselresultaat en de gekoppelde GPS-meting, en regelt de acties
 * (corrigeren, verwijderen, opnieuw testen en ongedaan maken). Zo staat de
 * koppel-flow met de GPS-meter op één plek in plaats van in twee schermen.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Input } from '@/components/ui';
import {
  composeJetNotes,
  jetGroupHasRun,
  jetUndoNotice,
  JET_RETEST_WARNING,
  measuredResultLine,
  splitJetNotes,
  visibleTestNote,
} from '@/lib/jet-log';
import * as tuningService from '@/services/tuning';
import { formatDateTime } from '@/lib/format';
import { colors, radii, spacing } from '@/theme';
import type { TuningChange } from '@/types';

/** Eén regel binnen een correctie: de oorspronkelijke waarden plus zijn eigen volgende stap. */
export type JetEditRow = {
  id: string;
  part: string;
  oldValue: string;
  newValue: string;
  nextStep: string | null;
};

export type JetEdit = { key: string; note: string; rows: JetEditRow[] };

/** Terugkoppeling die per scherm verschilt; de rest van de teksten is gedeeld. */
export type JetChangeMessages = {
  edited: string;
  undone: string;
};

export type JetChangeActions = ReturnType<typeof useJetChangeActions>;

/**
 * Alle acties rond een sproeierwissel. De hook bezit de UI-stand (welke wissel
 * wordt gecorrigeerd, verwijderd of opnieuw getest, en welke net verwijderd is)
 * en doet de bijbehorende service-calls. Het scherm levert alleen de
 * laadfunctie, de bezig-stand, de navigatie naar de GPS-meter en de notities.
 */
export function useJetChangeActions({
  busy,
  setBusy,
  reload,
  onStartTest,
  setNote,
  messages,
}: {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /** Haalt de wissels opnieuw op na een correctie, verwijdering of undo. */
  reload: () => Promise<void>;
  /** Start de GPS-meter voor deze wissel. */
  onStartTest: (group: TuningChange[]) => void;
  setNote: (note: string | null) => void;
  messages: JetChangeMessages;
}) {
  const [edit, setEdit] = useState<JetEdit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [retestId, setRetestId] = useState<string | null>(null);
  const [undoRows, setUndoRows] = useState<TuningChange[] | null>(null);

  /** Zet een wissel in de corrigeerstand, met de waarden zoals ze er nu staan. */
  function startEdit(group: TuningChange[]) {
    const first = group[0];
    if (!first) return;
    setDeleteId(null);
    setRetestId(null);
    setEdit({
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

  function changeRow(id: string, field: 'oldValue' | 'newValue', value: string) {
    setEdit((prev) =>
      prev ? { ...prev, rows: prev.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)) } : prev,
    );
  }

  function changeNote(text: string) {
    setEdit((prev) => (prev ? { ...prev, note: text } : prev));
  }

  function cancelEdit() {
    setEdit(null);
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    try {
      for (const row of edit.rows) {
        await tuningService.updateChange(row.id, {
          old_value: row.oldValue.trim() || null,
          new_value: row.newValue.trim() || null,
          notes: composeJetNotes(edit.note, row.nextStep),
        });
      }
      setEdit(null);
      await reload();
      setNote(messages.edited);
    } catch {
      setNote('Correctie opslaan mislukt — controleer je verbinding.');
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(group: TuningChange[]) {
    const first = group[0];
    if (!first) return;
    setEdit(null);
    setRetestId(null);
    setDeleteId(first.id);
  }

  function cancelDelete() {
    setDeleteId(null);
  }

  async function confirmDelete(group: TuningChange[]) {
    setBusy(true);
    try {
      await tuningService.deleteChanges(group.map((c) => c.id));
      if (edit && group.some((c) => c.id === edit.key)) setEdit(null);
      setDeleteId(null);
      // Bewaar de regels zodat een verkeerde klik terug te draaien is.
      setUndoRows(group);
      await reload();
      // De strook met "Ongedaan maken" meldt dit al; geen dubbele regel eronder.
      setNote(null);
    } catch {
      setNote('Verwijderen mislukt — controleer je verbinding.');
    } finally {
      setBusy(false);
    }
  }

  /** Start de test, of vraag eerst bevestiging als er al een meting hangt. */
  function requestTest(group: TuningChange[]) {
    const first = group[0];
    if (!first) return;
    if (jetGroupHasRun(group)) {
      setRetestId(first.id);
      return;
    }
    onStartTest(group);
  }

  function cancelRetest() {
    setRetestId(null);
  }

  function confirmRetest(group: TuningChange[]) {
    setRetestId(null);
    onStartTest(group);
  }

  /** Vergeet een bewaarde verwijdering, bijvoorbeeld na een wissel van scooter. */
  function resetUndo() {
    setUndoRows(null);
  }

  /** Zet de zojuist verwijderde wissel terug, met dezelfde id en hetzelfde tijdstip. */
  async function undo() {
    if (!undoRows) return;
    setBusy(true);
    try {
      await tuningService.restoreChanges(undoRows);
      setUndoRows(null);
      await reload();
      setNote(messages.undone);
    } catch {
      setNote('Ongedaan maken mislukt — controleer je verbinding.');
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    edit,
    deleteId,
    retestId,
    undoRows,
    startEdit,
    changeRow,
    changeNote,
    cancelEdit,
    saveEdit,
    requestDelete,
    cancelDelete,
    confirmDelete,
    requestTest,
    cancelRetest,
    confirmRetest,
    resetUndo,
    undo,
  };
}

/** Strook boven de lijst waarmee een verwijderde wissel terug te zetten is. */
export function JetUndoStrip({ actions }: { actions: JetChangeActions }) {
  if (!actions.undoRows) return null;
  return (
    <View style={styles.undoBlock}>
      <Text style={styles.undoText}>{jetUndoNotice(actions.undoRows)}</Text>
      <Pressable
        style={styles.chip}
        disabled={actions.busy}
        accessibilityLabel="Verwijderen ongedaan maken"
        onPress={() => void actions.undo()}
      >
        <Text style={styles.chipText}>{actions.busy ? 'Bezig…' : 'Ongedaan maken'}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Eén sproeierwissel. `variant="log"` past in het logblok van de Afstelhulp
 * (regel met datum, geen eigen Card); `variant="history"` is de kaart in de
 * tuninggeschiedenis (met badge en kilometerstand).
 */
export function JetChangeCard({
  group,
  actions,
  variant = 'history',
}: {
  group: TuningChange[];
  actions: JetChangeActions;
  variant?: 'log' | 'history';
}) {
  const first = group[0];
  if (!first) return null;

  const { edit, deleteId, retestId, busy } = actions;
  const { testNote: storedNote, nextStep } = splitJetNotes(first.notes);
  const hasRun = jetGroupHasRun(group);
  // Met een gekoppelde meting vervalt de placeholdernotitie.
  const testNote = visibleTestNote(storedNote, hasRun);
  const activeEdit = edit && edit.key === first.id ? edit : null;
  const title = group.length === 1 ? first.part : `Wissel · ${group.length} onderdelen`;
  const isHistory = variant === 'history';

  const content = (
    <>
      {isHistory ? (
        <View style={styles.partRow}>
          <Text style={styles.part}>{title}</Text>
          <Badge label="sproeierwissel" tone="info" />
        </View>
      ) : (
        <View style={styles.logHead}>
          <Text style={styles.logPart}>{title}</Text>
          <Text style={styles.logDate}>{formatDateTime(first.changed_at)}</Text>
        </View>
      )}

      {group.map((c) => (
        <Text key={c.id} style={styles.change}>
          {group.length > 1 ? `${c.part}: ` : null}
          {c.old_value ?? '—'} <Text style={{ color: colors.primary }}>→</Text> {c.new_value ?? '—'}
        </Text>
      ))}

      {isHistory ? (
        <Text style={styles.meta}>
          {formatDateTime(first.changed_at)}
          {first.km_at_change !== null ? ` · ${first.km_at_change.toLocaleString('nl-NL')} km` : ''}
        </Text>
      ) : null}

      {first.result ? (
        <Text style={styles.result}>{isHistory ? `Mengsel: ${first.result}` : first.result}</Text>
      ) : null}
      {first.run ? <Text style={styles.measured}>{measuredResultLine(first.run)}</Text> : null}
      {testNote ? <Text style={styles.note}>{testNote}</Text> : null}
      {nextStep ? <Text style={styles.nextStep}>{`Volgende stap: ${nextStep}`}</Text> : null}

      {activeEdit ? (
        <View style={styles.editBlock}>
          {activeEdit.rows.map((row) => (
            <View key={row.id} style={styles.editRow}>
              <Text style={styles.editPart}>{row.part}</Text>
              <Input
                label="Oude waarde"
                value={row.oldValue}
                onChangeText={(t) => actions.changeRow(row.id, 'oldValue', t)}
              />
              <Input
                label="Nieuwe waarde"
                value={row.newValue}
                onChangeText={(t) => actions.changeRow(row.id, 'newValue', t)}
              />
            </View>
          ))}
          <Input
            label="Testresultaat"
            value={activeEdit.note}
            onChangeText={actions.changeNote}
            placeholder="Wat deed hij op de testrit?"
            multiline
            style={styles.editNote}
          />
          <Text style={styles.editHint}>
            Alleen de logregel wordt aangepast; de volgende stap en een gekoppelde GPS-meting blijven staan.
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.chip} disabled={busy} onPress={() => void actions.saveEdit()}>
              <Text style={styles.chipText}>{busy ? 'Opslaan…' : 'Correctie opslaan'}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={actions.cancelEdit}>
              <Text style={styles.chipText}>Annuleren</Text>
            </Pressable>
          </View>
        </View>
      ) : deleteId === first.id ? (
        <View style={styles.confirmBlock}>
          <Text style={styles.confirmWarn}>
            {`Deze wissel${group.length > 1 ? ` (${group.length} regels)` : ''} verdwijnt uit ${
              isHistory ? 'de tuninggeschiedenis' : 'dit log en uit de tuninggeschiedenis'
            }.`}
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={[styles.chip, styles.deleteChip]}
              disabled={busy}
              onPress={() => void actions.confirmDelete(group)}
            >
              <Text style={[styles.chipText, styles.deleteChipText]}>
                {busy ? 'Verwijderen…' : 'Ja, verwijderen'}
              </Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={actions.cancelDelete}>
              <Text style={styles.chipText}>Annuleren</Text>
            </Pressable>
          </View>
        </View>
      ) : retestId === first.id ? (
        <View style={styles.confirmBlock}>
          <Text style={styles.confirmWarn}>{JET_RETEST_WARNING}</Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.chip}
              accessibilityLabel="Bestaande meting vervangen"
              onPress={() => actions.confirmRetest(group)}
            >
              <Text style={styles.chipText}>Ja, opnieuw testen</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={actions.cancelRetest}>
              <Text style={styles.chipText}>Annuleren</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={styles.chip}
            accessibilityLabel="GPS-test voor deze sproeierwissel"
            onPress={() => actions.requestTest(group)}
          >
            <Text style={styles.chipText}>{hasRun ? 'Opnieuw testen' : 'Test deze wissel'}</Text>
          </Pressable>
          <Pressable
            style={styles.chip}
            accessibilityLabel="Sproeierwissel corrigeren"
            onPress={() => actions.startEdit(group)}
          >
            <Text style={styles.chipText}>Corrigeren</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, styles.deleteChip]}
            accessibilityLabel="Sproeierwissel verwijderen"
            onPress={() => actions.requestDelete(group)}
          >
            <Text style={[styles.chipText, styles.deleteChipText]}>Verwijderen</Text>
          </Pressable>
        </View>
      )}
    </>
  );

  if (!isHistory) return <View style={styles.logRow}>{content}</View>;
  return <Card style={styles.card}>{content}</Card>;
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.m },
  part: { color: colors.text, fontWeight: '700', fontSize: 16 },
  partRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.s },
  logRow: {
    marginTop: spacing.s,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.s,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.s,
  },
  logHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.s },
  logPart: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  logDate: { color: colors.textSubtle, fontSize: 11 },
  change: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
  meta: { color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
  result: { color: colors.success, fontSize: 12.5, marginTop: 3 },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  nextStep: { color: colors.primary, fontSize: 12, lineHeight: 17, marginTop: 3, fontWeight: '600' },
  measured: { color: colors.success, fontSize: 12.5, lineHeight: 18, marginTop: 3, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s, flexWrap: 'wrap' },
  chip: {
    alignSelf: 'flex-start',
    marginTop: spacing.s,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  chipText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  deleteChip: { borderColor: 'rgba(239,68,68,0.45)', backgroundColor: 'rgba(239,68,68,0.10)' },
  deleteChipText: { color: colors.danger },
  editBlock: { marginTop: spacing.s, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.s },
  editRow: { marginTop: spacing.s },
  editPart: { color: colors.text, fontSize: 13.5, fontWeight: '800', marginBottom: 2 },
  editNote: { minHeight: 64, textAlignVertical: 'top' },
  editHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.xs },
  confirmBlock: {
    marginTop: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.s,
  },
  confirmWarn: { color: colors.warning, fontSize: 12, lineHeight: 17 },
  undoBlock: {
    marginBottom: spacing.m,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.s,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    padding: spacing.s,
    gap: spacing.xs,
  },
  undoText: { color: colors.text, fontSize: 12.5, lineHeight: 18 },
});
