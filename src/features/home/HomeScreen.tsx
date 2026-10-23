/** Home-dashboard — Stitch-stijl: scooter-hero, noodknop, gereedschapsgrid, sprintkaart. */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { AppNav, TabNav } from '@/navigation/types';

import { Badge, Card, Eyebrow, IconTile, SectionTitle } from '@/components/ui';
import { estimateCurrentKm, kmAnchorLabel } from '@/lib/km-estimate';
import { SpeedChart } from '@/components/charts';
import { FadeInView } from '@/components/motion';
import {
  ChevronRightIcon,
  GaugeIcon,
  MotoIcon,
  WarningIcon,
  WrenchIcon,
} from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useScooters } from '@/hooks/useScooters';
import {
  listOpenReminders,
  buildWeekOverview,
  buildWeekForecast,
  listMaintenanceItems,
  type WeekForecastItem,
} from '@/services/maintenance';
import { listRuns } from '@/services/performance';
import { computeFuelStats, listFuelLogs } from '@/services/fuel';
import { listSetups } from '@/services/tuning';
import { buildInsights, applyAiVerwoording, type Insight, type AiVerwoordingItem } from '@/lib/insights';
import { fetchAiVerwoording } from '@/services/ai-insights';
import { formatKmShort, timeAgo } from '@/lib/format';
import { colors, fonts, spacing, typography } from '@/theme';
import type { MaintenanceReminder, PerformanceRun, WeekTask } from '@/types';

