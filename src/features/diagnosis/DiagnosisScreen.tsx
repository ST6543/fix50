/** Diagnose tab — de belangrijkste ingang: hero-metrics, activiteit en snelle chips. */
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Button, Card, Chip, Eyebrow, IconTile, MetricCard, SectionTitle, StatTile } from '@/components/ui';
import { MiniBarChart } from '@/components/charts';
import { CountUp, FadeInView } from '@/components/motion';
import { ChatIcon, MotoIcon, TimerIcon, TrendingUpIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import { CHAT_QUICK_ACTIONS } from '@/constants/branding';
import * as chatService from '@/services/chat';
import { activityLast7Days, timeAgo } from '@/lib/format';
import { colors, fonts, spacing, typography } from '@/theme';
import type { ChatSession } from '@/types';

type Nav = AppNav;

function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function DiagnosisScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  const [sessions, setSessions] = useState<ChatSession[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      chatService
        .listSessions()
        .then(setSessions)
        .catch(() => setSessions([]));
    }, []),
  );

  const loaded = sessions !== null;
  const total = sessions?.length ?? 0;
  const weekActivity = sessions ? activityLast7Days(sessions, (s) => s.updated_at) : [];

  function openChat(seed?: string) {
    navigation.navigate('ChatDetail', seed ? { seedMessage: seed } : undefined);
  }

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <FadeInView>
            <Eyebrow>Stap voor stap storingshulp</Eyebrow>
            <Text style={typography.title}>Diagnose-assistent</Text>
            <Text style={styles.sub}>
              Beschrijf in gewone woorden wat er mis is. Bijvoorbeeld: "Mijn AM6 start wel maar valt meteen uit."
            </Text>
          </FadeInView>

          {/* Hero-metric: totaal aantal diagnoses, telt op bij binnenkomst */}
          <FadeInView index={1}>
            <MetricCard
              label="Diagnoses tot nu toe"
              value={loaded ? <CountUp value={total} /> : '—'}
              caption={
                sessions && sessions[0]
                  ? `Laatste activiteit: ${timeAgo(sessions[0].updated_at)}`
                  : loaded
                    ? 'Nog geen gesprekken gestart'
                    : undefined
              }
              style={styles.hero}
            />
          </FadeInView>

          {/* Stat-tiles: echte cijfers uit de chatgeschiedenis */}
          <FadeInView index={2}>
            <View style={styles.statRow}>
              <StatTile icon={ChatIcon} label="Gesprekken" value={total} tone="primary" />
              <StatTile
                icon={TrendingUpIcon}
                label="Deze week"
                value={weekActivity.reduce((a, d) => a + d.value, 0)}
                tone="info"
              />
              <StatTile
                icon={TimerIcon}
                label="Deze maand"
                value={sessions ? sessions.filter((s) => isThisMonth(s.updated_at)).length : 0}
                tone="neutral"
              />
            </View>
          </FadeInView>

          {/* 7-daagse activiteit */}
          <FadeInView index={3}>
            <SectionTitle>Activiteit — laatste 7 dagen</SectionTitle>
            <Card style={styles.chartCard}>
              {sessions && sessions.length > 0 ? (
                <MiniBarChart data={weekActivity} />
              ) : loaded ? (
                <Text style={styles.hint}>Nog geen activiteit deze week.</Text>
              ) : null}
            </Card>
          </FadeInView>

          {/* Scooter-context */}
          <FadeInView index={4}>
            {activeScooter ? (
              <Card style={styles.scooterCard}>
                <View style={styles.scooterRow}>
                  <IconTile tone="primary">
                    <MotoIcon size={20} color={colors.primary} />
                  </IconTile>
                  <View style={styles.scooterText}>
                    <Text style={styles.scooterLabel}>Analyseren bij</Text>
                    <Text style={styles.scooterName}>
                      {activeScooter.name}
                      {activeScooter.engine_type ? ` · ${activeScooter.engine_type}` : ''}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : (
              <Card style={styles.scooterCard}>
                <Text style={styles.scooterLabelOnly}>
                  Geen scooter geselecteerd — diagnose werkt beter met je bloktype.
                </Text>
              </Card>
            )}
          </FadeInView>

          <FadeInView index={5}>
            <Button
              label="Chat openen"
              icon={<ChatIcon size={16} color={colors.onPrimary} />}
              onPress={() => openChat()}
              style={{ marginTop: spacing.m }}
            />
          </FadeInView>

          <FadeInView index={6}>
            <Text style={styles.chipsTitle}>Of tik op een veelvoorkomend probleem:</Text>
            <View style={styles.chipsWrap}>
              {CHAT_QUICK_ACTIONS.map((c) => (
                <Chip key={c} label={c} onPress={() => openChat(c)} />
              ))}
            </View>
          </FadeInView>

          <FadeInView index={7}>
            <Card onPress={() => navigation.navigate('ChatHistory')} style={{ marginTop: spacing.m }}>
              <Text style={styles.historyTitle}>Gesprekken bekijken</Text>
              <Text style={styles.historySub}>Vorige diagnoses opnieuw lezen of verwijderen</Text>
            </Card>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  sub: { color: colors.textMuted, marginTop: spacing.xs, lineHeight: 20 },
  hero: { marginTop: spacing.xl },
  statRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  chartCard: { paddingVertical: spacing.l },
  hint: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.l },
  scooterCard: { marginTop: spacing.xl },
  scooterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  scooterText: { flex: 1 },
  scooterLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 2 },
  scooterName: { color: colors.text, fontFamily: fonts.display, fontWeight: '700', fontSize: 16 },
  scooterLabelOnly: { color: colors.textMuted, fontSize: 13 },
  chipsTitle: {
    color: colors.textMuted,
    fontFamily: fonts.display,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.s,
    textTransform: 'uppercase' as const,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  historyTitle: { color: colors.text, fontWeight: '700' },
  historySub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
