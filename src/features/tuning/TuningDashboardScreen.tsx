/** Tuning-dashboard — ontwikkeling van topsnelheid en acceleratie over setups en testritten. */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Card, EmptyState, Loading, PressableTile, SectionTitle, StatTile } from '@/components/ui';
import { ClipboardIcon, FlagIcon, GaugeIcon, MotoIcon, ScaleIcon, SlidersIcon } from '@/components/icons';
import { MiniBarChart, TrendChart } from '@/components/charts';
import { FadeInView } from '@/components/motion';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import * as perfService from '@/services/performance';
import {
  accelTrend,
  bestT0_50,
  bestTopSpeed,
  development,
  setupProgress,
  speedTrend,
  type RunSlice,
} from '@/lib/tuning-progress';
import { formatSeconds, formatSpeed } from '@/lib/format';
import { colors, fonts, spacing } from '@/theme';
import type { PerformanceRun, TuningSetup } from '@/types';

type Nav = AppNav;

export default function TuningDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  const [setups, setSetups] = useState<TuningSetup[]>([]);
  const [runs, setRuns] = useState<PerformanceRun[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!activeScooter) {
        setLoading(false);
        return;
      }
      Promise.all([
        tuningService.listSetups(activeScooter.id).catch(() => [] as TuningSetup[]),
        perfService.listRuns(100, activeScooter.id).catch(() => [] as PerformanceRun[]),
      ])
        .then(([s, r]) => {
          setSetups(s);
          setRuns(r);
        })
        .finally(() => setLoading(false));
    }, [activeScooter]),
  );

  if (loading) return <Loading label="Dashboard laden…" />;

  if (!activeScooter) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          icon={MotoIcon}
          title="Nog geen scooter"
          subtitle="Voeg eerst je brommer of scooter toe; daarna volgt hier de ontwikkeling."
          actionLabel="Naar mijn scooters"
          onAction={() => navigation.navigate('Scooters')}
        />
      </SafeAreaView>
    );
  }

  const slices: RunSlice[] = runs.map((r) => ({
    id: r.id,
    started_at: r.started_at,
    max_speed_kmh: r.max_speed_kmh,
    t0_50_s: r.t0_50_s,
    setup_id: r.setup_id,
    gps_quality: r.gps_quality,
  }));

  const speed = speedTrend(slices);
  const accel = accelTrend(slices);
  const speedDelta = development(speed);
  const accelDelta = development(accel);
  const progress = setupProgress(setups, slices).sort((a, b) => b.runs - a.runs);
  const activeSetup = setups.find((s) => s.is_active) ?? null;
  const tested = progress.filter((p) => p.runs > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.hero}>
          <Text style={styles.eyebrow}>TUNING DASHBOARD</Text>
          <Text style={styles.heroTitle}>{activeScooter.name || activeScooter.model || 'Mijn scooter'}</Text>
          <Text style={styles.heroSub}>
            {activeSetup ? `Actieve opstelling: ${activeSetup.name}` : 'Nog geen actieve opstelling'}
          </Text>
          <View style={styles.statsGrid}>
            <StatTile label="TOPSNELHEID" value={formatSpeed(bestTopSpeed(slices))} icon={GaugeIcon} />
            <StatTile label="BESTE 0–50" value={formatSeconds(bestT0_50(slices), 1)} icon={FlagIcon} />
            <StatTile label="METINGEN" value={String(runs.length)} icon={ClipboardIcon} />
          </View>
        </Card>

        <SectionTitle>Ontwikkeling</SectionTitle>
        <Card style={styles.chartCard}>
          <View style={styles.chartHead}>
            <Text style={styles.chartTitle}>Topsnelheid per testrit</Text>
            {speedDelta !== null ? (
              <Badge
                label={`${speedDelta > 0 ? '+' : ''}${speedDelta.toFixed(1)} km/u`}
                tone={speedDelta > 0 ? 'success' : speedDelta < 0 ? 'warning' : 'neutral'}
              />
            ) : null}
          </View>
          {speed.length >= 2 ? (
            <TrendChart data={speed} height={130} />
          ) : (
            <Text style={styles.hint}>
              Minimaal twee metingen nodig voor een trend. Rijd een GPS-test met een opgeslagen opstelling.
            </Text>
          )}
          <Text style={styles.chartNote}>Alleen runs met voldoende GPS-kwaliteit; geen voorspellingen.</Text>
        </Card>

        <Card style={styles.chartCard}>
          <View style={styles.chartHead}>
            <Text style={styles.chartTitle}>0–50 tijd per testrit</Text>
            {accelDelta !== null ? (
              <Badge
                label={`${accelDelta > 0 ? '+' : ''}${accelDelta.toFixed(1)} s`}
                tone={accelDelta < 0 ? 'success' : accelDelta > 0 ? 'warning' : 'neutral'}
              />
            ) : null}
          </View>
          {accel.length >= 2 ? (
            <TrendChart data={accel} height={130} />
          ) : (
            <Text style={styles.hint}>Nog te weinig runs met een 0–50 tijd.</Text>
          )}
          <Text style={styles.chartNote}>Lager is beter. Alleen gemeten waarden.</Text>
        </Card>

        <SectionTitle>Per opstelling</SectionTitle>
        {tested.length > 0 ? (
          <Card style={styles.chartCard}>
            <Text style={styles.chartTitle}>Gemeten topsnelheid per opstelling</Text>
            <MiniBarChart
              data={tested.map((p) => ({ label: p.name.slice(0, 8), value: p.bestTop ?? 0 }))}
              height={110}
            />
          </Card>
        ) : null}
        {progress.length === 0 ? (
          <Card>
            <Text style={styles.hint}>
              Sla eerst een testopstelling op in de Afstelhulp. Daarna zie je hier per opstelling hoeveel runs er zijn en wat
              de beste meting was.
            </Text>
          </Card>
        ) : (
          progress.map((p, i) => (
            <FadeInView key={p.setupId} index={i}>
              <Card style={styles.setupCard} onPress={() => navigation.navigate('SetupComparison')}>
                <View style={styles.setupHead}>
                  <Text style={styles.setupName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Badge
                    label={p.runs === 0 ? 'nog niet getest' : `${p.runs} run${p.runs === 1 ? '' : 's'}`}
                    tone={p.runs === 0 ? 'neutral' : 'success'}
                  />
                </View>
                <View style={styles.setupStats}>
                  <Text style={styles.setupStat}>Top: {p.bestTop === null ? '—' : `${p.bestTop} km/u`}</Text>
                  <Text style={styles.setupStat}>Gem.: {p.avgTop === null ? '—' : `${p.avgTop} km/u`}</Text>
                  <Text style={styles.setupStat}>0–50: {formatSeconds(p.bestT0_50, 1)}</Text>
                </View>
              </Card>
            </FadeInView>
          ))
        )}

        <SectionTitle>Naar onderdeel</SectionTitle>
        <View style={styles.tilesRow}>
          <PressableTile
            icon={<SlidersIcon size={18} color={colors.primary} />}
            title="Afstelhulp"
            sub="Carburateur, CVT en vertanding"
            onPress={() => navigation.navigate('Afstel')}
          />
          <PressableTile
            icon={<ScaleIcon size={18} color={colors.primary} />}
            title="Vergelijken"
            sub="Voorspelling en ijking"
            onPress={() => navigation.navigate('SetupComparison')}
          />
        </View>
        <View style={styles.tilesRow}>
          <PressableTile
            icon={<FlagIcon size={18} color={colors.primary} />}
            title="GPS-test"
            sub="Nieuwe meting starten"
            onPress={() => navigation.navigate('PerformanceRun')}
          />
          <PressableTile
            icon={<GaugeIcon size={18} color={colors.primary} />}
            title="Metingen"
            sub="Alle testritten"
            onPress={() => navigation.navigate('PerformanceHistory')}
          />
        </View>
        <PressableTile
          icon={<ClipboardIcon size={18} color={colors.primary} />}
          title="Wijzigingslog"
          sub="Elke aanpassing met resultaat"
          onPress={() => navigation.navigate('TuningHistory')}
          style={styles.wideTile}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  hero: { marginBottom: spacing.m },
  eyebrow: { color: colors.primary, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '800', fontFamily: fonts.display, marginTop: 2 },
  heroSub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  statsGrid: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  chartCard: { marginBottom: spacing.m },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  chartTitle: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  chartNote: { color: colors.textSubtle, fontSize: 11, marginTop: spacing.s },
  hint: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18 },
  setupCard: { marginBottom: spacing.s },
  setupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  setupName: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  setupStats: { flexDirection: 'row', gap: spacing.m, marginTop: spacing.s, flexWrap: 'wrap' },
  setupStat: { color: colors.textMuted, fontSize: 12.5 },
  tilesRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.s },
  wideTile: { marginBottom: spacing.s },
});
