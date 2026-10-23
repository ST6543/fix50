/** Performance tab — Stitch GPS-meter: veiligheidsstrip, telemetry-bento, curve, logboek. */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, EmptyState, IconTile, Loading, SectionTitle } from '@/components/ui';
import { SpeedChart } from '@/components/charts';
import { FadeInView } from '@/components/motion';
import { AlertCircleIcon, FlagIcon, GaugeIcon, ShieldIcon, TimerIcon, TrendingUpIcon } from '@/components/icons';
import * as perfService from '@/services/performance';
import { useScooters } from '@/hooks/useScooters';
import { formatDistance, formatSeconds, formatSpeed, timeAgo } from '@/lib/format';
import { colors, fonts, spacing, typography } from '@/theme';
import type { PerformanceRun } from '@/types';

type Nav = AppNav;

export default function PerformanceScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  const [runs, setRuns] = useState<PerformanceRun[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      // Metingen horen bij de actieve scooter (Aerox ≠ schakel).
      perfService
        .listRuns(30, activeScooter?.id)
        .then(setRuns)
        .catch(() => setRuns([]))
        .finally(() => setLoading(false));
    }, [activeScooter]),
  );

  const best50 = perfService.bestRun(runs, 't0_50_s');
  const best80 = perfService.bestRun(runs, 't0_80_s');
  const bestTop = perfService.bestRun(runs, 'max_speed_kmh');

  if (loading) return <Loading label="Metingen laden…" />;

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Veiligheidsstrip */}
        <FadeInView>
          <Card style={styles.safety}>
            <IconTile tone="primary" size={30} radius={9}>
              <AlertCircleIcon size={16} color={colors.primary} />
            </IconTile>
            <Text style={styles.safetyText}>
              <Text style={styles.safetyStrong}>Veiligheid eerst: </Text>
              meet uitsluitend op afgesloten terrein. Bedien niet tijdens het rijden.
            </Text>
          </Card>
        </FadeInView>

        {/* Telemetry-bento: beste resultaten */}
        {runs.length > 0 ? (
          <FadeInView index={1}>
            <View style={styles.bento}>
              <View style={styles.bentoCell}>
                <View style={styles.bentoHead}>
                  <Text style={typography.eyebrow}>0–50 km/u</Text>
                  <TimerIcon size={13} color={colors.primary} />
                </View>
                <Text style={styles.bentoValue}>{best50 ? formatSeconds(best50.t0_50_s, 1) : '--.-'}</Text>
                <Text style={styles.bentoSub}>persoonlijk record</Text>
              </View>
              <View style={styles.bentoCell}>
                <View style={styles.bentoHead}>
                  <Text style={typography.eyebrow}>0–80 km/u</Text>
                  <TrendingUpIcon size={13} color={colors.textMuted} />
                </View>
                <Text style={[styles.bentoValue, !best80 && styles.bentoMuted]}>{best80 ? formatSeconds(best80.t0_80_s, 1) : '--.-'}</Text>
                <Text style={styles.bentoSub}>{best80 ? 'persoonlijk record' : 'in afwachting'}</Text>
              </View>
              <View style={styles.bentoCell}>
                <View style={styles.bentoHead}>
                  <Text style={typography.eyebrow}>Top</Text>
                  <GaugeIcon size={13} color={colors.primary} />
                </View>
                <Text style={styles.bentoValue}>{bestTop ? formatSpeed(bestTop.max_speed_kmh).replace(' km/h', '') : '—'}</Text>
                <Text style={styles.bentoSub}>km/u piek</Text>
              </View>
            </View>
          </FadeInView>
        ) : null}

        {/* Acceleratiecurve van de beste run */}
        {best50 && best50.points && best50.points.length > 4 ? (
          <FadeInView index={2}>
            <Card style={styles.curve}>
              <View style={styles.curveHead}>
                <Text style={typography.eyebrow}>Acceleratiecurve (V/T)</Text>
                <Text style={styles.curveTag}>{formatSeconds(best50.t0_50_s, 1)} RUN</Text>
              </View>
              <SpeedChart points={best50.points} height={110} />
            </Card>
          </FadeInView>
        ) : null}

        {/* Primaire sprintknop */}
        <FadeInView index={3}>
          <Button
            label="START SPRINT TEST"
            icon={<FlagIcon size={17} color={colors.onPrimary} />}
            onPress={() => navigation.navigate('PerformanceRun')}
          />
        </FadeInView>

        {/* GPS-nauwkeurigheid */}
        {runs.length > 0 ? (
          <FadeInView index={4}>
            <Text style={styles.note}>
              Telefoon-GPS is niet zo nauwkeurig als professionele meetapparatuur (±5 m). Zie metingen als indicatie.
            </Text>
          </FadeInView>
        ) : null}

        {/* Recente metingen */}
        <FadeInView index={5}>
          <SectionTitle>Recente metingen</SectionTitle>
          {runs.length === 0 ? (
            <EmptyState
              icon={FlagIcon}
              title="Nog geen meting gedaan"
              subtitle="Meet 0–50, 0–80 en topsnelheid op een veilige plek."
            />
          ) : (
            runs.slice(0, 8).map((r, ri) => (
              <FadeInView key={r.id} index={ri}>
                <Card
                  style={styles.runCard}
                  onPress={() => navigation.navigate('PerformanceResult', { runId: r.id })}
                >
                  <View style={styles.runRow}>
                    <IconTile tone="neutral" size={32} radius={9}>
                      <TimerIcon size={16} color={colors.text} />
                    </IconTile>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.runMain}>
                        0–50 in <Text style={styles.runStrong}>{formatSeconds(r.t0_50_s, 1)}</Text> · Top{' '}
                        <Text style={styles.runStrong}>{formatSpeed(r.max_speed_kmh)}</Text>
                      </Text>
                      <Text style={styles.runMeta}>
                        {timeAgo(r.created_at)} · {formatDistance(r.distance_m)}
                      </Text>
                    </View>
                    <Badge
                      label={r.gps_quality}
                      tone={r.gps_quality === 'goed' ? 'success' : r.gps_quality === 'matig' ? 'warning' : 'danger'}
                    />
                  </View>
                </Card>
              </FadeInView>
            ))
          )}
        </FadeInView>

        {runs.length > 0 ? (
          <Button label="Alle metingen" variant="secondary" onPress={() => navigation.navigate('PerformanceHistory')} />
        ) : null}

        {/* Privacy-voetnoot */}
        <View style={styles.privacy}>
          <ShieldIcon size={14} color={colors.textMuted} />
          <Text style={styles.privacyText}>Alleen snelheidspunten opgeslagen, geen routes. Privacy gewaarborgd.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl, gap: spacing.m },
  safety: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, padding: spacing.m },
  safetyText: { flex: 1, color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  safetyStrong: { color: colors.text, fontFamily: fonts.bodySemiBold, fontWeight: '600' },
  bento: { flexDirection: 'row', gap: spacing.s },
  bentoCell: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.m,
  },
  bentoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bentoValue: { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 4, letterSpacing: -0.3 },
  bentoMuted: { color: colors.textMuted },
  bentoSub: { color: colors.primary, fontFamily: fonts.display, fontSize: 12, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },
  curve: { gap: spacing.s },
  curveHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  curveTag: { color: colors.primary, fontFamily: fonts.display, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.4 },
  note: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  runCard: { marginBottom: 0 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  runMain: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  runStrong: { color: colors.text, fontFamily: fonts.display, fontWeight: '600' },
  runMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: 2, paddingVertical: spacing.xs },
  privacyText: { flex: 1, color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
});
