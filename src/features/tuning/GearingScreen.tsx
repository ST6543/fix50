/**
 * Vertanding optimaliseren — schakelbrommers (AM6, Derbi, Tomos, enz.).
 *
 * Rekenkundig: verhoudingen, relatieve koppel-/snelheidsverschillen, benodigd
 * toerental en theoretische snelheden. Geen vermogensclaims: of de motor een
 * toerental haalt bepaalt de rest van de setup.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, Chip, ChipRow, Input, SectionTitle, Slider } from '@/components/ui';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import { ENGINE_DOSSIERS, findDossier, standardGearbox } from '@/data/engineDatabase';
import {
  compareGearing,
  finalDriveRatio,
  findOptimalGearing,
  FRONT_RANGE,
  GEARING_GOAL_LABELS,
  GEARING_GOAL_SHORT,
  REAR_RANGE,
  speedPerGear,
  type GearingGoal,
  type GearingSearchResult,
} from '@/lib/gearing';
import { colors, fonts, radii, spacing } from '@/theme';

const PRESETS: { label: string; front: number; rear: number; note: string }[] = [
  { label: '11 / 47', front: 11, rear: 47, note: 'Veel gebruikt op AM6/Derbi' },
  { label: '12 / 47', front: 12, rear: 47, note: 'Langer: hogere top, minder trek' },
  { label: '11 / 53', front: 11, rear: 53, note: 'Derbi D50B0 fabrieksrichting' },
  { label: '13 / 52', front: 13, rear: 52, note: 'Langer dan standaard' },
  { label: '14 / 53', front: 14, rear: 53, note: 'Derbi oud blok (EBE) standaard' },
];

const fmt = (v: number, digits = 1) => v.toFixed(digits).replace('.', ',');
const pct = (v: number) => `${v > 0 ? '+' : ''}${fmt(v)}%`;

export default function GearingScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<AppNav>();
  const { activeScooter } = useScooters();

  const [dossierId, setDossierId] = useState('am6-v1');
  const dossier = findDossier(dossierId)!;
  const gearbox = standardGearbox(dossier);
  const gears = useMemo(() => (gearbox?.gears ?? []).map((g) => ({ gear: g.gear, ratio: g.ratio })), [gearbox]);
  const primary = dossier.primaryRatio.value;

  const [front, setFront] = useState(11);
  const [rear, setRear] = useState(47);
  const [baseline, setBaseline] = useState({ front: 11, rear: 47 });
  const [circumference, setCircumference] = useState(1.85);
  const [rpm, setRpm] = useState(9000);

  const [goal, setGoal] = useState<GearingGoal>('trekBehoudTop');
  const [usage, setUsage] = useState<'dagelijks' | 'sportief'>('dagelijks');
  const [measuredTop, setMeasuredTop] = useState(70);
  const [measuredRpm, setMeasuredRpm] = useState(9500);
  // Zonder toerenteller is er geen betrouwbaar advies: dan blijft het getal onbekend.
  const [rpmKnown, setRpmKnown] = useState(true);
  const [maxRpm, setMaxRpm] = useState(11500);
  const [minTop, setMinTop] = useState(68);
  const [result, setResult] = useState<GearingSearchResult | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [setupName, setSetupName] = useState('Vertanding');

  const state = useMemo(
    () => compareGearing({ baseFront: baseline.front, baseRear: baseline.rear, front, rear, baseRpm: rpm }),
    [baseline, front, rear, rpm],
  );

  const gearRows = useMemo(
    () => speedPerGear({ rpm, front, rear, primaryRatio: primary, gears, wheelCircumferenceM: circumference }),
    [rpm, front, rear, primary, gears, circumference],
  );

  function reset() {
    setFront(baseline.front);
    setRear(baseline.rear);
  }

  function search() {
    setResult(
      findOptimalGearing({
        front,
        rear,
        measuredTopSpeedKmh: measuredTop,
        measuredTopRpm: rpmKnown ? measuredRpm : null,
        maxRpm,
        minTopSpeedKmh: minTop,
        goal,
        usage,
        wheelCircumferenceM: circumference,
        primaryRatio: primary,
        gears,
      }),
    );
  }

  async function saveSetup() {
    if (!activeScooter) {
      setSaveNote('Voeg eerst een scooter toe om deze tandwielkeuze op te slaan.');
      return;
    }
    try {
      await tuningService.createSetup(activeScooter.id, `${setupName} ${front}/${rear}`, {
        tandwiel_voor: front,
        tandwiel_achter: rear,
        ketting_verhouding: Number(finalDriveRatio(front, rear).toFixed(3)),
        blok_id: dossier.id,
        wielomtrek_m: circumference,
        toerental_meting: rpm,
      });
      setSaveNote(`Opgeslagen als testopstelling "${setupName} ${front}/${rear}". Vergelijk hem bij Setup vergelijken.`);
    } catch {
      setSaveNote('Opslaan mislukt — controleer je verbinding en of je een actieve scooter hebt.');
    }
  }

  const topSpeedNow = primary ? (gearRows[gearRows.length - 1]?.speed ?? 0) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.eyebrow}>VERTANDING</Text>
          <Text style={styles.title}>{dossier.label}</Text>
          <Text style={styles.body}>
            Kies je blok, schuif aan de tandwielen en zie direct wat de verhouding doet. Alles hier is rekenwerk:
            verhoudingen en theoretische snelheden, geen voorspelling van vermogen.
          </Text>
          <ChipRow>
            {ENGINE_DOSSIERS.filter((d) => d.gearboxes.length > 0).map((d) => (
              <Chip key={d.id} label={d.code} active={d.id === dossierId} onPress={() => setDossierId(d.id)} />
            ))}
          </ChipRow>
          <View style={styles.metaRow}>
            <Badge label={gearbox?.label ?? 'Bak onbekend'} tone={gearbox ? 'info' : 'neutral'} />
            <Badge
              label={primary ? `primaire ${fmt(primary, 2)}` : 'primaire onbekend'}
              tone={primary ? 'neutral' : 'warning'}
            />
          </View>
          {!primary ? (
            <Text style={styles.hint}>
              Van dit blok is de primaire verhouding niet gecontroleerd. Snelheid per versnelling blijft daarom leeg —
              alleen de eindoverbrenging en het koppelverschil zijn dan te berekenen.
            </Text>
          ) : null}
          <Button label="Motordatabase openen" variant="ghost" onPress={() => navigation.navigate('EngineDatabase')} />
        </Card>

        <SectionTitle>Simulator</SectionTitle>
        <Card>
          <Slider
            label="Voortandwiel"
            value={front}
            min={FRONT_RANGE.min}
            max={FRONT_RANGE.max}
            step={1}
            unit="T"
            hint="Kleiner voor = kortere vertanding: meer trek, meer toeren bij dezelfde snelheid."
            onChange={setFront}
          />
          <Slider
            label="Achtertandwiel"
            value={rear}
            min={REAR_RANGE.min}
            max={REAR_RANGE.max}
            step={1}
            unit="T"
            hint="Groter achter werkt hetzelfde als kleiner voor: korter."
            onChange={setRear}
          />
          <Slider
            label="Wielomtrek"
            value={circumference}
            min={1.6}
            max={2.1}
            step={0.01}
            decimals={2}
            unit="m"
            hint="Gemeten omtrek van je achterwiel (band + velg), niet de inch-maat."
            onChange={setCircumference}
          />
          <Slider
            label="Toerental voor de snelheidstabel"
            value={rpm}
            min={5000}
            max={13000}
            step={100}
            format={(v) => `${v.toLocaleString('nl-NL')} rpm`}
            hint="Kies het toerental waarbij je de snelheden wilt zien."
            onChange={setRpm}
          />
          <ChipRow>
            {PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                active={front === p.front && rear === p.rear}
                onPress={() => {
                  setFront(p.front);
                  setRear(p.rear);
                }}
              />
            ))}
          </ChipRow>
          <View style={styles.rowButtons}>
            <Button label="Reset naar begin" variant="secondary" onPress={reset} style={styles.flex1} />
          </View>
        </Card>

        <SectionTitle>Wat er verandert</SectionTitle>
        <Card>
          <View style={styles.statGrid}>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>VERHOUDING</Text>
              <Text style={styles.statValue}>{fmt(state.ratio, 3)}</Text>
              <Text style={styles.statSub}>{`${rear} / ${front}`}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>VERSCHIL</Text>
              <Text style={styles.statValue}>{pct(state.ratioDeltaPct)}</Text>
              <Text style={styles.statSub}>t.o.v. {baseline.front}/{baseline.rear}</Text>
            </View>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Wielkoppel bij gelijk motorkoppel</Text>
            <Text style={[styles.lineValue, state.torquePct > 0 ? styles.positive : state.torquePct < 0 ? styles.negative : undefined]}>
              {pct(state.torquePct)}
            </Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Snelheid bij gelijk toerental</Text>
            <Text style={[styles.lineValue, state.speedPct > 0 ? styles.positive : state.speedPct < 0 ? styles.negative : undefined]}>
              {pct(state.speedPct)}
            </Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Toerental voor dezelfde snelheid</Text>
            <Text style={styles.lineValue}>{state.requiredRpm ? `${Math.round(state.requiredRpm).toLocaleString('nl-NL')} rpm` : '—'}</Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Theoretische top bij {rpm.toLocaleString('nl-NL')} rpm</Text>
            <Text style={styles.lineValue}>{primary ? `${fmt(topSpeedNow)} km/u` : 'primaire onbekend'}</Text>
          </View>
          <Text style={styles.hint}>
            {state.torquePct > 0
              ? 'Korter dan je beginwaarde: meer kracht op het wiel, maar meer toeren en een lagere top bij hetzelfde toerental.'
              : state.torquePct < 0
                ? 'Langer dan je beginwaarde: hogere top bij hetzelfde toerental, minder kracht op het wiel.'
                : 'Gelijk aan je beginwaarde.'}
          </Text>
        </Card>

        <SectionTitle>Snelheid per versnelling</SectionTitle>
        <Card>
          {primary ? (
            gearRows.map((g) => (
              <View key={g.gear} style={styles.gearRow}>
                <Text style={styles.gearNr}>{g.gear}</Text>
                <Text style={styles.gearRatio}>{fmt(g.gearRatio, 3)}</Text>
                <Text style={styles.gearTotal}>{fmt(g.total, 2)}</Text>
                <Text style={styles.gearSpeed}>{fmt(g.speed)} km/u</Text>
              </View>
            ))
          ) : (
            <Text style={styles.hint}>Geen primaire verhouding bekend voor dit blok: snelheid per versnelling niet te berekenen.</Text>
          )}
          <Text style={styles.hint}>
            Theoretisch, bij {rpm.toLocaleString('nl-NL')} rpm en wielomtrek {fmt(circumference, 2)} m. Praktijk wijkt af door
            slip, belading en wind.
          </Text>
        </Card>

        <SectionTitle>Wat wil je bereiken?</SectionTitle>
        <Card>
          <View style={{ gap: spacing.s }}>
            {(Object.keys(GEARING_GOAL_LABELS) as GearingGoal[]).map((g) => (
              <Chip key={g} label={GEARING_GOAL_LABELS[g]} active={goal === g} onPress={() => setGoal(g)} />
            ))}
          </View>
          <View style={styles.divider} />
          <Text style={styles.labelSmall}>GEBRUIK</Text>
          <ChipRow>
            <Chip label="Dagelijks" active={usage === 'dagelijks'} onPress={() => setUsage('dagelijks')} />
            <Chip label="Sportief" active={usage === 'sportief'} onPress={() => setUsage('sportief')} />
          </ChipRow>
          <Slider
            label="Gemeten topsnelheid"
            value={measuredTop}
            min={30}
            max={110}
            step={1}
            unit="km/u"
            hint="Uit een GPS-rit of je teller. Zonder meting geen advies."
            onChange={setMeasuredTop}
          />
          <ChipRow>
            <Chip label="Toerental gemeten" active={rpmKnown} onPress={() => setRpmKnown(true)} />
            <Chip label="Toerental onbekend" active={!rpmKnown} onPress={() => setRpmKnown(false)} />
          </ChipRow>
          {rpmKnown ? (
            <Slider
              label="Toerental bij die topsnelheid"
              value={measuredRpm}
              min={5000}
              max={13000}
              step={100}
              format={(v) => `${v.toLocaleString('nl-NL')} rpm`}
              hint="Van je toerenteller — niet uit GPS. Zonder meting geen advies over toeren of top."
              onChange={setMeasuredRpm}
            />
          ) : (
            <Text style={styles.hint}>
              Toerental onbekend: Fix50 rekent dan alleen de verhouding en het koppelverschil uit en geeft geen
              snelheidsadvies. Een inductieve toerenteller of een run met toerentalmeting maakt het advies wel mogelijk.
            </Text>
          )}
          <Slider
            label="Maximaal toerental dat je wilt gebruiken"
            value={maxRpm}
            min={8000}
            max={14000}
            step={100}
            format={(v) => `${v.toLocaleString('nl-NL')} rpm`}
            hint="Je eigen grens, niet het absolute maximum van het blok."
            onChange={setMaxRpm}
          />
          <Slider
            label="Minimaal acceptabele topsnelheid"
            value={minTop}
            min={30}
            max={110}
            step={1}
            unit="km/u"
            hint="Hieronder mag de top niet zakken, anders valt de combinatie af."
            onChange={setMinTop}
          />
          <Button label="Optimale vertanding zoeken" onPress={search} style={{ marginTop: spacing.s }} />
        </Card>

        {result ? (
          <Card style={styles.resultCard}>
            {result.needsMeasurement ? (
              <>
                <Badge label="eerst meten" tone="warning" />
                <Text style={styles.body}>{result.explanation}</Text>
              </>
            ) : (
              <>
                <View style={styles.metaRow}>
                  <Badge label={`${result.candidates.length} combinaties doorgerekend`} tone="neutral" />
                  <Badge label={`doel: ${GEARING_GOAL_SHORT[goal]}`} tone="info" />
                </View>
                {result.explanation ? <Text style={styles.warningText}>{result.explanation}</Text> : null}
                {result.bestFirst ? (
                  <Text style={styles.hint}>
                    Beste eerste test: {result.bestFirst.front}/{result.bestFirst.rear} —{' '}
                    {fmt(result.bestFirst.torquePct)}% wielkoppel t.o.v. nu.
                  </Text>
                ) : null}
                {result.recommendations.map((r) => (
                  <View key={r.kind} style={styles.recCard}>
                    <View style={styles.recHead}>
                      <Text style={styles.recTitle}>{r.title}</Text>
                      {result.bestFirst?.kind === r.kind ? <Badge label="eerst testen" tone="success" /> : null}
                    </View>
                    <Text style={styles.recGears}>{`${r.front} / ${r.rear} → ${fmt(r.ratio, 3)}`}</Text>
                    <View style={styles.lineRow}>
                      <Text style={styles.lineLabel}>Verschil verhouding</Text>
                      <Text style={styles.lineValue}>{pct(r.ratioDeltaPct)}</Text>
                    </View>
                    <View style={styles.lineRow}>
                      <Text style={styles.lineLabel}>Wielkoppel</Text>
                      <Text style={styles.lineValue}>{pct(r.torquePct)}</Text>
                    </View>
                    <View style={styles.lineRow}>
                      <Text style={styles.lineLabel}>Snelheid bij gelijk toerental</Text>
                      <Text style={styles.lineValue}>{pct(r.speedPct)}</Text>
                    </View>
                    <View style={styles.lineRow}>
                      <Text style={styles.lineLabel}>Toerental voor oude top</Text>
                      <Text style={styles.lineValue}>
                        {r.requiredRpm ? `${Math.round(r.requiredRpm).toLocaleString('nl-NL')} rpm` : '—'}
                      </Text>
                    </View>
                    <View style={styles.lineRow}>
                      <Text style={styles.lineLabel}>Top binnen je grens</Text>
                      <Text style={styles.lineValue}>
                        {r.keepsTopSpeed === null ? '—' : r.keepsTopSpeed ? 'haalbaar' : 'niet haalbaar'}
                      </Text>
                    </View>
                    <Text style={styles.recText}>{r.pros}</Text>
                    <Text style={styles.blockInfoPit}>{`Nadeel: ${r.cons}`}</Text>
                    <Text style={styles.hint}>{r.compatibility}</Text>
                    <Text style={styles.hint}>
                      Betrouwbaarheid van dit rekenadvies: {r.reliability} (alleen verhoudingen en toerentallen, geen
                      vermogensmeting).
                    </Text>
                  </View>
                ))}
              </>
            )}
          </Card>
        ) : null}

        <SectionTitle>Opslaan</SectionTitle>
        <Card>
          <Input value={setupName} onChangeText={setSetupName} placeholder="Naam, bijv. Vertanding" />
          <Text style={styles.hint}>
            Slaat {front}/{rear} op als testopstelling met verhouding en wielomtrek, zodat je hem later in Setup
            vergelijken terugziet.
          </Text>
          <Button label={`Bewaar ${front}/${rear} als testopstelling`} variant="secondary" onPress={saveSetup} />
          {saveNote ? <Text style={styles.hint}>{saveNote}</Text> : null}
        </Card>

        <Card style={styles.noteCard}>
          <Text style={styles.labelSmall}>REKENREGELS</Text>
          <Text style={styles.hint}>
            R = achter / voor. Koppelverschil = (Rnieuw / Roud − 1) × 100%. Snelheidsverschil = (Roud / Rnieuw − 1) ×
            100%. Benodigd toerental = RPMoud × (Rnieuw / Roud). Totale overbrenging = primair × versnelling ×
            eindoverbrenging.
          </Text>
          <Text style={styles.hint}>
            Deze getallen gelden bij gelijk motorkoppel en gelijk toerental. Of je motor dat toerental haalt, hangt af van
            cilinder, uitlaat en afstelling — dat meet je met een testrit, niet met deze rekenaar.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  eyebrow: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 1, color: colors.primary, textTransform: 'uppercase' },
  title: { fontFamily: fonts.displayBold, fontSize: 21, color: colors.text, marginTop: spacing.xs, letterSpacing: -0.3 },
  body: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20, marginTop: spacing.xs },
  hint: { color: colors.textSubtle, fontSize: 12.5, lineHeight: 18, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.m },
  labelSmall: { color: colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: spacing.s },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.m },
  rowButtons: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  flex1: { flex: 1 },
  statGrid: { flexDirection: 'row', gap: spacing.s },
  statTile: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.s,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.s,
    alignItems: 'center',
  },
  statLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statValue: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 22, marginTop: 2 },
  statSub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s, marginTop: spacing.s },
  lineLabel: { flex: 1, color: colors.textMuted, fontSize: 12.5, lineHeight: 18 },
  lineValue: { color: colors.text, fontSize: 13, fontWeight: '700', fontFamily: fonts.display },
  positive: { color: colors.success },
  negative: { color: colors.warning },
  gearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  gearNr: { width: 20, color: colors.primary, fontWeight: '800', fontSize: 13 },
  gearRatio: { flex: 1, color: colors.textMuted, fontSize: 12.5 },
  gearTotal: { flex: 1, color: colors.textMuted, fontSize: 12.5 },
  gearSpeed: { color: colors.text, fontWeight: '700', fontSize: 13, fontFamily: fonts.display },
  resultCard: { marginTop: spacing.m },
  warningText: { color: colors.warning, fontSize: 12.5, lineHeight: 18, marginTop: spacing.s },
  recCard: {
    marginTop: spacing.m,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.s,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.s,
  },
  recHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  recTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800', fontFamily: fonts.display },
  recGears: { color: colors.primary, fontSize: 16, fontWeight: '800', fontFamily: fonts.display, marginTop: 2 },
  recText: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: spacing.s },
  blockInfoPit: { color: colors.warning, fontSize: 12, lineHeight: 17, marginTop: 2 },
  noteCard: { marginTop: spacing.m },
});