type Nav = AppNav;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const tabNav = useNavigation<TabNav>();
  const { profile } = useAuth();
  const { activeScooter, loading: scootersLoading } = useScooters();
  const [weekTasks, setWeekTasks] = useState<WeekTask[]>([]);
  const [forecast, setForecast] = useState<WeekForecastItem[]>([]);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [lastRun, setLastRun] = useState<PerformanceRun | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  /** Fase B: AI-verwoording per signaal-index; null = vaste teksten tonen. */
  const [aiVer, setAiVer] = useState<AiVerwoordingItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          if (activeScooter) {
            const [items, schedules, rems, fuelLogs, setups, runs] = await Promise.all([
              listMaintenanceItems(),
              import('@/services/maintenance').then((m) => m.listSchedules(activeScooter.id)),
              listOpenReminders(activeScooter.id),
              import('@/services/fuel').then((f) => f.listFuelLogs(activeScooter.id, 50)),
              import('@/services/tuning').then((t) => t.listSetups(activeScooter.id)),
              listRuns(50, activeScooter?.id),
            ]);
            if (!alive) return;
            setLastRun(runs[0] ?? null);
            const estimate = estimateCurrentKm(activeScooter);
            setWeekTasks(
              buildWeekOverview(schedules, items, estimate.estimatedKm).filter(
                (t) => t.overdue || t.dueThisWeek,
              ),
            );
            const forecastFull = buildWeekForecast(
              schedules,
              items,
              estimate.estimatedKm,
              activeScooter.avg_km_per_week,
            );
            setForecast(forecastFull.slice(0, 4));
            setReminders(rems);
            // Slimme signalen (fase A van het AI-plan): deterministische checks op eigen data.
            const computedInsights = buildInsights({
              fuel: computeFuelStats(fuelLogs),
              forecast: forecastFull,
              runs,
              setupNames: Object.fromEntries(setups.map((s) => [s.id, s.name])),
            });
            setInsights(computedInsights);
            // Fase B: AI-verwoording (stil — offline/rate-limit geeft gewoon de vaste teksten).
            fetchAiVerwoording(activeScooter?.id ?? null, computedInsights)
              .then((texts) => {
                if (alive && texts) setAiVer(texts);
              })
              .catch(() => undefined);
          } else {
            setWeekTasks([]);
            setForecast([]);
            setReminders([]);
            setInsights([]);
            setAiVer(null);
            setLastRun(null);
          }
        } catch {
          // Offline: dashboard werkt met wat er is
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [activeScooter]),
  );

  const displayInsights = useMemo(
    () => applyAiVerwoording(insights, aiVer),
    [insights, aiVer],
  );

  if (scootersLoading || loading) return <Loading />;

  const estimate = activeScooter ? estimateCurrentKm(activeScooter) : null;
  const anchor = estimate ? kmAnchorLabel(estimate.daysSinceUpdate) : null;
  const overdue = weekTasks.filter((t) => t.overdue);
  const firstTask = weekTasks[0];
  const initial = (profile?.display_name ?? 'F').charAt(0).toUpperCase();
  const hasRisk = insights.some((i) => i.severity === 'risico');

  /** Doorklik: elk signaal opent het scherm waar je actie kunt ondernemen. */
  function handleSignalPress(ins: Insight) {
    switch (ins.kind) {
      case 'onderhoud':
        tabNav.navigate('Werkplaats', { segment: 'onderhoud' });
        break;
      case 'verbruik':
        tabNav.navigate('Garage', { segment: 'tankbeurten' });
        break;
      case 'performance':
      case 'tuning':
        tabNav.navigate('Garage', { segment: 'tuning' });
        break;
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Topbar */}
        <View style={styles.topbar}>
          <View style={styles.topbarLeft}>
            <IconTile tone="primary" size={36} radius={10}>
              <MotoIcon size={19} color={colors.primary} />
            </IconTile>
            <View>
              <View style={styles.wordmarkRow}>
                <Text style={styles.wordmark}>
                  Fix<Text style={styles.wordmarkAccent}>50</Text>
                </Text>
                <View style={styles.dot} />
              </View>
              <Text style={styles.topbarSub} numberOfLines={1}>
                {activeScooter ? activeScooter.name : 'Geen scooter gekozen'}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Account openen"
            onPress={() => navigation.navigate('Account')}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </Pressable>
        </View>

        {/* Scooter-hero met telemetrie-grid */}
        <FadeInView>
          <Card style={styles.hero}>
            <View style={styles.heroHead}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.eyebrowBrand, { marginBottom: 2 }]} numberOfLines={1}>
                  {activeScooter?.engine_type ?? 'Setup'}
                </Text>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {activeScooter ? [activeScooter.brand, activeScooter.model].filter(Boolean).join(' ') || activeScooter.name : 'Voeg je brommer toe'}
                </Text>
              </View>
              <Badge label={overdue.length > 0 ? `${overdue.length} te laat` : 'In orde'} tone={overdue.length > 0 ? 'danger' : 'neutral'} />
            </View>
            <View style={styles.heroGrid}>
              <View style={styles.heroCell}>
                <Text style={typography.eyebrow}>Kilometerstand</Text>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>
                    {estimate ? formatKmShort(estimate.estimatedKm) : '—'}
                  </Text>
                  <Text style={styles.heroUnit}>km</Text>
                </View>
                <Text style={styles.heroEstimate} numberOfLines={1}>
                  {estimate?.isEstimated
                    ? `± geschat · ${anchor ?? 'op basis van je weekgemiddelde'}`
                    : (anchor ?? 'nog niet bijgewerkt')}
                </Text>
                <Text
                  style={styles.heroLink}
                  onPress={() => navigation.navigate('EditScooter', activeScooter ? { scooterId: activeScooter.id } : undefined)}
                  accessibilityRole="button"
                >
                  Update km
                </Text>
              </View>
              <View style={styles.heroCell}>
                <Text style={typography.eyebrow}>Onderhoud</Text>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>{overdue.length + weekTasks.filter((t) => !t.overdue).length}</Text>
                  <Text style={styles.heroUnit}>taken</Text>
                </View>
                <View style={styles.heroStatus}>
                  <View style={[styles.dot, { marginRight: 6 }]} />
                  <Text style={styles.heroStatusText}>
                    {overdue.length > 0 ? 'Actie vereist' : weekTasks.length > 0 ? 'Binnenkort' : 'Geen storingen'}
                  </Text>
                </View>
              </View>
            </View>
          </Card>
        </FadeInView>

        {/* Noodknop: directe diagnose (alleen als er geen risico-signalen zijn) */}
        {!hasRisk ? (
          <FadeInView index={1}>
            <Card onPress={() => navigation.navigate('ChatDetail', { seedMessage: 'Mijn scooter start niet' })} style={styles.emergency}>
              <IconTile tone="primary" size={40} radius={12}>
                <WarningIcon size={20} color={colors.primary} />
              </IconTile>
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyTitle}>Mijn scooter start niet</Text>
                <Text style={styles.emergencySub}>Directe check: vonk, brandstof & compressie</Text>
              </View>
              <ChevronRightIcon size={18} color={colors.textMuted} />
            </Card>
          </FadeInView>
        ) : null}

        {/* Slimme signalen — fase A + B van het AI-plan: deterministische checks,
            verwoord door de AI wanneer die beschikbaar is (stille fallback). */}
        {insights.length > 0 ? (
          <FadeInView index={2}>
            <SectionTitle>Slimme signalen</SectionTitle>
            <Card style={styles.signals}>
              {displayInsights.map((ins, idx) => (
                <Card
                  key={`${ins.kind}-${idx}`}
                  onPress={() => handleSignalPress(ins)}
                  style={[styles.signalRow, idx < insights.length - 1 && styles.signalRowBorder]}
                >
                  <View
                    style={[
                      styles.signalDot,
                      ins.severity === 'risico' && styles.signalDotDanger,
                      ins.severity === 'let op' && styles.signalDotWarn,
                      ins.severity === 'info' && styles.signalDotInfo,
                    ]}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.signalTitle}>{ins.title}</Text>
                    <Text style={styles.signalDetail}>{ins.detail}</Text>
                    <Text style={styles.signalEvidence} numberOfLines={1}>
                      {ins.evidence}
                    </Text>
                  </View>
                  <ChevronRightIcon size={16} color={colors.textMuted} />
                </Card>
              ))}
            </Card>
          </FadeInView>
        ) : null}

        {/* Voorspelling: over hoeveel weken is onderhoud verwacht */}
        {forecast.length > 0 ? (
          <FadeInView index={3}>
            <Card style={styles.forecast}>
              <View style={styles.forecastHead}>
                <IconTile tone="primary" size={36} radius={10}>
                  <GaugeIcon size={18} color={colors.primary} />
                </IconTile>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.eyebrowBrand, { marginBottom: 2 }]}>Verwachting</Text>
                  <Text style={styles.forecastTitle} numberOfLines={1}>
                    {activeScooter?.avg_km_per_week
                      ? `Bij ±${formatKmShort(activeScooter.avg_km_per_week)} km per week`
                      : 'Op basis van je intervallen'}
                  </Text>
                </View>
              </View>
              <View style={styles.forecastList}>
                {forecast.map((f) => (
                  <Pressable
                    key={f.schedule.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${f.item.name} openen`}
                    onPress={() => navigation.navigate('MaintenanceDetail', { scheduleId: f.schedule.id })}
                    style={styles.forecastRow}
                  >
                    <Text style={[styles.forecastName, f.overdue && styles.forecastOverdue]} numberOfLines={1}>
                      {f.item.name}
                    </Text>
                    <Badge label={f.dueLabel} tone={f.overdue ? 'danger' : f.weeksUntilDue !== null && f.weeksUntilDue <= 2 ? 'warning' : 'neutral'} />
                  </Pressable>
                ))}
              </View>
              <Text
                style={styles.forecastMore}
                onPress={() => tabNav.navigate('Werkplaats', { segment: 'onderhoud' })}
                accessibilityRole="button"
              >
                Volledig onderhoudsschema
              </Text>
            </Card>
          </FadeInView>
        ) : null}

        {/* Onderhoud-kaart */}
        {firstTask ? (
          <FadeInView index={4}>
            <Card style={styles.maintenance}>
              <View style={styles.maintenanceHead}>
                <IconTile tone="primary" size={36} radius={10}>
                  <WrenchIcon size={18} color={colors.primary} />
                </IconTile>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.eyebrowBrand, { marginBottom: 2 }]}>Onderhoud nodig</Text>
                  <Text style={styles.maintenanceTitle} numberOfLines={1}>
                    {firstTask.item.name}
                  </Text>
                </View>
                <Badge label={firstTask.dueLabel} tone={firstTask.overdue ? 'danger' : 'warning'} />
              </View>
              <View style={styles.maintenanceActions}>
                <Card
                  onPress={() => navigation.navigate('MaintenanceDetail', { scheduleId: firstTask.schedule.id })}
                  style={styles.miniBtn}
                >
                  <Text style={styles.miniBtnText}>Checklist</Text>
                  <ChevronRightIcon size={14} color={colors.text} />
                </Card>
                <Text
                  style={styles.laterBtn}
                  onPress={() => tabNav.navigate('Werkplaats', { segment: 'onderhoud' })}
                  accessibilityRole="button"
                >
                  Alles
                </Text>
              </View>
            </Card>
          </FadeInView>
        ) : null}

        {/* Sprint-kaart met curve */}
        {lastRun ? (
          <FadeInView index={5}>
            <Card style={styles.sprint}>
              <View style={styles.sprintHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.eyebrow, { marginBottom: 2 }]}>Sprintmeting</Text>
                  <Text style={styles.sprintTitle}>0–50 km/u sprint</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={styles.sprintValueRow}>
                    <Text style={styles.sprintValue}>{lastRun.t0_50_s != null ? lastRun.t0_50_s.toFixed(1) : '--.-'}</Text>
                    <Text style={styles.sprintUnit}>s</Text>
                  </View>
                  <Text style={styles.sprintTop}>
                    Top: <Text style={styles.sprintTopStrong}>{lastRun.max_speed_kmh != null ? `${Math.round(lastRun.max_speed_kmh)} km/u` : '—'}</Text>
                  </Text>
                </View>
              </View>
              <View style={styles.sprintChart}>
                {lastRun.points && lastRun.points.length > 4 ? (
                  <SpeedChart points={lastRun.points} height={90} />
                ) : (
                  <Text style={styles.sprintHint}>Te weinig punten voor een curve.</Text>
                )}
              </View>
            </Card>
          </FadeInView>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

function Loading() {
  return (
    <View style={styles.loadingWrap}>
      <Text style={styles.loadingText}>Dashboard laden…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl, gap: spacing.m },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { color: colors.textMuted, fontFamily: fonts.body },

  // Topbar
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  wordmarkAccent: { color: colors.primary },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  topbarSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.display, fontSize: 13, fontWeight: '600', color: colors.textMuted },

  // Hero
  hero: { padding: spacing.l },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.s },
  heroTitle: { fontFamily: fonts.displayBold, fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.3, marginTop: 2 },
  heroGrid: {
    flexDirection: 'row',
    gap: spacing.s,
    marginTop: spacing.m,
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  heroCell: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.m,
  },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 },
  heroValue: { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  heroUnit: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  heroEstimate: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11.5, marginTop: 3 },
  heroLink: { color: colors.primary, fontFamily: fonts.display, fontSize: 12, fontWeight: '600', marginTop: spacing.s },
  heroStatus: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.s },
  heroStatusText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },

  // Noodstrip
  emergency: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, borderColor: colors.primaryBorder },
  emergencyTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '600', color: colors.text },
  emergencySub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },

  // Slimme signalen
  signals: { gap: 0, paddingVertical: spacing.xs },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.m, paddingVertical: spacing.m + 2, paddingHorizontal: spacing.l, backgroundColor: 'transparent' },
  signalRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  signalDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: colors.textMuted },
  signalDotDanger: { backgroundColor: colors.danger },
  signalDotWarn: { backgroundColor: colors.warning },
  signalDotInfo: { backgroundColor: colors.info },
  signalTitle: { fontFamily: fonts.display, fontSize: 14.5, fontWeight: '600', color: colors.text },
  signalDetail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5 },
  signalEvidence: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },

  // Tools (verwijderd — gereedschaps-grid is weg; taken vind je via de tabs)

  // Voorspelling
  forecast: { gap: spacing.m },
  forecastHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  forecastTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '600', color: colors.text },
  forecastList: { gap: 2 },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
    paddingVertical: spacing.s + 2,
    minHeight: 44,
  },
  forecastName: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14.5 },
  forecastOverdue: { color: colors.danger, fontFamily: fonts.bodySemiBold },
  forecastMore: { color: colors.primary, fontFamily: fonts.display, fontSize: 12.5, fontWeight: '600', marginTop: spacing.xs },

  // Onderhoud
  maintenance: { gap: spacing.m },
  maintenanceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  maintenanceTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '600', color: colors.text },
  maintenanceActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    borderRadius: 10,
  },
  miniBtnText: { fontFamily: fonts.display, fontSize: 12, fontWeight: '600', color: colors.text },
  laterBtn: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },

  // Sprint
  sprint: { gap: spacing.m },
  sprintHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s },
  sprintTitle: { fontFamily: fonts.display, fontSize: 15, fontWeight: '600', color: colors.text },
  sprintValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  sprintValue: { fontFamily: fonts.displayBold, fontSize: 24, fontWeight: '700', color: colors.primary, letterSpacing: -0.4 },
  sprintUnit: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  sprintTop: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  sprintTopStrong: { color: colors.text, fontFamily: fonts.bodySemiBold, fontWeight: '600' },
  sprintChart: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.m,
  },
  sprintHint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', paddingVertical: spacing.l },
  footer: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.m, fontFamily: fonts.body },
});
