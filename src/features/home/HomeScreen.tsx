/** Home-dashboard — persoonlijke begroeting, scooter-hero, signalen, verwachting en sprint. */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { AppNav, TabNav } from '@/navigation/types';

import { Badge, Card, Eyebrow, IconTile, SectionTitle, SkeletonScreen } from '@/components/ui';
import { estimateCurrentKm, kmAnchorLabel } from '@/lib/km-estimate';
import { SpeedChart } from '@/components/charts';
import { FadeInView } from '@/components/motion';
import { notifyDeterioration } from '@/services/notifications';
import { ChevronRightIcon, GaugeIcon, MotoIcon, WarningIcon } from '@/components/icons';
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
import { formatKmShort, longDateLabel, timeAgo } from '@/lib/format';
import { colors, fonts, layout, radii, spacing, typography } from '@/theme';
import type { MaintenanceReminder, PerformanceRun, WeekTask } from '@/types';

type Nav = AppNav;

/** Begroeting op basis van het uur van de dag — geen data, puur presentatie. */
function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

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
            // Fase C: push bij verslechtering — waarschuwingssignalen → in-app melding
            // (best-effort, max 1× per week per signaal; stil bij fouten/offline).
            notifyDeterioration(activeScooter.id, computedInsights).catch(() => undefined);
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

  if (scootersLoading || loading) return <SkeletonScreen />;

  const now = new Date();
  const estimate = activeScooter ? estimateCurrentKm(activeScooter) : null;
  const anchor = estimate ? kmAnchorLabel(estimate.daysSinceUpdate) : null;
  const overdue = weekTasks.filter((t) => t.overdue);
  const firstTask = weekTasks[0];
  const initial = (profile?.display_name ?? 'F').charAt(0).toUpperCase();
  const firstName = profile?.display_name?.trim().split(/\s+/)[0] ?? null;
  const hasRisk = insights.some((i) => i.severity === 'risico');
  const openTasks = weekTasks.length;

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Kop met begroeting — het eerste wat je ziet is persoonlijk, niet je scooter. */}
        <View style={styles.topbar}>
          <View style={styles.topbarText}>
            <Text style={styles.today} numberOfLines={1}>
              {longDateLabel(now)}
            </Text>
            <Text style={styles.greeting} numberOfLines={2}>
              {greetingFor(now)}
              {firstName ? `, ${firstName}` : ''}
            </Text>
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

        {/* Scooter-hero met kilometerstand en de eerstvolgende actie */}
        {activeScooter ? (
          <FadeInView>
            <Card style={styles.hero}>
              <View style={styles.heroHead}>
                <IconTile tone="primary" size={42} radius={13}>
                  <MotoIcon size={21} color={colors.primary} />
                </IconTile>
                <View style={styles.heroHeadText}>
                  <Text style={typography.eyebrowBrand} numberOfLines={1}>
                    {activeScooter.engine_type ?? 'Setup'}
                  </Text>
                  <Text style={styles.heroTitle} numberOfLines={1}>
                    {[activeScooter.brand, activeScooter.model].filter(Boolean).join(' ') ||
                      activeScooter.name}
                  </Text>
                </View>
                <Badge
                  label={overdue.length > 0 ? `${overdue.length} te laat` : 'In orde'}
                  tone={overdue.length > 0 ? 'danger' : 'success'}
                  dot
                />
              </View>

              <View style={styles.kmRow}>
                <View style={styles.kmBlock}>
                  <Text style={typography.eyebrow}>Kilometerstand</Text>
                  <View style={styles.heroValueRow}>
                    <Text style={typography.hero} numberOfLines={1} adjustsFontSizeToFit>
                      {estimate ? formatKmShort(estimate.estimatedKm) : '—'}
                    </Text>
                    <Text style={styles.heroUnit}>km</Text>
                  </View>
                  <Text style={styles.heroEstimate} numberOfLines={2}>
                    {estimate?.isEstimated
                      ? `± geschat · ${anchor ?? 'op basis van je weekgemiddelde'}`
                      : (anchor ?? 'nog niet bijgewerkt')}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate(
                      'EditScooter',
                      activeScooter ? { scooterId: activeScooter.id } : undefined,
                    )
                  }
                  style={({ pressed }) => [styles.kmAction, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.kmActionLabel}>Bijwerken</Text>
                </Pressable>
              </View>

              <View style={styles.heroFooter}>
                <View style={styles.heroFooterCell}>
                  <Text style={styles.heroFooterValue}>{openTasks}</Text>
                  <Text style={styles.heroFooterLabel}>open taken</Text>
                </View>
                <View style={styles.heroFooterDivider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={firstTask ? `${firstTask.item.name} openen` : 'Onderhoud openen'}
                  disabled={!firstTask}
                  onPress={() =>
                    firstTask
                      ? navigation.navigate('MaintenanceDetail', { scheduleId: firstTask.schedule.id })
                      : tabNav.navigate('Werkplaats', { segment: 'onderhoud' })
                  }
                  style={styles.nextTask}
                >
                  <View style={styles.nextTaskText}>
                    <Text style={typography.eyebrow}>Volgende stap</Text>
                    <Text style={styles.nextTaskTitle} numberOfLines={1}>
                      {firstTask ? firstTask.item.name : 'Alles is bij'}
                    </Text>
                  </View>
                  {firstTask ? (
                    <Badge label={firstTask.dueLabel} tone={firstTask.overdue ? 'danger' : 'warning'} />
                  ) : (
                    <Badge label="Niets gepland" tone="neutral" />
                  )}
                  <ChevronRightIcon size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </Card>
          </FadeInView>
        ) : (
          <FadeInView>
            <Card style={styles.emptyCard}>
              <IconTile tone="primary" size={48} radius={15}>
                <MotoIcon size={23} color={colors.primary} />
              </IconTile>
              <Text style={styles.emptyTitle}>Voeg je brommer toe</Text>
              <Text style={styles.emptySub}>
                Met je scooter erin zie je hieronder kilometerstand, onderhoud en metingen.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('Scooters')}
                style={({ pressed }) => [styles.emptyAction, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.emptyActionLabel}>Mijn scooters</Text>
                <ChevronRightIcon size={15} color={colors.onPrimary} />
              </Pressable>
            </Card>
          </FadeInView>
        )}

        {/* Noodknop: directe diagnose (alleen als er geen risico-signalen zijn) */}
        {!hasRisk ? (
          <FadeInView index={1}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('ChatDetail', { seedMessage: 'Mijn scooter start niet' })
              }
              style={({ pressed }) => [styles.emergency, pressed && { opacity: 0.85 }]}
            >
              <IconTile tone="warning" size={34} radius={11}>
                <WarningIcon size={17} color={colors.warning} />
              </IconTile>
              <View style={styles.emergencyText}>
                <Text style={styles.emergencyTitle}>Mijn scooter start niet</Text>
                <Text style={styles.emergencySub}>Directe check: vonk, brandstof & compressie</Text>
              </View>
              <ChevronRightIcon size={17} color={colors.textMuted} />
            </Pressable>
          </FadeInView>
        ) : null}

        {/* Slimme signalen — fase A + B van het AI-plan: deterministische checks,
            verwoord door de AI wanneer die beschikbaar is (stille fallback). */}
        {displayInsights.length > 0 ? (
          <FadeInView index={2}>
            <SectionTitle>Slimme signalen</SectionTitle>
            <Card style={styles.signals}>
              {displayInsights.map((ins, idx) => (
                <Pressable
                  key={`${ins.kind}-${idx}`}
                  accessibilityRole="button"
                  onPress={() => handleSignalPress(ins)}
                  style={({ pressed }) => [
                    styles.signalRow,
                    idx < displayInsights.length - 1 && styles.signalRowBorder,
                    pressed && { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <View
                    style={[
                      styles.signalDot,
                      ins.severity === 'risico' && styles.signalDotDanger,
                      ins.severity === 'let op' && styles.signalDotWarn,
                      ins.severity === 'info' && styles.signalDotInfo,
                    ]}
                  />
                  <View style={styles.signalBody}>
                    <Text style={styles.signalTitle} numberOfLines={2}>
                      {ins.title}
                    </Text>
                    <Text style={styles.signalDetail} numberOfLines={3}>
                      {ins.detail}
                    </Text>
                    <Text style={styles.signalEvidence} numberOfLines={1}>
                      {ins.evidence}
                    </Text>
                  </View>
                  <ChevronRightIcon size={16} color={colors.textSubtle} />
                </Pressable>
              ))}
            </Card>
          </FadeInView>
        ) : null}

        {/* Voorspelling: over hoeveel weken is onderhoud verwacht */}
        {forecast.length > 0 ? (
          <FadeInView index={3}>
            <Card style={styles.forecast}>
              <View style={styles.forecastHead}>
                <IconTile tone="neutral" size={34} radius={11}>
                  <GaugeIcon size={17} color={colors.textMuted} />
                </IconTile>
                <View style={styles.forecastHeadText}>
                  <Text style={[typography.eyebrow, { marginBottom: 2 }]}>Verwachting</Text>
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
                    onPress={() =>
                      navigation.navigate('MaintenanceDetail', { scheduleId: f.schedule.id })
                    }
                    style={({ pressed }) => [styles.forecastRow, pressed && { opacity: 0.7 }]}
                  >
                    <Text
                      style={[styles.forecastName, f.overdue && styles.forecastOverdue]}
                      numberOfLines={1}
                    >
                      {f.item.name}
                    </Text>
                    <Badge
                      label={f.dueLabel}
                      tone={
                        f.overdue
                          ? 'danger'
                          : f.weeksUntilDue !== null && f.weeksUntilDue <= 2
                            ? 'warning'
                            : 'neutral'
                      }
                    />
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => tabNav.navigate('Werkplaats', { segment: 'onderhoud' })}
                style={({ pressed }) => [styles.forecastMore, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.forecastMoreLabel}>Volledig onderhoudsschema</Text>
                <ChevronRightIcon size={14} color={colors.primary} />
              </Pressable>
            </Card>
          </FadeInView>
        ) : null}

        {/* Sprint-kaart met curve */}
        {lastRun ? (
          <FadeInView index={4}>
            <Card style={styles.sprint}>
              <View style={styles.sprintHead}>
                <View style={styles.sprintHeadText}>
                  <Eyebrow>Sprintmeting</Eyebrow>
                  <Text style={styles.sprintTitle}>0–50 km/u</Text>
                  <Text style={styles.sprintMeta} numberOfLines={1}>
                    {timeAgo(lastRun.created_at)} · top{' '}
                    {lastRun.max_speed_kmh != null
                      ? `${Math.round(lastRun.max_speed_kmh)} km/u`
                      : '—'}
                  </Text>
                </View>
                <View style={styles.sprintValueRow}>
                  <Text style={styles.sprintValue}>
                    {lastRun.t0_50_s != null ? lastRun.t0_50_s.toFixed(1) : '--.-'}
                  </Text>
                  <Text style={styles.sprintUnit}>s</Text>
                </View>
              </View>
              <View style={styles.sprintChart}>
                {lastRun.points && lastRun.points.length > 4 ? (
                  <SpeedChart points={lastRun.points} height={90} />
                ) : (
                  <Text style={styles.sprintHint}>Te weinig punten voor een curve.</Text>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('PerformanceHistory')}
                style={({ pressed }) => [styles.sprintLink, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.sprintLinkLabel}>Alle metingen</Text>
                <ChevronRightIcon size={14} color={colors.textMuted} />
              </Pressable>
            </Card>
          </FadeInView>
        ) : null}

        {reminders.length > 0 ? (
          <FadeInView index={5}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Notifications')}
              style={({ pressed }) => [styles.reminderRow, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.reminderText}>
                {reminders.length === 1
                  ? '1 openstaande herinnering'
                  : `${reminders.length} openstaande herinneringen`}
              </Text>
              <ChevronRightIcon size={15} color={colors.textMuted} />
            </Pressable>
          </FadeInView>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxl + spacing.l,
    gap: 14,
    maxWidth: layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  // Kop
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
    marginBottom: spacing.xs,
  },
  topbarText: { flex: 1 },
  today: {
    color: colors.textSubtle,
    fontFamily: fonts.display,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  greeting: {
    fontFamily: fonts.displayBold,
    fontSize: 25,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 15, fontWeight: '700', color: colors.primary },

  // Hero
  hero: { gap: spacing.l },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  heroHeadText: { flex: 1 },
  heroTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  kmRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.m },
  kmBlock: { flex: 1 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  heroUnit: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, fontWeight: '500' },
  heroEstimate: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  kmAction: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.m + 2,
    paddingVertical: 7,
    marginBottom: 18,
  },
  kmActionLabel: { color: colors.primary, fontFamily: fonts.display, fontSize: 12, fontWeight: '600' },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  heroFooterCell: { minWidth: 58 },
  heroFooterValue: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroFooterLabel: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },
  heroFooterDivider: { width: 1, height: 30, backgroundColor: colors.borderSoft },
  nextTask: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 44 },
  nextTaskText: { flex: 1 },
  nextTaskTitle: {
    fontFamily: fonts.display,
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },

  // Lege staat
  emptyCard: { alignItems: 'center', gap: spacing.s, paddingVertical: spacing.xl },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.s,
  },
  emptySub: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.l + 2,
    paddingVertical: 10,
    marginTop: spacing.s,
  },
  emptyActionLabel: { color: colors.onPrimary, fontFamily: fonts.display, fontSize: 13, fontWeight: '600' },

  // Noodhulp
  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.22)',
    borderRadius: radii.l,
    padding: spacing.m + 2,
  },
  emergencyText: { flex: 1 },
  emergencyTitle: { fontFamily: fonts.display, fontSize: 14.5, fontWeight: '600', color: colors.text },
  emergencySub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },

  // Slimme signalen
  signals: { paddingVertical: spacing.xs, paddingHorizontal: 0, overflow: 'hidden' },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.m,
    paddingVertical: spacing.m + 2,
    paddingHorizontal: layout.cardPadding,
  },
  signalRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  signalDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: colors.textMuted },
  signalDotDanger: { backgroundColor: colors.danger },
  signalDotWarn: { backgroundColor: colors.warning },
  signalDotInfo: { backgroundColor: colors.info },
  signalBody: { flex: 1, gap: 2 },
  signalTitle: { fontFamily: fonts.display, fontSize: 14.5, fontWeight: '600', color: colors.text },
  signalDetail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  signalEvidence: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11, marginTop: 1 },

  // Verwachting
  forecast: { gap: spacing.m },
  forecastHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  forecastHeadText: { flex: 1 },
  forecastTitle: { fontFamily: fonts.display, fontSize: 14.5, fontWeight: '600', color: colors.text },
  forecastList: { gap: 0 },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
    paddingVertical: spacing.s + 2,
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  forecastName: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  forecastOverdue: { color: colors.danger, fontFamily: fonts.bodySemiBold },
  forecastMore: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  forecastMoreLabel: { color: colors.primary, fontFamily: fonts.display, fontSize: 12.5, fontWeight: '600' },

  // Sprint
  sprint: { gap: spacing.m },
  sprintHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.s },
  sprintHeadText: { flex: 1 },
  sprintTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
  },
  sprintMeta: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  sprintValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  sprintValue: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.6,
  },
  sprintUnit: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  sprintChart: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.m,
    padding: spacing.m,
  },
  sprintHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.l,
  },
  sprintLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 30 },
  sprintLinkLabel: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 12, fontWeight: '600' },

  // Herinneringen
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.s,
  },
  reminderText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5 },
});
