/** Tuning tab — huidige setup, setups beheren, geschiedenis en vergelijken. */
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, EmptyState, SectionTitle, SkeletonScreen } from '@/components/ui';
import {
  ChevronRightIcon,
  ClipboardIcon,
  GaugeIcon,
  ScaleIcon,
  SlidersIcon,
  TimerIcon,
  TrendingUpIcon,
  WrenchIcon,
} from '@/components/icons';
import { FadeInView } from '@/components/motion';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import { colors, fonts, radii, spacing } from '@/theme';
import type { TuningSetup } from '@/types';

type Nav = AppNav;

export default function TuningScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<Nav>();
  const { activeScooter, setup } = useScooters();
  const [setups, setSetups] = useState<TuningSetup[]>([]);
  const [loading, setLoading] = useState(true);

  /** Gereedschap naast de twee hoofdacties — één regel per bestemming. */
  const tools: {
    label: string;
    sub: string;
    icon: (p: { size?: number; color?: string }) => React.ReactElement;
    route: string;
  }[] = [
    { label: 'Vertanding optimaliseren', sub: 'Rollen, vario en eindoverbrenging', icon: ScaleIcon, route: 'Gearing' },
    { label: 'Metingen', sub: 'GPS-sprints en topsnelheid', icon: GaugeIcon, route: 'PerformanceHistory' },
    { label: 'Setup vergelijken', sub: 'Twee setups naast elkaar', icon: SlidersIcon, route: 'SetupComparison' },
    { label: 'Tuninggeschiedenis', sub: 'Wat je wanneer veranderde', icon: ClipboardIcon, route: 'TuningHistory' },
    { label: 'Motordatabase', sub: 'Blokken en hun eigenschappen', icon: WrenchIcon, route: 'EngineDatabase' },
    { label: 'Dashboard', sub: 'Voortgang van je tuning', icon: TrendingUpIcon, route: 'TuningDashboard' },
    { label: 'Simulator', sub: 'Sproeier en uitlaat doorrekenen', icon: TimerIcon, route: 'TuningSimulator' },
    { label: 'Carburateurdiagram', sub: 'Onderdelen en doorsnedes', icon: SlidersIcon, route: 'CarbDiagram' },
  ];

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

  if (loading) return <SkeletonScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionEyebrow}>Tuningwerkplaats</Text>
        <View style={styles.navRow}>
          <Button label="Nieuwe setup" onPress={() => navigation.navigate('SetupDetail', {})} style={styles.navBtn} />
          <Button
            label="Carburateur afstellen"
            variant="secondary"
            onPress={() => navigation.navigate('Afstel')}
            style={styles.navBtn}
          />
        </View>

        <SectionTitle>Gereedschap</SectionTitle>
        <Card style={styles.toolsCard}>
          {tools.map((tool, i) => (
            <Pressable
              key={tool.route}
              accessibilityRole="button"
              onPress={() => navigation.navigate(tool.route as never)}
              style={({ pressed }) => [
                styles.toolRow,
                i > 0 && styles.toolDivider,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.toolIcon}>{tool.icon({ size: 18, color: colors.textMuted })}</View>
              <View style={styles.toolText}>
                <Text style={styles.toolLabel}>{tool.label}</Text>
                <Text style={styles.toolSub}>{tool.sub}</Text>
              </View>
              <ChevronRightIcon size={17} color={colors.textSubtle} />
            </Pressable>
          ))}
        </Card>

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
            subtitle='Sla varianten op zoals "Origineel", "Sport" of "Test setup" via "Nieuwe setup".'
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
  navRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s, marginBottom: spacing.l },
  sectionEyebrow: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  navBtn: { flex: 1 },
  toolsCard: { paddingVertical: spacing.xs, paddingHorizontal: 0, overflow: 'hidden', marginBottom: spacing.l },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
  },
  toolDivider: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  toolIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.s + 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { flex: 1 },
  toolLabel: { color: colors.text, fontFamily: fonts.display, fontSize: 14.5, fontWeight: '600' },
  toolSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
