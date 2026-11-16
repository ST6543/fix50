/** Live tuning-simulator — scenario's A/B/C in één grafiek, met onzekerheid en betrouwbaarheid. */
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Badge, Button, Card, Chip, ChipRow, Input, Slider } from '@/components/ui';
import { MultiLineChart } from '@/components/charts';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import * as perfService from '@/services/performance';
import {
  calculateCvt,
  cvtClutchLabel,
  cvtSpringLabel,
  cvtStateFromSetupParts,
  CVT_SPRINGS,
  DEFAULT_CVT_STATE,
  type CvtState,
} from '@/lib/afstel';
import { calibrateModel } from '@/lib/model-calibration';
import { predictionConfidence, scenarioConfidence, summarizeScenario, type ConfidenceLevel } from '@/lib/simulator';
import { colors, fonts, spacing } from '@/theme';
import type { TuningSetup } from '@/types';

type ScenarioKey = 'A' | 'B' | 'C';
type Scenario = { key: ScenarioKey; name: string; color: string; dash: string; enabled: boolean; cvt: CvtState };

const SCENARIO_COLORS: Record<ScenarioKey, string> = {
  A: colors.primary,
  B: colors.info,
  C: colors.success,
};

/** Eigen streepjespatroon per scenario, zodat overlappende lijnen te onderscheiden zijn. */
const SCENARIO_DASH: Record<ScenarioKey, string> = {
  A: '10 5',
  B: '4 4',
  C: '1 5',
};

const TONE: Record<ConfidenceLevel, 'success' | 'warning' | 'danger'> = {
  hoog: 'success',
  gemiddeld: 'warning',
  laag: 'danger',
};

function makeScenarios(base: CvtState): Scenario[] {
  return [
    { key: 'A', name: 'Huidig', color: SCENARIO_COLORS.A, dash: SCENARIO_DASH.A, enabled: true, cvt: { ...base } },
    { key: 'B', name: 'Lichter', color: SCENARIO_COLORS.B, dash: SCENARIO_DASH.B, enabled: true, cvt: { ...base, roller: Math.max(3, base.roller - 1.5) } },
    { key: 'C', name: 'Zwaarder', color: SCENARIO_COLORS.C, dash: SCENARIO_DASH.C, enabled: true, cvt: { ...base, roller: Math.min(13, base.roller + 1.5) } },
  ];
}

