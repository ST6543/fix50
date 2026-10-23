/** Live performance-meting: minimale UI tijdens het rijden — grote cijfers. */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Button, Card, Loading } from '@/components/ui';
import { AlertCircleIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import { computeMetrics, gpsQuality, isStationaryEnough, smoothSpeed, type GpsSample } from './gps';
import * as perfService from '@/services/performance';
import { performanceRunSchema } from '@/lib/validation';
import { colors, fonts, spacing, typography } from '@/theme';

type Nav = AppNav;

export default function PerformanceRunScreen() {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();

  const [phase, setPhase] = useState<'pre' | 'gps' | 'ready' | 'running' | 'saving'>('pre');
  const [speed, setSpeed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [gpsStatus, setGpsStatus] = useState('GPS zoeken…');

  const samplesRef = useRef<GpsSample[]>([]);
  const smoothedRef = useRef(0);
  const startTimeRef = useRef(0);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => {
      watchRef.current?.remove();
    };
  }, []);

  async function prepare() {
    setPhase('gps');
    const { granted, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Locatie nodig',
        'De performance-meter heeft GPS nodig. Zonder toestemming kun je niet meten.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
      return;
    }
    if (!canAskAgain) {
      Alert.alert('Locatie geblokkeerd', 'Zet locatie aan in je instellingen om te meten.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 500, distanceInterval: 1 },
      (loc) => {
        if (phaseRef.current === 'running') handleSample(loc);
        else {
          setGpsStatus(
            isStationaryEnough(loc)
              ? 'GPS-signaal goed — je staat stil. Klaar om te starten.'
              : 'GPS-signal found — wacht tot je stilstaat.',
          );
        }
      },
    );

    setPhase('ready');
    setGpsStatus('GPS-signaal actief. Start alleen op een veilige, afgesloten plek.');
  }

  // Houd phase bij zonder de watch-callback te herbouwen
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  function handleSample(loc: Location.LocationObject) {
    const now = Date.now();
    const t = now - startTimeRef.current;
    const raw = (loc.coords.speed ?? 0) * 3.6;
    smoothedRef.current = smoothSpeed(smoothedRef.current, Math.max(0, raw));

    const prev = samplesRef.current[samplesRef.current.length - 1];
    if (
      prev &&
      loc.coords.latitude !== null &&
      prev.lat !== null &&
      loc.coords.longitude !== null &&
      prev.lon !== null
    ) {
      const d = haversine(prev.lat, prev.lon, loc.coords.latitude, loc.coords.longitude);
      if (d < 100) setDistance((v) => v + d);
    }

    samplesRef.current.push({
      t,
      speedKmh: smoothedRef.current,
      rawSpeedKmh: raw,
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
    });
    setSpeed(smoothedRef.current);
    setElapsed(t / 1000);
  }

  function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const a =
      Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  async function start() {
    samplesRef.current = [];
    smoothedRef.current = 0;
    setDistance(0);
    setSpeed(0);
    startTimeRef.current = Date.now();
    setPhase('running');
  }

  async function stopAndSave() {
    const samples = samplesRef.current;
    const metrics = computeMetrics(samples);
    if (!metrics) {
      Alert.alert('Te weinig data', 'De meting was te kort of GPS gaf te weinig punten.', [
        { text: 'Opnieuw', onPress: () => setPhase('ready') },
      ]);
      return;
    }

    const candidate = {
      duration_s: metrics.durationS,
      distance_m: metrics.distanceM,
      max_speed_kmh: metrics.maxSpeedKmh,
      avg_speed_kmh: metrics.avgSpeedKmh,
      t0_50_s: metrics.t0_50,
      t0_80_s: metrics.t0_80,
      t50_80_s: metrics.t50_80,
    };
    const check = performanceRunSchema.safeParse(candidate);
    if (!check.success) {
      Alert.alert(
        'Meting ongeldig',
        'De resultaten lijken niet fysiek plausibel (gps-ruis?). De meting is niet opgeslagen.',
        [{ text: 'Opnieuw', onPress: () => setPhase('ready') }],
      );
      return;
    }

    setPhase('saving');
    try {
      const saved = await perfService.saveRun({
        scooterId: activeScooter?.id ?? null,
        setupId: null,
        run: {
          ...check.data,
          gps_quality: gpsQuality(samples.map((s) => s.accuracy)),
          points: samples
            .filter((_, i) => i % 2 === 0)
            .map((s) => ({
              t_ms: s.t,
              speed_kmh: Math.round(s.speedKmh * 10) / 10,
              lat: null,
              lon: null,
              accuracy_m: s.accuracy,
            })),
          started_at: new Date(Date.now() - metrics.durationS * 1000).toISOString(),
        },
      });
      watchRef.current?.remove();
      navigation.replace('PerformanceResult', { runId: saved.id });
    } catch (err) {
      Alert.alert('Opslaan mislukt', err instanceof Error ? err.message : 'Probeer het opnieuw.', [
        { text: 'OK' },
      ]);
      setPhase('ready');
    }
  }

  if (phase === 'pre') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.preWrap}>
          <Card style={styles.preCard}>
            <View style={styles.preHead}>
              <AlertCircleIcon size={22} color={colors.danger} />
              <Text style={styles.preTitle}>Veiligheid eerst</Text>
            </View>
            <Text style={styles.preBody}>
              • Voer metingen ALLEEN uit op een veilige, afgesloten locatie (bijv. evenemententerrein).{'\n'}
              • Niet meten in het verkeer.{'\n'}
              • Telefoon vast zetten, niet in je zak.{'\n'}
              • Start de test pas als je stilstaat.{'\n'}
              • Kijk NIET op je scherm tijdens het rijden — het resultaat staat daarna klaar.
            </Text>
          </Card>
          <Button label="Ik begrijp het — GPS starten" onPress={prepare} />
          <Button label="Annuleren" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'gps') return <Loading label="GPS zoeken…" />;

  if (phase === 'ready' || phase === 'saving') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.preWrap}>
          <Text style={styles.gpsStatus}>{gpsStatus}</Text>
          <Card>
            <Text style={styles.gpsHint}>
              Je meet{activeScooter ? ` met ${activeScooter.name}` : ''}. Rijd vanaf stilstand vol gas en stop de
              meting als je op topsnelheid zit.
            </Text>
          </Card>
          <Button label="START TEST" onPress={start} disabled={phase === 'saving'} />
          <Button label="Opslaan & stoppen" variant="secondary" onPress={stopAndSave} disabled={phase === 'saving'} />
          <Button
            label="Afbreken"
            variant="ghost"
            onPress={() => {
              watchRef.current?.remove();
              navigation.goBack();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // running: alleen grote cijfers, minimale afleiding — Stitch cockpit-look
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.runWrap}>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live telemetrie</Text>
        </View>
        <Text style={styles.bigSpeed}>{Math.round(speed)}</Text>
        <Text style={styles.bigSpeedUnit}>KM/U</Text>
        <View style={styles.midRow}>
          <View style={styles.midCell}>
            <Text style={styles.midLabel}>Tijd</Text>
            <Text style={styles.midValue}>{elapsed.toFixed(1)}s</Text>
          </View>
          <View style={styles.midCell}>
            <Text style={styles.midLabel}>Afstand</Text>
            <Text style={styles.midValue}>{distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(2)} km`}</Text>
          </View>
        </View>
        <Button label="STOP & OPSLAAN" variant="danger" onPress={stopAndSave} style={styles.stopBtn} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  preWrap: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.m },
  preCard: { borderColor: colors.danger },
  preHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.s },
  preTitle: { color: colors.danger, fontWeight: '800', fontSize: 18 },
  preBody: { color: colors.text, lineHeight: 22 },
  gpsStatus: { color: colors.primary, textAlign: 'center', fontWeight: '700', marginBottom: spacing.s },
  gpsHint: { color: colors.textMuted, lineHeight: 19, marginBottom: spacing.m },
  runWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  liveText: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 12, fontWeight: '600', letterSpacing: 1.1, textTransform: 'uppercase' },
  bigSpeed: { fontFamily: fonts.displayBold, fontSize: 104, fontWeight: '700', color: colors.text, letterSpacing: -2 },
  bigSpeedUnit: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 13, fontWeight: '700', letterSpacing: 4, marginTop: spacing.xs },
  midRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl },
  midCell: { alignItems: 'center' },
  midLabel: { color: colors.textMuted, fontFamily: fonts.display, fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  midValue: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 24, fontWeight: '700', marginTop: 2 },
  stopBtn: { marginTop: spacing.xxl, alignSelf: 'stretch' },
});
