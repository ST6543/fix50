/**
 * Fix50 Engine Database — blokdossiers met bronnen.
 *
 * Elke waarde toont zijn bron; wat niet gecontroleerd is staat expliciet als
 * ontbrekend. Forumkennis wordt hier nooit als fabriekswaarde gepresenteerd.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Card, SectionTitle } from '@/components/ui';
import {
  dossierSources,
  ENGINE_DOSSIERS,
  PLANNED_BLOCKS,
  type EngineDossier,
  type EngineSourceKind,
  type SourcedValue,
} from '@/data/engineDatabase';
import { colors, fonts, radii, spacing } from '@/theme';

const KIND_LABEL: Record<EngineSourceKind, string> = {
  fabriek: 'fabrieksopgave',
  leverancier: 'leveranciersdocumentatie',
  praktijk: 'praktijkervaring',
  onbekend: 'onbekend',
};

const KIND_TONE: Record<EngineSourceKind, 'success' | 'info' | 'warning' | 'neutral'> = {
  fabriek: 'success',
  leverancier: 'info',
  praktijk: 'warning',
  onbekend: 'neutral',
};

function ValueRow({ label, value }: { label: string; value: SourcedValue<string | number> }) {
  const shown = value.kind === 'onbekend' || value.value === null;
  return (
    <View style={styles.valueRow}>
      <View style={styles.valueHead}>
        <Text style={styles.valueLabel}>{label}</Text>
        <Badge label={KIND_LABEL[value.kind]} tone={KIND_TONE[value.kind]} />
      </View>
      <Text style={shown ? styles.valueUnknown : styles.value}>
        {shown ? 'onbekend' : String(value.value).replace('.', ',')}
      </Text>
      {value.source ? <Text style={styles.valueSource}>{value.source}</Text> : null}
    </View>
  );
}

function DossierCard({ dossier }: { dossier: EngineDossier }) {
  const sources = dossierSources(dossier);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.code}>{dossier.code}</Text>
          <Text style={styles.label}>{dossier.label}</Text>
        </View>
        <Badge label={dossier.transmission ?? 'transmissie onbekend'} tone="neutral" />
      </View>
      <Text style={styles.meta}>
        {[dossier.generation, dossier.years, dossier.cooling].filter(Boolean).join(' · ')}
      </Text>
      <Text style={styles.meta}>{dossier.models.join(', ')}</Text>

      <Text style={styles.labelSmall}>MOTOR</Text>
      <ValueRow label="Cilinderinhoud" value={dossier.displacementCc} />
      <ValueRow label="Boring × slag" value={dossier.boreStroke} />
      <ValueRow label="Primaire overbrenging" value={dossier.primaryRatio} />

      {dossier.gearboxes.length > 0 ? (
        <>
          <Text style={styles.labelSmall}>VERSNELLINGSBAK</Text>
          {dossier.gearboxes.map((gb) => (
            <View key={gb.id} style={styles.gearbox}>
              <View style={styles.gearboxHead}>
                <Text style={styles.gearboxLabel}>{gb.label}</Text>
                <Badge label={KIND_LABEL[gb.kind]} tone={KIND_TONE[gb.kind]} />
              </View>
              {gb.gears.map((g) => (
                <View key={g.gear} style={styles.gearRow}>
                  <Text style={styles.gearNr}>{g.gear}</Text>
                  <Text style={styles.gearPair}>{g.pair}</Text>
                  <Text style={styles.gearRatio}>{String(g.ratio).replace('.', ',')}</Text>
                </View>
              ))}
              {gb.source ? <Text style={styles.valueSource}>Bron: {gb.source}</Text> : null}
              {gb.note ? <Text style={styles.warning}>{gb.note}</Text> : null}
            </View>
          ))}
        </>
      ) : null}

      {dossier.totalRatios.length > 0 ? (
        <>
          <Text style={styles.labelSmall}>TOTALE OVERBRENGING (FABRIEK)</Text>
          {dossier.totalRatios.map((t, i) => (
            <View key={`${t.label}-${i}`} style={styles.valueRow}>
              <View style={styles.valueHead}>
                <Text style={styles.valueLabel}>{t.label}</Text>
                <Badge label={KIND_LABEL[t.kind]} tone={KIND_TONE[t.kind]} />
              </View>
              <Text style={styles.value}>{String(t.ratio).replace('.', ',')}</Text>
              <Text style={styles.valueSource}>{t.source}</Text>
            </View>
          ))}
        </>
      ) : null}

      {dossier.stockCarbs.length > 0 ? (
        <>
          <Text style={styles.labelSmall}>ORIGINELE CARBURATEUR</Text>
          {dossier.stockCarbs.map((c) => (
            <View key={c.carburettor} style={styles.carb}>
              <Text style={styles.carbName}>{c.carburettor}</Text>
              <ValueRow label="Hoofdsproeier" value={c.mainJet} />
              <ValueRow label="Stationairsproeier" value={c.idleJet} />
              <ValueRow label="Gasnaald" value={c.needle} />
              <ValueRow label="Gasschuif" value={c.slide} />
              <ValueRow label="Vlotterhoogte" value={c.floatHeightMm} />
              <ValueRow label="Luchtschroef" value={c.airScrewTurns} />
              <Text style={styles.applies}>{c.appliesTo}</Text>
            </View>
          ))}
        </>
      ) : null}

      <Text style={styles.labelSmall}>ONTBREEKT NOG</Text>
      {dossier.missing.map((m) => (
        <Text key={m} style={styles.missing}>{`· ${m}`}</Text>
      ))}

      {dossier.notes.length > 0 ? (
        <>
          <Text style={styles.labelSmall}>LET OP</Text>
          {dossier.notes.map((n) => (
            <Text key={n} style={styles.note}>{n}</Text>
          ))}
        </>
      ) : null}

      {sources.length > 0 ? (
        <>
          <Text style={styles.labelSmall}>BRONNEN</Text>
          {sources.map((s) => (
            <Text key={s} style={styles.valueSource}>{`· ${s}`}</Text>
          ))}
        </>
      ) : null}
    </Card>
  );
}

export default function EngineDatabaseScreen() {
  const [openId, setOpenId] = useState<string>(ENGINE_DOSSIERS[0]!.id);
  const open = ENGINE_DOSSIERS.find((d) => d.id === openId)!;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.eyebrow}>ENGINE DATABASE</Text>
          <Text style={styles.title}>Blokdossiers met bron</Text>
          <Text style={styles.body}>
            Elke waarde hier heeft een bron. Wat nog niet gecontroleerd is, staat als onbekend — een ontbrekende
            fabriekswaarde blijft onbekend, en een forumervaring wordt nooit een fabrieksinstelling.
          </Text>
        </Card>

        <SectionTitle>Dossier kiezen</SectionTitle>
        <Card style={styles.pickerCard}>
          {ENGINE_DOSSIERS.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityLabel={d.label}
              onPress={() => setOpenId(d.id)}
              style={[styles.pickerRow, d.id === openId && styles.pickerRowActive]}
            >
              <Text style={[styles.pickerCode, d.id === openId && styles.pickerCodeActive]}>{d.code}</Text>
              <Text style={styles.pickerLabel}>{d.label}</Text>
            </Pressable>
          ))}
        </Card>

        <DossierCard dossier={open} />

        <SectionTitle>Nog geen dossier</SectionTitle>
        <Card>
          <Text style={styles.body}>
            Deze families staan op de lijst maar hebben nog geen gecontroleerde bron. Ze verschijnen hier pas als de
            gegevens echt gecontroleerd zijn.
          </Text>
          {PLANNED_BLOCKS.map((b) => (
            <View key={b.code} style={styles.plannedRow}>
              <Text style={styles.plannedCode}>{b.code}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.plannedLabel}>{b.label}</Text>
                <Text style={styles.valueSource}>{b.status}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  eyebrow: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 1, color: colors.primary, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayBold, fontSize: 21, color: colors.text, marginTop: spacing.xs, letterSpacing: -0.3 },
  body: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20, marginTop: spacing.xs },
  card: { marginBottom: spacing.m },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s },
  code: { color: colors.primary, fontFamily: fonts.displayBold, fontSize: 16, letterSpacing: 0.4 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 1 },
  meta: { color: colors.textSubtle, fontSize: 12, marginTop: 2 },
  labelSmall: { color: colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: spacing.m, marginBottom: spacing.xs },
  valueRow: { marginTop: spacing.s },
  valueHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  valueLabel: { flex: 1, color: colors.textMuted, fontSize: 12.5 },
  value: { color: colors.text, fontSize: 13, fontWeight: '700', fontFamily: fonts.display },
  valueUnknown: { color: colors.textSubtle, fontSize: 13, fontStyle: 'italic' },
  valueSource: { color: colors.textSubtle, fontSize: 11, lineHeight: 15, marginTop: 1 },
  gearbox: { backgroundColor: colors.surfaceAlt, borderRadius: radii.s, padding: spacing.s, marginTop: spacing.xs },
  gearboxHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s, marginBottom: spacing.xs },
  gearboxLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  gearRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: 2 },
  gearNr: { width: 16, color: colors.primary, fontWeight: '800', fontSize: 12 },
  gearPair: { flex: 1, color: colors.textMuted, fontSize: 12 },
  gearRatio: { color: colors.text, fontSize: 12.5, fontWeight: '700', fontFamily: fonts.display },
  warning: { color: colors.warning, fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  carb: { backgroundColor: colors.surfaceAlt, borderRadius: radii.s, padding: spacing.s, marginTop: spacing.xs },
  carbName: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  applies: { color: colors.textSubtle, fontSize: 11, lineHeight: 15, marginTop: spacing.xs, fontStyle: 'italic' },
  missing: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18 },
  note: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  pickerCard: { paddingVertical: spacing.s },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  pickerRowActive: { backgroundColor: colors.primarySubtle, borderRadius: radii.s },
  pickerCode: { width: 96, color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  pickerCodeActive: { color: colors.primary },
  pickerLabel: { flex: 1, color: colors.text, fontSize: 13 },
  plannedRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  plannedCode: { width: 96, color: colors.textSubtle, fontSize: 12, fontWeight: '700' },
  plannedLabel: { color: colors.text, fontSize: 12.5 },
});
