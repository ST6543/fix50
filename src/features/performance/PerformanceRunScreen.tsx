/** Live performance-meting: minimale UI tijdens het rijden — grote cijfers. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { AppNav, RootStackParamList } from '@/navigation/types';

import { Button, Card, Chip, ChipRow, Loading } from '@/components/ui';
import { AlertCircleIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import { computeMetrics, gpsQuality, isStationaryEnough, smoothSpeed, type GpsSample } from './gps';
import * as perfService from '@/services/performance';
import {
  attachRunToJetChange,
  getActiveSetup,
  listChanges,
} from '@/services/tuning';
import { findJetGroup, jetChoices, jetGroupHasRun, jetGroupLabel, JET_RETEST_WARNING } from '@/lib/jet-log';
import type { TuningChange, TuningSetup, UUID } from '@/types';
import { performanceRunSchema } from '@/lib/validation';
import { colors, fonts, spacing, typography } from '@/theme';

type Nav = AppNav;

export default function PerformanceRunScreen() {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  // Vanuit een sproeierwissel gestart? Dan staat die wissel vast.
  const route = useRoute<RouteProp<RootStackParamList, 'PerformanceRun'>>();
  const linkedKey = route.params?.jetChangeKey ?? null;

  const [phase, setPhase] = useState<'pre' | 'gps' | 'ready' | 'running' | 'saving'>('pre');
  const [speed, setSpeed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [gpsStatus, setGpsStatus] = useState('GPS zoeken…');
  // Actieve tuningsetup (voor koppeling van de meting aan de afstelling).
  const [activeSetup, setActiveSetup] = useState<TuningSetup | null>(null);
  const [setupId, setSetupId] = useState<UUID | null>(null);
  // Sproeierwissels om te testen (wachtend, plus een gekozen wissel die al
  // een meting heeft), en de gekozen wissel.
  const [choices, setChoices] = useState<TuningChange[][]>([]);
  // Alle geladen logregels, om de gekozen wissel ook buiten de chips te vinden.
  const [changes, setChanges] = useState<TuningChange[]>([]);
  // Alleen als het log echt geladen is, mogen we zeggen dat een wissel er niet in staat.
  const [changesLoaded, setChangesLoaded] = useState(false);
  // Geen keuze = geen koppeling. Alleen "Test deze wissel" vult een wissel in.
  const [jetKey, setJetKey] = useState<string | null>(linkedKey);

  const samplesRef = useRef<GpsSample[]>([]);
  const smoothedRef = useRef(0);
  const startTimeRef = useRef(0);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => {
      watchRef.current?.remove();
    };
  }, []);

  // Koppel de actieve setup van deze scooter: metingen horen bij de huidige afstelling.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSetupId(null);
      setActiveSetup(null);
      if (!activeScooter) return;
      try {
        const setup = await getActiveSetup(activeScooter.id);
        if (!cancelled) {
          setActiveSetup(setup);
          setSetupId(setup?.id ?? null);
        }
      } catch {
        // Zonder setups meet je gewoon; er is dan niets om aan te koppelen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeScooter?.id]);

  // Welke sproeierwissel test je? Standaard geen: alleen "Test deze wissel"
  // vult er een in, dus er wordt niets op tijd of op volgorde geraden.
  useEffect(() => {
    let cancelled = false;
    setChoices([]);
    setChanges([]);
    setChangesLoaded(false);
    setJetKey(linkedKey);
    if (!activeScooter) return;
    listChanges(activeScooter.id)
      .then((rows) => {
        if (cancelled) return;
        setChanges(rows);
        setChangesLoaded(true);
        setChoices(jetChoices(rows, linkedKey));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeScooter?.id, linkedKey]);

  // De gekozen wissel komt uit de navigatie (bron van waarheid) en wordt in
  // het hele log opgezocht, niet alleen in de chips. Zo blijft een wissel die
  // niet in de keuzelijst staat toch te koppelen.
  const selectedJet = useMemo(() => findJetGroup(changes, jetKey), [changes, jetKey]);
  // Gekozen wissel die niet (meer) in het log staat: nooit stil ongekoppeld opslaan.
  const linkMissing = !!jetKey && changesLoaded && !selectedJet;
  // Deze wissel is al getest: een nieuwe meting vervangt de koppeling.
  const replacesExisting = jetGroupHasRun(selectedJet);

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
        setupId,
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
      // De wissel uit de navigatie is leidend: ook als hij niet in de
      // keuzelijst staat, proberen we hem te koppelen. De service zegt hoeveel
      // regels echt gekoppeld zijn, zodat een verdwenen wissel niet stil
      // ongekoppeld blijft.
      let linkIssue: 'niet-gevonden' | 'opslaan-mislukt' | undefined;
      if (jetKey) {
        try {
          const linked = await attachRunToJetChange({
            runId: saved.id,
            changeIds: selectedJet?.map((c) => c.id) ?? [jetKey],
          });
          if (linked === 0) linkIssue = 'niet-gevonden';
        } catch {
          linkIssue = 'opslaan-mislukt';
        }
      }
      watchRef.current?.remove();
      navigation.replace('PerformanceResult', { runId: saved.id, linkIssue });
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
            <Text style={styles.setupTag}>
              {activeSetup
                ? `Gekoppeld aan setup: ${activeSetup.name}`
                : 'Geen actieve tuningsetup — meting wordt niet gekoppeld aan een afstelling.'}
            </Text>
          </Card>
          <Card>
            <Text style={styles.jetPickLabel}>DEZE METING TEST</Text>
            {choices.length > 0 ? (
              <ChipRow>
                <Chip label="Geen wissel" active={jetKey === null} onPress={() => setJetKey(null)} />
                {choices.slice(0, 6).map((group) => (
                  <Chip
                    key={group[0]!.id}
                    label={jetGroupLabel(group)}
                    active={jetKey === group[0]!.id}
                    onPress={() => setJetKey(group[0]!.id)}
                  />
                ))}
              </ChipRow>
            ) : null}
            <Text style={styles.jetPickHint}>
              {linkMissing
                ? 'Deze sproeierwissel staat niet in je geladen log.'
                : selectedJet
                  ? `Top en 0–50 van deze meting komen als resultaat bij: ${jetGroupLabel(selectedJet)}.`
                  : choices.length > 0
                    ? 'Geen wissel gekozen — deze meting wordt niet aan een sproeierwissel gekoppeld.'
                    : 'Geen sproeierwissel wacht op een meting. Log eerst een wissel in de Afstelhulp; die kun je daar ook direct testen.'}
            </Text>
            {replacesExisting ? <Text style={styles.jetReplaceWarn}>{JET_RETEST_WARNING}</Text> : null}
            {linkMissing ? (
              <Text style={styles.jetReplaceWarn}>
                Let op: bij opslaan controleren we of deze wissel nog bestaat. Lukt koppelen niet, dan melden we dat op
                het resultaat.
              </Text>
            ) : null}
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
  setupTag: { color: colors.primary, fontWeight: '600', marginTop: spacing.xs },
  jetPickLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.xs },
  jetPickHint: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: spacing.s },
  jetReplaceWarn: { color: colors.warning, fontSize: 12.5, lineHeight: 18, fontWeight: '600', marginTop: spacing.s },
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
