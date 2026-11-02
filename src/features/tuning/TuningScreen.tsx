/** Tuning tab — huidige setup, setups beheren, geschiedenis en vergelijken. */
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, EmptyState, Loading, SectionTitle } from '@/components/ui';
import { SlidersIcon } from '@/components/icons';
import { FadeInView } from '@/components/motion';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import { colors, spacing } from '@/theme';
import type { TuningSetup } from '@/types';

type Nav = AppNav;

export default function TuningScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<Nav>();
  const { activeScooter, setup } = useScooters();
  const [setups, setSetups] = useState<TuningSetup[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!activeScooter) {
        setLoading(false);
        return;
      }
      tuningService
        .listSetups(activeScooter.id)
        .then(setSetups)
        .catch(() => setSetups([]))
        .finally(() => setLoading(false));
    }, [activeScooter]),
  );

  async function handleActivate(s: TuningSetup) {
    if (!activeScooter) return;
    await tuningService.activateSetup(activeScooter.id, s.id).catch(() => undefined);
    setSetups((prev) => prev.map((x) => ({ ...x, is_active: x.id === s.id })));
  }

  async function handleDelete(s: TuningSetup) {
    Alert.alert('Setup verwijderen?', `"${s.name}" wordt verwijderd.`, [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: async () => {
          await tuningService.deleteSetup(s.id).catch(() => undefined);
          setSetups((prev) => prev.filter((x) => x.id !== s.id));
        },
      },
    ]);
  }

  if (loading) return <Loading label="Tuning laden…" />;

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button label="Afstelhulp openen" onPress={() => navigation.navigate('Afstel')} style={{ marginBottom: spacing.m }} />
        <SectionTitle>Huidige setup</SectionTitle>
        <Card>
          {setup ? (
            <View style={styles.setupGrid}>
              {(
                [
                  ['Blok', setup.bloktype],
                  ['Cilinder', setup.cilinder],
                  ['Carb', setup.carburateur ? `${setup.carburateur}${setup.carburateurmaat_mm ? ` ${setup.carburateurmaat_mm}mm` : ''}` : null],
                  ['Hoofdsproeier', setup.hoofdsproeier ? String(setup.hoofdsproeier) : null],
                  ['Stationair', setup.stationairsproeier ? String(setup.stationairsproeier) : null],
                  ['Naald', setup.naaldpositie],
                  ['Luchtfilter', setup.luchtfilter],
                  ['Uitlaat', setup.uitlaat],
                  ['Variateur', setup.variateur],
                  ['Rollen', setup.rollen],
                  ['Drukveer', setup.drukveer],
                  ['Trekveren', setup.trekveren],
                  ['Koppeling', setup.koppeling],
                  ['Bougie', setup.bougie],
                ] as [string, string | number | null][]
              )
                .filter(([, v]) => v !== null && v !== '')
                .slice(0, 10)
                .map(([k, v]) => (
                  <View key={k as string} style={styles.setupCell}>
                    <Text style={styles.setupKey}>{k}</Text>
                    <Text style={styles.setupValue}>{v}</Text>
                  </View>
                ))}
            </View>
          ) : (
            <Text style={styles.hint}>Vul je setup in via Scooter → Setup. Daaronder verschijnen hier tuning-adviezen.</Text>
          )}
        </Card>

        <SectionTitle>Opgeslagen setups</SectionTitle>
        {setups.length === 0 ? (
          <EmptyState
            icon={SlidersIcon}
            title="Nog geen setups opgeslagen"
            subtitle='Sla varianten op zoals "Origineel", "Sport" of "Test setup".'
            actionLabel="Nieuwe setup"
            onAction={() => navigation.navigate('SetupDetail', {})}
          />
        ) : (
          setups.map((s, si) => (
            <FadeInView key={s.id} index={si}>
            <Card style={styles.setupCard}>
              <View style={styles.setupRow}>
                <Text style={styles.setupName}>{s.name}</Text>
                {s.is_active ? <Badge label="Actief" tone="success" /> : null}
              </View>
              <Text style={styles.hint}>{Object.keys(s.parts ?? {}).length} onderdelen</Text>
              <View style={styles.setupActions}>
                <Button label="Bekijken" onPress={() => navigation.navigate('SetupDetail', { setupId: s.id })} style={styles.setupBtn} />
                {!s.is_active ? (
                  <Button label="Activeren" variant="secondary" onPress={() => handleActivate(s)} style={styles.setupBtn} />
                ) : null}
                <Button label="Verwijder" variant="ghost" onPress={() => handleDelete(s)} style={styles.setupBtn} />
              </View>
            </Card>
            </FadeInView>
          ))
        )}

        <View style={styles.actionsRow}>
          <Button label="Nieuwe setup" onPress={() => navigation.navigate('SetupDetail', {})} style={styles.actionBtn} />
          <Button label="Vergelijken" variant="secondary" onPress={() => navigation.navigate('SetupComparison')} style={styles.actionBtn} />
        </View>
        <Button label="Tuninggeschiedenis" variant="secondary" onPress={() => navigation.navigate('TuningHistory')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  setupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m },
  setupCell: { width: '30%' },
  setupKey: { color: colors.textMuted, fontSize: 12 },
  setupValue: { color: colors.text, fontWeight: '700', fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  setupCard: { marginBottom: spacing.m },
  setupRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  setupName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  setupActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  setupBtn: { flex: 1, minHeight: 40 },
  actionsRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s, marginBottom: spacing.s },
  actionBtn: { flex: 1 },
});