export default function TuningSimulatorScreen() {
  const { activeScooter, setup } = useScooters();
  const [scenarios, setScenarios] = useState<Scenario[]>(() => makeScenarios(DEFAULT_CVT_STATE));
  const [selected, setSelected] = useState<ScenarioKey>('A');
  /** De opstelling waarop de ijking rust; scenario's die hiervan afwijken zijn extrapolaties. */
  const [baseline, setBaseline] = useState<CvtState>(DEFAULT_CVT_STATE);
  const [setups, setSetups] = useState<TuningSetup[]>([]);
  const [calibration, setCalibration] = useState({ samples: 0, meanAbsErrorPct: null as number | null });
  const [saveName, setSaveName] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!activeScooter) return;
      Promise.all([
        tuningService.listSetups(activeScooter.id).catch(() => [] as TuningSetup[]),
        perfService.listRuns(100, activeScooter.id).catch(() => []),
      ])
        .then(([setupList, runs]) => {
          setSetups(setupList);
          const active = setupList.find((s) => s.is_active) ?? setupList[0] ?? null;
          if (active) {
            const baseCvt = cvtStateFromSetupParts(active.parts, DEFAULT_CVT_STATE);
            setBaseline(baseCvt);
            setScenarios(makeScenarios(baseCvt));
          }

          const usable = runs.filter((r) => r.setup_id && r.max_speed_kmh !== null && r.gps_quality !== 'slecht');
          const pairs = usable.flatMap((r) => {
            const s = setupList.find((x) => x.id === r.setup_id);
            if (!s || r.max_speed_kmh === null) return [];
            return [{ predicted: calculateCvt(cvtStateFromSetupParts(s.parts)).topSpeed, measured: r.max_speed_kmh }];
          });
          const acc = calibrateModel(pairs);
          setCalibration({ samples: acc.samples, meanAbsErrorPct: acc.meanAbsErrorPct });
        })
        .catch(() => undefined);
    }, [activeScooter]),
  );

  const hasBlock = Boolean(setup?.bloktype) || Boolean(activeScooter?.engine_type);
  const hasCylinder = Boolean(setup?.cilinder) || Boolean(setup?.cilinderinhoud_cc);

  const confidence = predictionConfidence({
    hasBlock,
    hasCylinder,
    calibrationSamples: calibration.samples,
    meanAbsErrorPct: calibration.meanAbsErrorPct,
  });

  const evaluated = useMemo(
    () =>
      scenarios.map((s) => {
        const model = calculateCvt(s.cvt);
        // Betrouwbaarheid per voorspelling: dichter bij de geijkte basis = zekerder.
        const conf = scenarioConfidence(confidence, s.cvt, baseline);
        return { ...s, model, summary: summarizeScenario(model, conf), confidence: conf };
      }),
    [scenarios, confidence, baseline],
  );

  const active = evaluated.find((s) => s.key === selected) ?? evaluated[0]!;

  function updateCvt(patch: Partial<CvtState>) {
    setScenarios((prev) => prev.map((s) => (s.key === selected ? { ...s, cvt: { ...s.cvt, ...patch } } : s)));
  }

  function rename(key: ScenarioKey, name: string) {
    setScenarios((prev) => prev.map((s) => (s.key === key ? { ...s, name } : s)));
  }

  function toggle(key: ScenarioKey) {
    setScenarios((prev) => prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s)));
  }

  async function saveAsSetup() {
    if (!activeScooter) {
      setNote('Voeg eerst een scooter toe.');
      return;
    }
    const name = saveName.trim() || `Simulatie ${active.key}`;
    setBusy(true);
    try {
      const cvt = active.cvt;
      const parts: Record<string, string | number> = {
        Rollen: `${cvt.roller.toFixed(1).replace('.', ',')}g`,
        Drukveer: cvtSpringLabel(cvt.springIndex),
        'V-snaar': `${cvt.belt}mm`,
        Trekveren: cvtClutchLabel(cvt.clutch),
        Powerband: `${cvt.pbMin}-${cvt.pbMax} rpm`,
        rollen_g: cvt.roller,
        drukveer_index: cvt.springIndex,
        snaar_mm: cvt.belt,
        trekveer_index: cvt.clutch,
        powerband_min: cvt.pbMin,
        powerband_max: cvt.pbMax,
      };
      const existing = setups.find((s) => s.name.toLowerCase() === name.toLowerCase());
      const savedId = existing
        ? (await tuningService.updateSetup(existing.id, { parts }), existing.id)
        : (await tuningService.createSetup(activeScooter.id, name, parts)).id;
      await tuningService.activateSetup(activeScooter.id, savedId);
      const list = await tuningService.listSetups(activeScooter.id).catch(() => setups);
      setSetups(list);
      setSaveName('');
      setNote(`Scenario ${active.key} opgeslagen als "${name}" en actief.`);
    } catch {
      setNote('Opslaan mislukt — controleer je verbinding.');
    } finally {
      setBusy(false);
    }
  }

  const series = evaluated
    .filter((s) => s.enabled)
    .map((s) => ({
      label: `${s.key} · ${s.name}`,
      color: s.color,
      dashed: true,
      dash: s.dash,
      // Het gekozen scenario blijft vol in beeld; de andere blijven zichtbaar maar gedempt.
      opacity: s.key === selected ? 1 : 0.45,
      width: s.key === selected ? 3 : 1.8,
      points: s.model.data.filter((d) => d.rpm !== null).map((d) => ({ x: d.speed, y: d.rpm as number })),
    }));

  const bandPoints = active.model.data
    .filter((d) => d.rpm !== null)
    .map((d) => ({
      x: d.speed,
      yLow: (d.rpm as number) * (1 - active.confidence.spreadPct / 100),
      yHigh: (d.rpm as number) * (1 + active.confidence.spreadPct / 100),
    }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.hero}>
          <Text style={styles.eyebrow}>LIVE SIMULATOR</Text>
          <Text style={styles.heroTitle}>Toerental over snelheid</Text>
          <Text style={styles.heroSub}>
            Gestreepte lijnen zijn voorspellingen uit het model — geen metingen. De band toont de onzekerheid van het
            gekozen scenario.
          </Text>
          <View style={styles.badgeRow}>
            <Badge label={`basiszekerheid: ${confidence.level}`} tone={TONE[confidence.level]} />
            <Badge label={`band actief ±${active.confidence.spreadPct}%`} tone="neutral" />
            {calibration.samples > 0 ? <Badge label={`${calibration.samples} ijkingen`} tone="info" /> : null}
          </View>
        </Card>

        <Card style={styles.chartCard}>
          <MultiLineChart series={series} band={{ points: bandPoints, color: active.color }} height={190} />
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>SCENARIO'S</Text>
          {evaluated.map((s) => (
            <View key={s.key} style={styles.scenarioRow}>
              <View style={[styles.dot, { backgroundColor: s.color, opacity: s.enabled ? 1 : 0.3 }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.scenarioName} numberOfLines={1}>
                  {s.key} · {s.name}
                </Text>
                <Text style={styles.scenarioMeta}>
                  {`${s.summary.topSpeed} km/u (${s.summary.topLow}–${s.summary.topHigh}) · 0–50 gevoel ${s.summary.launchScore}/10`}
                </Text>
                <Text style={styles.scenarioConf}>
                  {`zekerheid ${s.confidence.level} · band ±${s.confidence.spreadPct}%`}
                </Text>
              </View>
              <Chip label={s.enabled ? 'in grafiek' : 'verborgen'} active={s.enabled} onPress={() => toggle(s.key)} />
            </View>
          ))}
          <View style={styles.divider} />
          <ChipRow>
            {evaluated.map((s) => (
              <Chip key={s.key} label={`Bewerk ${s.key}`} active={selected === s.key} onPress={() => setSelected(s.key)} />
            ))}
          </ChipRow>
          <Input
            label={`Naam van scenario ${active.key}`}
            value={active.name}
            onChangeText={(v) => rename(active.key, v)}
            placeholder="bijv. lichtere rollen"
          />
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>INSTELLINGEN — SCENARIO {active.key}</Text>
          <Slider
            label="Rolgewicht"
            value={active.cvt.roller}
            min={3}
            max={13}
            step={0.5}
            unit="g"
            decimals={1}
            onChange={(v) => updateCvt({ roller: v })}
          />
          <Text style={[styles.sectionLabel, { marginTop: spacing.m }]}>DRUKVEER</Text>
          <ChipRow>
            {CVT_SPRINGS.map((s, i) => (
              <Chip
                key={s.label}
                label={s.label}
                active={active.cvt.springIndex === i}
                onPress={() => updateCvt({ springIndex: i })}
              />
            ))}
          </ChipRow>
          <Slider
            label="V-snaar"
            value={active.cvt.belt}
            min={700}
            max={830}
            step={5}
            unit="mm"
            onChange={(v) => updateCvt({ belt: v })}
          />
          <Text style={[styles.sectionLabel, { marginTop: spacing.m }]}>TREKVEREN</Text>
          <ChipRow>
            {[1, 2, 3].map((v) => (
              <Chip
                key={v}
                label={cvtClutchLabel(v)}
                active={active.cvt.clutch === v}
                onPress={() => updateCvt({ clutch: v })}
              />
            ))}
          </ChipRow>
          <Slider
            label="Powerband begin"
            value={active.cvt.pbMin}
            min={5000}
            max={Math.max(5500, active.cvt.pbMax - 500)}
            step={100}
            format={(v) => `${v.toLocaleString('nl-NL')} rpm`}
            onChange={(v) => updateCvt({ pbMin: Math.min(active.cvt.pbMax - 500, v) })}
          />
          <Slider
            label="Powerband einde"
            value={active.cvt.pbMax}
            min={Math.min(11500, active.cvt.pbMin + 500)}
            max={12000}
            step={100}
            format={(v) => `${v.toLocaleString('nl-NL')} rpm`}
            onChange={(v) => updateCvt({ pbMax: Math.max(active.cvt.pbMin + 500, v) })}
          />
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>VERGELIJKING</Text>
          {evaluated.map((s) => (
            <View key={s.key} style={styles.compareRow}>
              <Text style={[styles.compareName, { color: s.color }]} numberOfLines={1}>
                {s.key}
              </Text>
              <Text style={styles.compareVal}>{`${s.summary.topSpeed} km/u`}</Text>
              <Text style={styles.compareVal}>{`${s.summary.launchScore}/10`}</Text>
              <Text style={styles.compareVal}>{`${s.summary.balanceScore}/10`}</Text>
              <Text style={styles.compareVal}>{`${s.summary.shiftRpm}`}</Text>
            </View>
          ))}
          <View style={styles.compareHead}>
            <Text style={[styles.compareName, styles.compareHeadText]}> </Text>
            <Text style={[styles.compareVal, styles.compareHeadText]}>top</Text>
            <Text style={[styles.compareVal, styles.compareHeadText]}>launch</Text>
            <Text style={[styles.compareVal, styles.compareHeadText]}>balans</Text>
            <Text style={[styles.compareVal, styles.compareHeadText]}>shift</Text>
          </View>
          <Text style={styles.hint}>{active.summary.verdict}</Text>
          <Text style={styles.confidenceLine}>
            {evaluated
              .map((s) => `${s.key} ${s.confidence.level} (±${s.confidence.spreadPct}%)`)
              .join(' · ')}
          </Text>
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>OPSLAAN ALS SETUP</Text>
          <Text style={styles.hint}>
            Bewaart de rollen, drukveer, snaar, trekveren en powerband van scenario {active.key} als testopstelling, zodat je
            hem na een testrit kunt vergelijken.
          </Text>
          <View style={styles.saveRow}>
            <View style={{ flex: 1 }}>
              <Input value={saveName} onChangeText={setSaveName} placeholder={`Simulatie ${active.key}`} />
            </View>
            <Button label="Opslaan" onPress={saveAsSetup} loading={busy} style={styles.saveBtn} />
          </View>
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>BETROUWBAARHEID — SCENARIO {active.key}</Text>
          <Text style={styles.hint}>{active.confidence.label}</Text>
          {active.confidence.reasons.map((r) => (
            <Text key={r} style={styles.reason}>
              {'• ' + r}
            </Text>
          ))}
          <Text style={styles.reasonMuted}>
            De simulatie rekent met een model voor rolgewicht, veren, snaar en powerband. Vermogen, uitlaat en afstelling van
            de carburateur zitten er niet in — meet altijd na.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  hero: { marginBottom: spacing.m },
  eyebrow: { color: colors.primary, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { color: colors.text, fontSize: 21, fontWeight: '800', fontFamily: fonts.display, marginTop: 2 },
  heroSub: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: spacing.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.m },
  chartCard: { marginBottom: spacing.m },
  sectionLabel: { color: colors.textSubtle, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, marginBottom: spacing.s },
  scenarioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.s },
  dot: { width: 10, height: 10, borderRadius: 5 },
  scenarioName: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  scenarioMeta: { color: colors.textMuted, fontSize: 11.5, marginTop: 1 },
  scenarioConf: { color: colors.textSubtle, fontSize: 11, marginTop: 1 },
  confidenceLine: { color: colors.textMuted, fontSize: 11.5, marginTop: spacing.s },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.m },
  compareHead: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  compareHeadText: { color: colors.textSubtle, fontSize: 10.5, textTransform: 'uppercase' },
  compareRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  compareName: { width: 46, fontSize: 13.5, fontWeight: '800', fontFamily: fonts.display },
  compareVal: { flex: 1, color: colors.text, fontSize: 13, textAlign: 'center' },
  hint: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: spacing.xs },
  reason: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  reasonMuted: { color: colors.textSubtle, fontSize: 11.5, lineHeight: 16, marginTop: spacing.s },
  saveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s, marginTop: spacing.s },
  saveBtn: { minWidth: 96 },
  note: { color: colors.success, fontSize: 12, marginTop: spacing.xs },
});
