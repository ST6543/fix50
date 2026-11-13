/** Setups vergelijken — verschillen naast elkaar zien. */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Card, EmptyState, Loading, SectionTitle } from '@/components/ui';
import { ScaleIcon } from '@/components/icons';
import { calculateCvt, cvtSpeedLabel, cvtStateFromSetupParts, SETUP_NUMERIC_KEYS } from '@/lib/afstel';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import { colors, fonts, spacing } from '@/theme';
import type { TuningSetup } from '@/types';

type Nav = AppNav;

export default function SetupComparisonScreen() {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  const [setups, setSetups] = useState<TuningSetup[]>([]);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!activeScooter) {
        setLoading(false);
        return;
      }
      tuningService
        .listSetups(activeScooter.id)
        .then((s) => {
          setSetups(s);
          setAId(s[0]?.id ?? null);
          setBId(s[1]?.id ?? null);
        })
        .catch(() => setSetups([]))
        .finally(() => setLoading(false));
    }, [activeScooter]),
  );

  if (loading) return <Loading label="Setups laden…" />;

  const a = setups.find((s) => s.id === aId) ?? null;
  const b = setups.find((s) => s.id === bId) ?? null;

  if (!activeScooter || setups.length < 1) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          icon={ScaleIcon}
          title="Sla eerst minimaal twee setups op"
          subtitle="Daarna kun je ze hier naast elkaar leggen."
          actionLabel="Naar tuning"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const hidden = new Set<string>(SETUP_NUMERIC_KEYS);
  const allKeys = Array.from(new Set([...Object.keys(a?.parts ?? {}), ...Object.keys(b?.parts ?? {})])).filter(
    (k) => !hidden.has(k),
  );
  const differences = allKeys.filter((k) => String(a?.parts[k] ?? '') !== String(b?.parts[k] ?? ''));

  // Voorspelde score per opstelling, uit dezelfde rekenregels als de Afstelhulp.
  const predA = a ? calculateCvt(cvtStateFromSetupParts(a.parts)) : null;
  const predB = b ? calculateCvt(cvtStateFromSetupParts(b.parts)) : null;
  const winner =
    a && b && predA && predB
      ? predA.balanceScore > predB.balanceScore ||
        (predA.balanceScore === predB.balanceScore && predA.topSpeed > predB.topSpeed)
        ? { name: a.name, model: predA }
        : { name: b.name, model: predB }
      : null;

  function Side({
    title,
    selected,
    onSelect,
  }: {
    title: string;
    selected: string | null;
    onSelect: (id: string) => void;
  }) {
    return (
      <View style={{ flex: 1 }}>
        <Text style={styles.sideTitle}>{title}</Text>
        {setups.map((s) => (
          <Text
            key={s.id}
            onPress={() => onSelect(s.id)}
            style={[styles.sideOption, selected === s.id && styles.sideOptionActive]}
          >
            {s.name}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.pickersRow}>
            <Side title="Setup A" selected={aId} onSelect={setAId} />
            <Side title="Setup B" selected={bId} onSelect={setBId} />
          </View>
        </Card>

        {a && b && predA && predB ? (
          <Card style={styles.predCard}>
            <Text style={styles.predTitle}>VOORSPELLING</Text>
            <Text style={styles.predSub}>Wat de rekenregels verwachten — vóór je gaat rijden.</Text>
            <View style={styles.predHeadRow}>
              <Text style={styles.predLabel} />
              <Text style={styles.predColName} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={styles.predColName} numberOfLines={1}>
                {b.name}
              </Text>
            </View>
            {[
              {
                label: 'Launch',
                av: `${predA.launchScore.toFixed(1)}/10`,
                bv: `${predB.launchScore.toFixed(1)}/10`,
                aWins: predA.launchScore > predB.launchScore,
                bWins: predB.launchScore > predA.launchScore,
              },
              {
                label: 'Balans',
                av: `${predA.balanceScore.toFixed(1)}/10`,
                bv: `${predB.balanceScore.toFixed(1)}/10`,
                aWins: predA.balanceScore > predB.balanceScore,
                bWins: predB.balanceScore > predA.balanceScore,
              },
              {
                label: 'Shift-toeren',
                av: `${Math.round(predA.shiftRpm)} rpm`,
                bv: `${Math.round(predB.shiftRpm)} rpm`,
                aWins: false,
                bWins: false,
              },
              {
                label: 'Top (schatting)',
                av: cvtSpeedLabel(predA.topSpeed),
                bv: cvtSpeedLabel(predB.topSpeed),
                aWins: predA.topSpeed > predB.topSpeed,
                bWins: predB.topSpeed > predA.topSpeed,
              },
            ].map((row) => (
              <View key={row.label} style={styles.predRow}>
                <Text style={styles.predLabel}>{row.label}</Text>
                <Text style={[styles.predVal, row.aWins && styles.predWin]}>{row.av}</Text>
                <Text style={[styles.predVal, row.bWins && styles.predWin]}>{row.bv}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.predVerdictRow}>
              <Badge label="BESTE UIT DE BUS" tone="success" />
              <Text style={styles.predWinner} numberOfLines={1}>
                {winner?.name ?? '—'}
              </Text>
            </View>
            <Text style={styles.hint}>
              {winner
                ? `${winner.model.verdict} · ${winner.model.advice}`
                : 'Kies twee setups om een voorspelling te zien.'}
            </Text>
            <Text style={styles.predNote}>
              Schatting op basis van rolgewicht, drukveer, snaar en powerband. Een testrit blijft de echte meting.
            </Text>
          </Card>
        ) : null}

        <SectionTitle>{differences.length} verschillen</SectionTitle>
        {a && b ? (
          <>
            {differences.map((k) => (
              <Card key={k} style={styles.diffCard}>
                <Text style={styles.diffKey}>{k}</Text>
                <View style={styles.diffRow}>
                  <Text style={styles.diffValue}>{String(a.parts[k] ?? '—')}</Text>
                  <Text style={styles.arrow}>→</Text>
                  <Text style={[styles.diffValue, { color: colors.primary }]}>{String(b.parts[k] ?? '—')}</Text>
                </View>
              </Card>
            ))}
            {allKeys
              .filter((k) => !differences.includes(k))
              .map((k) => (
                <Card key={k} style={styles.sameCard}>
                  <Text style={styles.sameText}>
                    {k}: {String(a.parts[k] ?? '—')} (gelijk)
                  </Text>
                </Card>
              ))}
          </>
        ) : (
          <Text style={styles.hint}>Kies twee setups om te vergelijken.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  pickersRow: { flexDirection: 'row', gap: spacing.l },
  sideTitle: { color: colors.primary, fontWeight: '800', marginBottom: spacing.s },
  sideOption: { color: colors.textMuted, paddingVertical: spacing.xs, fontSize: 15 },
  sideOptionActive: { color: colors.text, fontWeight: '700' },
  diffCard: { marginBottom: spacing.m },
  diffKey: { color: colors.textMuted, fontSize: 13 },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: 2 },
  diffValue: { color: colors.text, fontWeight: '800', fontSize: 17 },
  arrow: { color: colors.textMuted },
  sameCard: { marginBottom: spacing.s, opacity: 0.7 },
  sameText: { color: colors.textMuted, fontSize: 13 },
  hint: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.l },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginTop: spacing.m, marginBottom: spacing.s },
  predCard: { marginBottom: spacing.m },
  predTitle: { color: colors.text, fontSize: 15, fontWeight: '800', fontFamily: fonts.display, textTransform: 'uppercase' },
  predSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  predHeadRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.m },
  predRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  predLabel: { flex: 1.2, color: colors.textMuted, fontSize: 12 },
  predColName: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  predVal: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center', fontFamily: fonts.display },
  predWin: { color: colors.success },
  predVerdictRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.s },
  predWinner: { color: colors.text, fontSize: 15, fontWeight: '800', fontFamily: fonts.display, flexShrink: 1 },
  predNote: { color: colors.textSubtle, fontSize: 11, marginTop: spacing.s, lineHeight: 16 },
});
