/** Setups vergelijken — verschillen naast elkaar zien. */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Card, EmptyState, Loading, SectionTitle } from '@/components/ui';
import { ScaleIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import { colors, spacing } from '@/theme';
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

  const allKeys = Array.from(new Set([...Object.keys(a?.parts ?? {}), ...Object.keys(b?.parts ?? {})]));
  const differences = allKeys.filter((k) => String(a?.parts[k] ?? '') !== String(b?.parts[k] ?? ''));

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
});
