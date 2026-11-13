/** Afstelhulp — startafstelling carburateur en CVT-richting, naar de klasieke afstelhulp-modellen. */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import { Badge, Button, Card, Chip, ChipRow, Input, Slider } from '@/components/ui';
import { useScooters } from '@/hooks/useScooters';
import * as ImagePicker from 'expo-image-picker';
import * as tuningService from '@/services/tuning';
import { ENGINE_BLOCKS, findBlockFromText } from '@/data/engineBlocks';
import { colors, fonts, radii, spacing } from '@/theme';
import type { TuningSetup } from '@/types';
import { shrinkForScan } from '@/lib/image-shrink';
import { scanPlugPhoto, type PlugScanResult } from '@/services/plug-scan';
import {
  calculateCarb,
  calculateCvt,
  CARB_DIAGNOSES,
  CARB_SETUP_LABELS,
  diagnoseCvtSymptoms,
  CVT_CARTER_PRESETS,
  CVT_ENGINE_PRESETS,
  CVT_SPRINGS,
  CVT_SYMPTOMS,
  cvtClutchLabel,
  cvtSpringLabel,
  cvtSpeedLabel,
  PLUG_READING,
  PLUG_READING_NOTE,
  PLUG_HEAT_INFO,
  PLUG_CODE_INFO,
  THROTTLE_MAP,
  type CarbMaterial,
  type CarbSetupType,
  type CvtState,
  type Cooling,
  CHAIN_SPROCKET_PRESETS,
  calculateChainRatio,
  GEARING_RULES,
  GEAR_GOAL_LABELS,
  buildGearSuggestions,
  PRIMARY_GEAR_INFO,
  type GearingGoal,
  type GearSuggestion,
} from '@/lib/afstel';

const CC_OPTIONS = [50, 65, 70, 80];
const CARB_MM_OPTIONS = [12.5, 14, 16, 17.5, 19, 21, 24, 26, 28];

function numFromText(value: string | null | undefined, fallback: number): number {
  const m = value?.match(/[\d.,]+/);
  if (!m) return fallback;
  const n = Number(m[0]!.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function parseRoller(value: string | null | undefined): number {
  const n = numFromText(value, 9.5);
  return Math.min(13, Math.max(3, Math.round(n * 2) / 2));
}

function parseSpringIndex(value: string | null | undefined): number {
  const v = (value ?? '').toLowerCase();
  if (v.includes('wit')) return 1;
  if (v.includes('groen')) return 2;
  if (v.includes('paars')) return 3;
  if (v.includes('blauw')) return 4;
  if (v.includes('zwart')) return 5;
  return 1;
}

function closeOption<T extends number>(value: number, options: number[]): T {
  return (options.reduce((best, o) => (Math.abs(o - value) < Math.abs(best - value) ? o : best), options[0]!) as T);
}

/** Genummerde sectiekop, zoals de afstelhoofdstukken. */
function NumberedHeader({ n, title, subtitle }: { n: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.numHeader}>
      <View style={styles.numBadge}>
        <Text style={styles.numBadgeText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.numTitle}>{title}</Text>
        {subtitle ? <Text style={styles.numSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/** Snelheid-vs-toeren lijn, zoals in de CVT-hulp, met powerband-band. */
function CvtChart({ data, pbMin, pbMax, height = 160 }: { data: { speed: number; rpm: number | null }[]; pbMin: number; pbMax: number; height?: number }) {
  const W = 320;
  const pad = 8;
  const inner = height - pad * 2;
  const maxS = 105;
  const minR = 1500;
  const maxR = 12000;
  const pts = data.filter((d) => d.rpm !== null).map((d) => d as { speed: number; rpm: number });
  const x = (s: number) => pad + (s / maxS) * (W - pad * 2);
  const y = (r: number) => pad + (1 - (r - minR) / (maxR - minR)) * inner;
  const pointsAttr = pts.map((p) => `${x(p.speed).toFixed(1)},${y(p.rpm).toFixed(1)}`).join(' ');
  const pbTop = y(pbMax);
  const pbBottom = y(pbMin);
  return (
    <Svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height}>
      <Rect x={pad} y={pbTop} width={W - pad * 2} height={Math.max(2, pbBottom - pbTop)} fill="rgba(255,107,0,0.14)" />
      {[0.25, 0.5, 0.75].map((f) => (
        <Line key={f} x1={pad} x2={W - pad} y1={pad + f * inner} y2={pad + f * inner} stroke={colors.border} strokeDasharray="3 6" strokeWidth={1} />
      ))}
      <Line x1={pad} x2={W - pad} y1={height - pad} y2={height - pad} stroke={colors.border} strokeWidth={1} />
      <Line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke={colors.border} strokeWidth={1} />
      <Polyline points={pointsAttr} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Stepper({ label, value, unit, hint, onDec, onInc, step }: {
  label: string;
  value: number | string;
  unit: string;
  hint?: string;
  onDec: () => void;
  onInc: () => void;
  step: number;
}) {
  return (
    <View style={styles.stepperRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.stepper}>
        <Pressable accessibilityLabel={`${label} verlagen`} onPress={onDec} style={styles.stepperBtn}>
          <Text style={styles.stepperBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>
          {value} {unit}
        </Text>
        <Pressable accessibilityLabel={`${label} verhogen`} onPress={onInc} style={styles.stepperBtn}>
          <Text style={styles.stepperBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AfstelScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<AppNav>();
  const { setup, activeScooter } = useScooters();
  const [tab, setTab] = useState<'carb' | 'cvt' | 'gear'>('carb');
  const tabSnapshot = tab as 'carb' | 'cvt' | 'gear';

  // ── Carburateur-state (pre-filled vanuit de scooter-setup) ──
  const [cc, setCc] = useState<number>(() => (setup?.cilinderinhoud_cc ? closeOption<number>(setup.cilinderinhoud_cc, CC_OPTIONS) : 70));
  const [material, setMaterial] = useState<CarbMaterial>('ijzer');
  const [carbMm, setCarbMm] = useState<number>(() =>
    setup?.carburateurmaat_mm ? closeOption<number>(setup.carburateurmaat_mm, CARB_MM_OPTIONS) : 17.5,
  );
  const [setupType, setSetupType] = useState<CarbSetupType>('sport');
  const [cooling, setCooling] = useState<Cooling>(() => ((setup?.bloktype ?? '').toLowerCase().includes('water') ? 'LC' : 'AC'));
  const [blockId, setBlockId] = useState<string>(() => findBlockFromText(setup?.bloktype)?.id ?? 'onbekend');
  const [diagId, setDiagId] = useState<string | null>(null);
  const [gearFront, setGearFront] = useState(11);
  const [gearRear, setGearRear] = useState(47);
  const [gearPresetId, setGearPresetId] = useState<string | null>(null);
  const [logNote, setLogNote] = useState<string | null>(null);

  // ── Testopstellingen: opgeslagen setups, één tik om te wisselen ──
  const [setups, setSetups] = useState<TuningSetup[]>([]);
  const [activeSetupId, setActiveSetupId] = useState<string | null>(null);
  const [newSetupName, setNewSetupName] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);

  const block = ENGINE_BLOCKS.find((b) => b.id === blockId) ?? null;
  const carb = useMemo(
    () => calculateCarb({ cc, carbMm, material, setupType, cooling, engineFamilyId: block?.family ?? 'onbekend' }),
    [cc, carbMm, material, setupType, cooling, block],
  );
  const blockPlug = block?.plugCode ? block.plugCode.replace('x', String(carb.heat)) : null;
  const diag = CARB_DIAGNOSES.find((d) => d.id === diagId) ?? null;

  // ── CVT-state (pre-filled waar mogelijk) ──
  const [carterIndex, setCarterIndex] = useState(1);
  const makeDefaultCvt = (): CvtState => ({
    roller: setup?.rollen ? parseRoller(setup.rollen) : 9.5,
    springIndex: setup?.drukveer ? parseSpringIndex(setup.drukveer) : 1,
    belt: 765,
    clutch: 2,
    pbMin: (setup?.cilinderinhoud_cc ?? 70) <= 50 ? 6000 : 7600,
    pbMax: (setup?.cilinderinhoud_cc ?? 70) <= 50 ? 7800 : 9000,
    carterIndex: 1,
  });
  const [cvt, setCvt] = useState<CvtState>(makeDefaultCvt);
  const [symptoms, setSymptoms] = useState<string[]>([]);

  const model = useMemo(() => calculateCvt(cvt), [cvt]);
  const userDiag = useMemo(() => diagnoseCvtSymptoms(cvt, symptoms), [cvt, symptoms]);
  const suggestedModel = useMemo(() => calculateCvt(userDiag.suggested), [userDiag]);

  const gearPreset = CHAIN_SPROCKET_PRESETS.find((x) => x.id === gearPresetId) ?? null;
  // Bougie-foto-analyse (NGK-kennisbank via plug-photo Edge Function)
  const [plugScanBusy, setPlugScanBusy] = useState(false);
  const [plugScanResult, setPlugScanResult] = useState<PlugScanResult | null>(null);
  const [plugScanNote, setPlugScanNote] = useState<string | null>(null);

  const [gearGoal, setGearGoal] = useState<GearingGoal | null>(null);
  const gearSuggestions: GearSuggestion[] = useMemo(
    () => (gearGoal ? buildGearSuggestions(gearFront, gearRear, gearGoal) : []),
    [gearGoal, gearFront, gearRear],
  );

  async function handlePlugScan(source: 'camera' | 'library') {
    setPlugScanNote(null);
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPlugScanNote("Geen toestemming voor camera/foto's — zet dit aan in de instellingen.");
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true, exif: false });
    if (result.canceled || !result.assets[0]?.base64) return;

    setPlugScanBusy(true);
    try {
      const shrunk = await shrinkForScan(result.assets[0]);
      const out = await scanPlugPhoto({
        base64: shrunk.base64,
        mime: shrunk.mime,
        scooterId: activeScooter?.id ?? null,
      });
      if (!out.found) {
        setPlugScanResult(null);
        setPlugScanNote(out.warning ?? 'De neus is niet goed te lezen. Probeer een nieuwe bougie en daglicht.');
        return;
      }
      setPlugScanResult(out);
    } catch (err) {
      setPlugScanNote(err instanceof Error ? err.message : 'Bougie-foto mislukt. Probeer het opnieuw.');
    } finally {
      setPlugScanBusy(false);
    }
  }
  const gearing = useMemo(
    () => calculateChainRatio(gearFront, gearRear, gearPreset ? gearPreset.rear / gearPreset.front : undefined),
    [gearFront, gearRear, gearPreset],
  );
  const isShakeBlock = block?.transmission === 'schakel';

  // ── Testopstellingen laden ───────────────────────────────────
  useEffect(() => {
    if (!activeScooter) {
      setSetups([]);
      setActiveSetupId(null);
      return;
    }
    let cancelled = false;
    tuningService
      .listSetups(activeScooter.id)
      .then((list) => {
        if (cancelled) return;
        setSetups(list);
        setActiveSetupId(list.find((s) => s.is_active)?.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeScooter]);

  /** Huidige Afstel-waarden als setup-parts: leesbaar én exact terug te zetten. */
  function currentParts(): Record<string, string | number> {
    return {
      Blok: block?.label ?? 'Onbekend',
      Cilinder: `${cc}cc`,
      Carburateur: `${String(carbMm).replace('.', ',')}mm`,
      Hoofdsproeier: `${carb.jetLow}-${carb.jetHigh}`,
      Bougie: carb.plug ?? `hittegraad ${carb.heat}`,
      Rollen: `${cvt.roller.toFixed(1).replace('.', ',')}g`,
      Drukveer: cvtSpringLabel(cvt.springIndex),
      'V-snaar': `${cvt.belt}mm`,
      Trekveren: cvtClutchLabel(cvt.clutch),
      Powerband: `${cvt.pbMin}-${cvt.pbMax} rpm`,
      Vertanding: `${gearFront}/${gearRear}`,
      // Numerieke velden: hiermee zet de Afstelhulp de schuivers exact terug.
      blok_id: blockId,
      cilinder_cc: cc,
      carb_mm: carbMm,
      rollen_g: cvt.roller,
      drukveer_index: cvt.springIndex,
      snaar_mm: cvt.belt,
      trekveer_index: cvt.clutch,
      powerband_min: cvt.pbMin,
      powerband_max: cvt.pbMax,
      tandwiel_voor: gearFront,
      tandwiel_achter: gearRear,
    };
  }

  function applySetupValues(s: TuningSetup) {
    const p = s.parts ?? {};
    const n = (key: string): number | null => {
      const v = p[key];
      const num = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
      return Number.isFinite(num) ? num : null;
    };
    const blok = p.blok_id;
    if (typeof blok === 'string' && ENGINE_BLOCKS.some((b) => b.id === blok)) setBlockId(blok);
    const ccValue = n('cilinder_cc');
    if (ccValue !== null) setCc(closeOption(ccValue, CC_OPTIONS));
    const carbValue = n('carb_mm');
    if (carbValue !== null) setCarbMm(closeOption(carbValue, CARB_MM_OPTIONS));
    const roller = n('rollen_g');
    const spring = n('drukveer_index');
    const belt = n('snaar_mm');
    const clutch = n('trekveer_index');
    const pbMin = n('powerband_min');
    const pbMax = n('powerband_max');
    setCvt((prev) => ({
      ...prev,
      roller: roller ?? prev.roller,
      springIndex: spring !== null ? Math.max(0, Math.min(CVT_SPRINGS.length - 1, spring)) : prev.springIndex,
      belt: belt ?? prev.belt,
      clutch: clutch ?? prev.clutch,
      pbMin: pbMin ?? prev.pbMin,
      pbMax: pbMax ?? prev.pbMax,
    }));
    const front = n('tandwiel_voor');
    const rear = n('tandwiel_achter');
    if (front !== null) setGearFront(front);
    if (rear !== null) setGearRear(rear);
  }

  async function switchSetup(s: TuningSetup) {
    applySetupValues(s);
    setActiveSetupId(s.id);
    setLogNote(`Testopstelling "${s.name}" geladen.`);
    if (!activeScooter) return;
    try {
      await tuningService.activateSetup(activeScooter.id, s.id);
      await tuningService.addChange({
        scooterId: activeScooter.id,
        setupId: s.id,
        part: 'Testopstelling gewisseld',
        newValue: s.name,
        result: 'Geladen in Afstelhulp',
      });
    } catch {
      // Wisselen in de UI mag nooit stuklopen op het activeren.
    }
  }

  async function saveSetup(name: string) {
    const label = name.trim();
    if (!label) {
      setLogNote('Geef de testopstelling eerst een naam.');
      return;
    }
    if (!activeScooter) {
      setLogNote('Voeg eerst een scooter toe om een testopstelling op te slaan.');
      return;
    }
    setSetupBusy(true);
    try {
      const parts = currentParts();
      const existing = setups.find((x) => x.name.toLowerCase() === label.toLowerCase());
      let savedId: string;
      if (existing) {
        await tuningService.updateSetup(existing.id, { parts });
        savedId = existing.id;
      } else {
        const created = await tuningService.createSetup(activeScooter.id, label, parts);
        savedId = created.id;
      }
      await tuningService.activateSetup(activeScooter.id, savedId);
      const list = await tuningService.listSetups(activeScooter.id);
      setSetups(list);
      setActiveSetupId(savedId);
      setNewSetupName('');
      setLogNote(
        existing
          ? `Testopstelling "${label}" bijgewerkt met de huidige waarden.`
          : `Testopstelling "${label}" opgeslagen en actief.`,
      );
    } catch {
      setLogNote('Opslaan mislukt — controleer je verbinding en of je een actieve scooter hebt.');
    } finally {
      setSetupBusy(false);
    }
  }

  // Opslaan in de tuninggeschiedenis (tuning_changes).
  const saveCarbAdvice = async () => {
    if (!activeScooter) return;
    try {
      await tuningService.addChange({
        scooterId: activeScooter.id,
        part: 'Afstelhulp: startafstelling',
        newValue: `${cc}cc ${carbMm}mm · sproeier ${carb.jetLow}-${carb.jetHigh} · clip ${carb.clip} · ${carb.plug ?? `hittegraad ${carb.heat}`}`,
        result: `Powerband-richtpunt ±${carb.powerbandRpm} rpm`,
        notes: [block?.label, CARB_SETUP_LABELS[setupType], cooling, material].filter(Boolean).join(' · '),
      });
      setLogNote('Startafstelling opgeslagen in de tuninggeschiedenis.');
    } catch {
      setLogNote('Opslaan mislukt — controleer of je een actieve scooter hebt.');
    }
  };

  const saveGear = async () => {
    if (!activeScooter) return;
    try {
      await tuningService.addChange({
        scooterId: activeScooter.id,
        part: 'Vertanding (ketting)',
        newValue: `${gearFront}/${gearRear} = ${gearing.ratio.toFixed(2)}`,
        result: gearing.deltaPct === null ? null : `${gearing.deltaPct > 0 ? '+' : ''}${gearing.deltaPct}% t.o.v. referentie`,
        notes: gearPreset?.label ?? null,
      });
      setLogNote('Vertanding opgeslagen in de tuninggeschiedenis.');
    } catch {
      setLogNote('Opslaan mislukt — controleer of je een actieve scooter hebt.');
    }
  };

  const applyCvtSuggestion = async () => {
    const next = userDiag.suggested;
    if (activeScooter) {
      const rows: [string, string, string][] = [];
      if (next.roller !== cvt.roller) rows.push(['Rollen', `${cvt.roller}g`, `${next.roller}g`]);
      if (next.springIndex !== cvt.springIndex) rows.push(['Drukveer', cvtSpringLabel(cvt.springIndex), cvtSpringLabel(next.springIndex)]);
      if (next.belt !== cvt.belt) rows.push(['V-snaar', `${cvt.belt}mm`, `${next.belt}mm`]);
      if (next.clutch !== cvt.clutch) rows.push(['Trekveren (aangrijpen)', cvtClutchLabel(cvt.clutch), cvtClutchLabel(next.clutch)]);
      try {
        for (const [part, oldValue, newValue] of rows) {
          await tuningService.addChange({
            scooterId: activeScooter.id,
            part,
            oldValue,
            newValue,
            result: 'Toegepast via Afstelhulp-suggestie',
          });
        }
        if (rows.length > 0) setLogNote(`${rows.length} afstelwijziging(en) opgeslagen in de tuninggeschiedenis.`);
      } catch {
        // Loggen mag de suggestie nooit in de weg zitten.
      }
    }
    setCvt(next);
  };

  const applyPreset = (i: number) => {
    const p = CVT_ENGINE_PRESETS[i]!;
    setCvt((s) => ({ ...s, pbMin: p.min, pbMax: p.max }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Segment-switch */}
        <Card style={styles.tabsCard}>
          <View style={styles.tabsRow}>
            {/* knoppen */}
            <Pressable accessibilityLabel="Carburateur afstellen" onPress={() => setTab('carb')}>
              <Chip label="Carburateur" active={tab === 'carb'} onPress={() => setTab('carb')} />
            </Pressable>
            <Pressable accessibilityLabel="CVT en variateur afstellen" onPress={() => setTab('cvt')}>
              <Chip label={isShakeBlock ? 'Vertanding' : 'CVT / Tandwielen'} active={isShakeBlock ? tab === 'gear' : tab === 'cvt'} onPress={() => setTab(isShakeBlock ? 'gear' : 'cvt')} />
            </Pressable>
          </View>
        </Card>
        {logNote ? (
          <Card style={styles.logNoteCard}>
            <Text style={styles.logNote}>{logNote}</Text>
          </Card>
        ) : null}

        <Card style={styles.setupCard}>
          <View style={styles.setupHead}>
            <Text style={styles.labelSmall}>TESTOPSTELLINGEN</Text>
            <Text style={styles.setupCount}>{setups.length === 0 ? 'nog geen opgeslagen' : `${setups.length} opgeslagen`}</Text>
          </View>
          {setups.length > 0 ? (
            <ChipRow>
              {setups.map((s) => (
                <Chip
                  key={s.id}
                  label={s.id === activeSetupId ? `${s.name} ✓` : s.name}
                  active={s.id === activeSetupId}
                  onPress={() => switchSetup(s)}
                />
              ))}
            </ChipRow>
          ) : (
            <Text style={styles.hint}>
              Sla je huidige waarden op als "Test 1", schuif verder en sla "Test 2" op. Wisselen is daarna één tik.
            </Text>
          )}
          <View style={styles.setupSaveRow}>
            <View style={{ flex: 1 }}>
              <Input
                value={newSetupName}
                onChangeText={setNewSetupName}
                placeholder="Naam, bijv. Test 1"
                onSubmitEditing={() => saveSetup(newSetupName)}
                returnKeyType="done"
              />
            </View>
            <Button
              label="Opslaan"
              onPress={() => saveSetup(newSetupName)}
              loading={setupBusy}
              style={styles.setupSaveBtn}
            />
          </View>
          <ChipRow>
            {['Origineel', 'Dagelijks', 'Sport', 'Test 1', 'Test 2'].map((n) => (
              <Chip key={n} label={n} onPress={() => setNewSetupName(n)} />
            ))}
          </ChipRow>
          <Button
            label="Vergelijk opstellingen"
            variant="secondary"
            onPress={() => navigation.navigate('SetupComparison')}
            style={{ marginTop: spacing.s }}
          />
          {activeSetupId ? (
            <Text style={styles.setupActiveNote}>
              {`Actief: ${setups.find((s) => s.id === activeSetupId)?.name ?? '—'} · GPS-metingen koppelen hieraan`}
            </Text>
          ) : (
            <Text style={styles.hint}>Nog geen actieve opstelling — sla er één op om je metingen eraan te koppelen.</Text>
          )}
        </Card>

        {tab === 'carb' ? (
          <>
            <NumberedHeader n="1" title="JOUW SETUP" subtitle="Kies je blok en materiaal; koeling mag je altijd zelf aanpassen." />
            <Card>
              <Text style={styles.label}>Motor / blok</Text>
              <ChipRow>
                {ENGINE_BLOCKS.map((b) => (
                  <Chip key={b.id} label={b.label} active={blockId === b.id} onPress={() => {
                    setBlockId(b.id);
                    const nb = ENGINE_BLOCKS.find((x) => x.id === b.id);
                    if (nb?.transmission === 'schakel' && tabSnapshot === 'cvt') setTab('gear');
                    if (nb && nb.transmission !== 'schakel' && tabSnapshot === 'gear') setTab('cvt');
                  }} />
                ))}
                <Chip label="Custom / onbekend" active={blockId === 'onbekend'} onPress={() => setBlockId('onbekend')} />
              </ChipRow>
              {block ? (
                <View style={styles.blockInfo}>
                  <Text style={styles.blockInfoTitle}>{block.label}</Text>
                  <Text style={styles.hint} numberOfLines={2}>
                    {block.note}
                  </Text>
                  <Text style={styles.blockInfoLine}>{`Standaard carb: ${block.stockCarbMm.map((m) => String(m).replace('.', ',')).join(' · ')} mm · bougie zoals ${blockPlug ?? block.plugCode}`}</Text>
                  <Text style={styles.blockInfoLine}>{`Powerband (st. 50cc): ${block.stockPowerband[0].toLocaleString('nl-NL')}–${block.stockPowerband[1].toLocaleString('nl-NL')} rpm`}</Text>
                  <Text style={styles.blockInfoLine}>{`Bekende restricties: ${block.restrictors.join(' · ')}`}</Text>
                  <Text style={styles.blockInfoLine}>{`Opvoer-stages: ${block.kits.map((k) => `${k.cc}cc ${k.note}`).join(' · ')}`}</Text>
                  {block.pitfalls.map((pit) => (
                    <Text key={pit} style={styles.blockInfoPit}>{`⚠ ${pit}`}</Text>
                  ))}
                </View>
              ) : (
                <Text style={[styles.hint, { marginTop: spacing.xs }]}>
                  Geen blok gekozen: advies werkt dan universeel, zonder blok-specifieke bougie of stages.
                </Text>
              )}
              <Slider
                label="Cilinderinhoud"
                value={Math.max(0, CC_OPTIONS.indexOf(cc))}
                min={0}
                max={CC_OPTIONS.length - 1}
                step={1}
                format={(i) => `${CC_OPTIONS[Math.round(i)]} cc`}
                hint="Groter volume vraagt een ruimere sproeier en een koudere bougie."
                onChange={(i) => setCc(CC_OPTIONS[Math.round(i)] ?? cc)}
              />
              <Text style={styles.label}>Materiaal cilinder</Text>
              <ChipRow>
                <Chip label="Gietijzer" active={material === 'ijzer'} onPress={() => setMaterial('ijzer')} />
                <Chip label="Aluminium" active={material === 'alu'} onPress={() => setMaterial('alu')} />
              </ChipRow>
              <Slider
                label="Carburateur"
                value={Math.max(0, CARB_MM_OPTIONS.indexOf(carbMm))}
                min={0}
                max={CARB_MM_OPTIONS.length - 1}
                step={1}
                format={(i) => `${String(CARB_MM_OPTIONS[Math.round(i)]).replace('.', ',')} mm`}
                hint="Grotere doorlaat = meer mengsel bij volgas, maar lastiger stationair afstellen."
                onChange={(i) => setCarbMm(CARB_MM_OPTIONS[Math.round(i)] ?? carbMm)}
              />
              <Text style={styles.label}>Uitlaat / setup</Text>
              <ChipRow>
                {(Object.keys(CARB_SETUP_LABELS) as CarbSetupType[]).map((t) => (
                  <Chip key={t} label={CARB_SETUP_LABELS[t]} active={setupType === t} onPress={() => setSetupType(t)} />
                ))}
              </ChipRow>
              <Text style={styles.label}>Koeling</Text>
              <ChipRow>
                <Chip label="Luchtgekoeld (AC)" active={cooling === 'AC'} onPress={() => setCooling('AC')} />
                <Chip label="Watergekoeld (LC)" active={cooling === 'LC'} onPress={() => setCooling('LC')} />
              </ChipRow>
            </Card>

            <NumberedHeader n="2" title="JOUW STARTAFSTELLING" subtitle="Veilige waarden om mee te beginnen, daarna pas fijn afstellen." />
            <Card>
              <View style={styles.jetRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.labelSmall}>HOOFDSPROEIER</Text>
                  <Text style={styles.bigValue}>{carb.jetLow}–{carb.jetHigh}</Text>
                  <Text style={styles.hint}>Start met {carb.jetHigh} en werk rustig naar beneden.</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.resultCol}>
                <Text style={styles.labelSmall}>GASNAALD</Text>
                <Text style={styles.midValue}>Clip {carb.clip}</Text>
                <Text style={styles.hint}>Geteld vanaf boven. Lager clipje = rijker mengsel.</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.resultCol}>
                <Text style={styles.labelSmall}>BOUGIE</Text>
                <Text style={styles.midValue}>{carb.plug ? `NGK ${carb.plug}` : `Hittegraad ${carb.heat}`}</Text>
                <Text style={styles.hint}>
                  {carb.plug
                    ? 'Controleer kleur en temperatuur na een test onder belasting.'
                    : 'Controleer zelf schroefdraad, lengte en weerstand voor jouw cilinderkop.'}
                </Text>
              </View>
              <View style={styles.divider} />
              <Text style={styles.labelSmall}>VOLGENDE STAP</Text>
              <Text style={styles.resultColText}>Start rijk met sproeier {carb.jetHigh}.</Text>
              <Text style={styles.hint}>
                Test kort onder belasting. Richtpunt powerband: ±{carb.powerbandRpm.toLocaleString('nl-NL')} rpm.
              </Text>
              <Text style={styles.hint}>
                Stop direct bij pingelen, wit/grijze bougie, hoge temperatuur of toeren die blijven hangen. Controleer
                eerst op valse lucht voordat je sproeiers blijft wisselen.
              </Text>
              <Button label="Startafstelling opslaan in tuninggeschiedenis" variant="secondary" onPress={saveCarbAdvice} />
            </Card>

            <NumberedHeader n="3" title="AFSTELKAART PER GASSTAND" subtitle="Zie direct welk onderdeel bij welke gasstand de meeste invloed heeft." />
            <Card>
              {THROTTLE_MAP.map((r, i) => (
                <View key={r.range} style={i > 0 ? styles.divider : undefined}>
                  <Text style={styles.mapRange}>{r.range}</Text>
                  <Text style={styles.mapComp}>{r.component}</Text>
                </View>
              ))}
            </Card>

            <NumberedHeader n="4" title="BOUGIE LEZEN" subtitle="Na een volgas-test, het liefst met een nieuwe bougie." />
            <Card>
              <View style={styles.plugRow}>
                {PLUG_READING.map((p) => (
                  <View key={p.id} style={styles.plugTile}>
                    <Text style={styles.plugLabel}>{p.label}</Text>
                    <Text style={styles.plugDesc}>{p.desc}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.hint}>{PLUG_READING_NOTE}</Text>
              <View style={styles.divider} />
              <Text style={styles.blockInfoTitle}>Hittegraad &amp; bougiecode (NGK)</Text>
              {PLUG_HEAT_INFO.map((t) => (
                <Text key={t.slice(0, 24)} style={styles.blockInfoLine}>
                  {'• ' + t}
                </Text>
              ))}
              {PLUG_CODE_INFO.map((c) => (
                <Text key={c.code} style={styles.blockInfoLine}>
                  {`${c.code} = ${c.betekenis}`}
                </Text>
              ))}
              <View style={styles.divider} />
              <Text style={styles.labelSmall}>FOTO-ANALYSE (RICHTLIJN)</Text>
              <View style={styles.plugScanRow}>
                <Pressable style={styles.sugApply} disabled={plugScanBusy} onPress={() => handlePlugScan('camera')}>
                  <Text style={styles.sugApplyText}>Foto maken</Text>
                </Pressable>
                <Pressable style={styles.sugApply} disabled={plugScanBusy} onPress={() => handlePlugScan('library')}>
                  <Text style={styles.sugApplyText}>Uit galerij</Text>
                </Pressable>
              </View>
              {plugScanBusy ? <Text style={styles.hint}>Foto wordt geanalyseerd...</Text> : null}
              {plugScanNote ? <Text style={styles.blockInfoPit}>{plugScanNote}</Text> : null}
              {plugScanResult ? (
                <View style={styles.diagResult}>
                  <Text style={styles.resultColText}>{plugScanResult.condition_label}</Text>
                  {plugScanResult.code_detected ? (
                    <Text style={styles.hint}>{`Gevonden code: ${plugScanResult.code_detected}${plugScanResult.heat_estimate ? ` (hittegraad ${plugScanResult.heat_estimate})` : ''}`}</Text>
                  ) : null}
                  {plugScanResult.explanation ? <Text style={styles.hint}>{plugScanResult.explanation}</Text> : null}
                  {plugScanResult.description ? (
                    <Text style={styles.blockInfoLine}>{`Wat de AI zag: ${plugScanResult.description}`}</Text>
                  ) : null}
                  {plugScanResult.jet_direction || plugScanResult.plug_grade_direction ? (
                    <Text style={styles.nextStepText}>
                      {[
                        plugScanResult.jet_direction ? `Mengsel: ${plugScanResult.jet_direction}` : null,
                        plugScanResult.plug_grade_direction
                          ? `Hittegraad: ${plugScanResult.plug_grade_direction}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </Text>
                  ) : null}
                  <Text style={styles.blockInfoLine}>
                    Kleuroordeel is een richtlijn, geen zekerheid. Verander nooit tegelijk de sproeier EN de hittegraad.
                  </Text>
                </View>
              ) : null}
            </Card>

            <NumberedHeader n="5" title="MENGSEL & DIAGNOSE" subtitle="Kies een symptoom voor gericht advies." />
            <Card>
              <View style={{ gap: spacing.s }}>
                {CARB_DIAGNOSES.map((d) => (
                  <Pressable
                    key={d.id}
                    accessibilityRole="button"
                    accessibilityLabel={d.label}
                    onPress={() => setDiagId((prev) => (prev === d.id ? null : d.id))}
                    style={styles.diagBtn}
                  >
                    <Text style={styles.diagTitle}>{d.label}</Text>
                    <Text style={styles.diagSub}>{d.title}</Text>
                  </Pressable>
                ))}
              </View>
              {diag ? (
                <View style={styles.diagResult}>
                  <Text style={styles.resultColText}>{diag.title}</Text>
                  <Text style={styles.hint}>{diag.advice}</Text>
                  <Text style={styles.nextStepText}>{diag.nextStep}</Text>
                </View>
              ) : (
                <Text style={[styles.hint, { marginTop: spacing.s }]}>Kies hierboven wat je scooter doet voor een advies.</Text>
              )}
            </Card>
          </>
        ) : tab === 'cvt' && !isShakeBlock ? (
          <>
            <Card style={styles.liveCard}>
              <View style={styles.liveHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.liveEyebrow}>LIVE AFSTELLING</Text>
                  <Text style={styles.liveTitle}>{model.verdict}</Text>
                </View>
                <Badge
                  label={cvtSpeedLabel(model.topSpeed)}
                  tone={model.balanceScore >= 7 ? 'success' : model.balanceScore >= 4 ? 'warning' : 'danger'}
                />
              </View>
              <View style={styles.statsGrid}>
                <StatTile label="LAUNCH" value={`${model.launchScore.toFixed(1)}/10`} />
                <StatTile label="BALANS" value={`${model.balanceScore.toFixed(1)}/10`} />
                <StatTile label="SHIFT-TOEREN" value={`${Math.round(model.shiftRpm)} rpm`} />
              </View>
              <View style={styles.liveTrack}>
                <View style={[styles.liveFill, { width: `${Math.max(4, Math.min(100, model.balanceScore * 10))}%` }]} />
              </View>
              <Text style={styles.liveHint}>Schuif hieronder en deze cijfers veranderen direct mee.</Text>
            </Card>

            <NumberedHeader n="1" title="EERST: WELK TYPE OVERBRENGING?" subtitle="Snaarlengte hoort bij het cartertype." />
            <Card>
              <View style={{ gap: spacing.s }}>
                {CVT_CARTER_PRESETS.map((preset, i) => (
                  <Pressable
                    key={preset.id}
                    accessibilityRole="button"
                    accessibilityLabel={preset.label}
                    onPress={() => {
                      setCarterIndex(i);
                      setCvt((s) => ({ ...s, belt: preset.idealBelt, carterIndex: i }));
                    }}
                    style={[styles.carterBtn, carterIndex === i && styles.carterBtnActive]}
                  >
                    <Text style={styles.carterLabel}>{preset.label}</Text>
                    <Text style={styles.carterDetail}>{preset.detail}</Text>
                    <Text style={styles.carterBelt}>Richt-snaar: ±{preset.idealBelt}mm</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <NumberedHeader n="2" title="JE CVT SETUP" />
            <Card>
              <Slider
                label="Rolgewicht"
                value={cvt.roller}
                min={3}
                max={13}
                step={0.5}
                unit="g"
                decimals={1}
                target={symptoms.length > 0 ? userDiag.suggested.roller : null}
                hint="Lichter = meer toerental, later opschakelen. Zwaarder = eerder opschakelen."
                onChange={(v) => setCvt((s) => ({ ...s, roller: v }))}
              />
              <Text style={[styles.label, { marginTop: spacing.s }]}>Drukveer</Text>
              <ChipRow>
                {CVT_SPRINGS.map((s, i) => (
                  <Chip key={s.label} label={s.label} active={cvt.springIndex === i} onPress={() => setCvt((st) => ({ ...st, springIndex: i }))} />
                ))}
              </ChipRow>
              <Text style={styles.hint}>Strakker = houdt hem langer kort, maar kan top kosten.</Text>
              <Slider
                label="V-snaar lengte"
                value={cvt.belt}
                min={700}
                max={830}
                step={5}
                unit="mm"
                target={symptoms.length > 0 ? userDiag.suggested.belt : CVT_CARTER_PRESETS[carterIndex]!.idealBelt}
                hint={`Logisch rond de ideale snaar voor deze overbrenging: ±${CVT_CARTER_PRESETS[carterIndex]!.idealBelt}mm.`}
                onChange={(v) => setCvt((s) => ({ ...s, belt: v }))}
              />
              <Text style={[styles.label, { marginTop: spacing.s }]}>Trekveren</Text>
              <ChipRow>
                {[1, 2, 3].map((v) => (
                  <Chip key={v} label={cvtClutchLabel(v)} active={cvt.clutch === v} onPress={() => setCvt((st) => ({ ...st, clutch: v }))} />
                ))}
              </ChipRow>
              <Text style={[styles.label, { marginTop: spacing.s }]}>Powerband</Text>
              <ChipRow>
                {CVT_ENGINE_PRESETS.map((p, i) => (
                  <Chip key={p.label} label={p.label} active={cvt.pbMin === p.min && cvt.pbMax === p.max} onPress={() => applyPreset(i)} />
                ))}
              </ChipRow>
              <Slider
                label="Powerband begin"
                value={cvt.pbMin}
                min={5000}
                max={Math.max(5500, cvt.pbMax - 500)}
                step={100}
                format={(v) => `${v.toLocaleString('nl-NL')} rpm`}
                hint="Hier begint je motor goed te trekken; onder dit toerental laat de vario hem zakken."
                onChange={(v) => setCvt((s) => ({ ...s, pbMin: Math.min(s.pbMax - 500, v) }))}
              />
              <Slider
                label="Powerband einde"
                value={cvt.pbMax}
                min={Math.min(11500, cvt.pbMin + 500)}
                max={12000}
                step={100}
                format={(v) => `${v.toLocaleString('nl-NL')} rpm`}
                hint="Boven dit toerental levert extra toeren weinig extra snelheid meer op."
                onChange={(v) => setCvt((s) => ({ ...s, pbMax: Math.max(s.pbMin + 500, v) }))}
              />
            </Card>

            <NumberedHeader n="3" title="AFSTELPLAN" subtitle="Werk in deze volgorde — één wijziging per testrit." />
            <Card>
              {([
                {
                  key: 'roller',
                  title: 'Rolgewicht',
                  now: `${cvt.roller.toFixed(1).replace('.', ',')} g`,
                  advies: `${userDiag.suggested.roller.toFixed(1).replace('.', ',')} g`,
                  why: 'Bepaalt je toerental bij optrekken. Eerst dit goed hebben, dan de rest.',
                },
                {
                  key: 'springIndex',
                  title: 'Drukveer',
                  now: cvtSpringLabel(cvt.springIndex),
                  advies: cvtSpringLabel(userDiag.suggested.springIndex),
                  why: 'Houdt de riem langer onderin: strakker = meer toeren, minder top.',
                },
                {
                  key: 'belt',
                  title: 'V-snaar',
                  now: `${cvt.belt} mm`,
                  advies: `${userDiag.suggested.belt} mm`,
                  why: 'Verkeerde lengte kost snelheid of laat de riem slippen.',
                },
                {
                  key: 'clutch',
                  title: 'Trekveren',
                  now: cvtClutchLabel(cvt.clutch),
                  advies: cvtClutchLabel(userDiag.suggested.clutch),
                  why: 'Bepaalt wanneer de koppeling aangrijpt bij wegrijden.',
                },
              ] as const).map((row, i) => {
                const ok = row.now === row.advies;
                return (
                  <View key={row.key} style={i > 0 ? styles.planRowSpaced : styles.planRow}>
                    <View style={[styles.planDot, ok && styles.planDotOk]}>
                      <Text style={[styles.planDotText, ok && styles.planDotTextOk]}>{ok ? '✓' : i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.planHead}>
                        <Text style={styles.planTitle}>{row.title}</Text>
                        <Text style={[styles.planValue, !ok && styles.planValueOff]}>
                          {ok ? `op advies (${row.now})` : `${row.now} → ${row.advies}`}
                        </Text>
                      </View>
                      <Text style={styles.planWhy}>{row.why}</Text>
                    </View>
                  </View>
                );
              })}
              <View style={styles.divider} />
              <Text style={styles.hint}>
                Stap 5 is altijd een testrit van minimaal 2 km met een schone bougie, daarna kleur lezen. Pas daarna de
                volgende wijziging toe.
              </Text>
              {symptoms.length === 0 ? (
                <Text style={styles.planHintMuted}>
                  Kies onderaan bij Symptomen wat je scooter doet — dan vult het plan hierboven concrete advieswaarden in.
                </Text>
              ) : (
                <Button label="Afstelplan toepassen" onPress={applyCvtSuggestion} style={{ marginTop: spacing.m }} />
              )}
            </Card>

            <NumberedHeader n="4" title="SNELHEID VS TOERENTAL" subtitle={`Powerband: ${cvt.pbMin}–${cvt.pbMax} rpm · ${CVT_CARTER_PRESETS[carterIndex]!.label}`} />
            <Card>
              <View style={styles.verdictRow}>
                <Text style={styles.labelSmall}>TOERENTAL OVER SNELHEID</Text>
                <Text style={styles.verdictSpeed}>{cvtSpeedLabel(model.topSpeed)}</Text>
              </View>
              <Text style={styles.hint}>{model.advice}</Text>
              <CvtChart data={model.data} pbMin={cvt.pbMin} pbMax={cvt.pbMax} />
            </Card>

            <NumberedHeader n="5" title="SYMPTOMEN INVULLEN" subtitle="Kies wat je scooter doet, dan krijg je de meest logische afstelrichting." />
            <Card>
              <View style={{ gap: spacing.s }}>
                {CVT_SYMPTOMS.map((s) => (
                  <Pressable
                    key={s.id}
                    accessibilityRole="button"
                    accessibilityLabel={s.label}
                    onPress={() => setSymptoms((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                    style={[styles.diagBtn, symptoms.includes(s.id) && styles.diagBtnActive]}
                  >
                    <Text style={styles.diagTitle}>{s.label}</Text>
                    <Text style={styles.diagSub}>
                      {s.priority} · {s.advice}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.divider} />
              <Text style={styles.label}>{userDiag.title}</Text>
              <Text style={styles.hint}>{userDiag.summary}</Text>
              {userDiag.steps.map((st, i) => (
                <Text key={i} style={styles.stepText}>
                  {`${i + 1}. ${st}`}
                </Text>
              ))}
              {symptoms.length > 0 ? (
                <>
                  <View style={styles.divider} />
                  <View style={styles.compareRow}>
                    <Text style={styles.compareName}>Rollen</Text>
                    <Text style={styles.compareVal}>{cvt.roller.toFixed(1)}g</Text>
                    <Text style={styles.compareArrow}>→</Text>
                    <Text style={[styles.compareVal, cvt.roller !== userDiag.suggested.roller && styles.changed]}>{userDiag.suggested.roller.toFixed(1)}g</Text>
                  </View>
                  {(['springIndex', 'belt'] as const).map((key) => {
                    const label = key === 'springIndex' ? cvtSpringLabel(cvt.springIndex) : `${cvt.belt}mm`;
                    const next = key === 'springIndex' ? cvtSpringLabel(userDiag.suggested.springIndex) : `${userDiag.suggested.belt}mm`;
                    return (
                      <View key={key} style={styles.compareRow}>
                        <Text style={styles.compareName}>{key === 'springIndex' ? 'Drukveer' : 'Snaar'}</Text>
                        <Text style={styles.compareVal}>{label}</Text>
                        <Text style={styles.compareArrow}>→</Text>
                        <Text style={[styles.compareVal, label !== next && styles.changed]}>{next}</Text>
                      </View>
                    );
                  })}
                  {[1, 2, 3].map((v) => {
                    const label = cvtClutchLabel(cvt.clutch);
                    const next = cvtClutchLabel(userDiag.suggested.clutch);
                    if (label === next) return null;
                    return (
                      <View key="clutch" style={styles.compareRow}>
                        <Text style={styles.compareName}>Trekveren</Text>
                        <Text style={styles.compareVal}>{label}</Text>
                        <Text style={styles.compareArrow}>→</Text>
                        <Text style={[styles.compareVal, label !== next && styles.changed]}>{next}</Text>
                      </View>
                    );
                  })}
                  <Button label="Suggestie toepassen" onPress={applyCvtSuggestion} />
                  <Text style={styles.hint}>Suggestie uitvoeren levert ±{cvtSpeedLabel(suggestedModel.topSpeed)} als verwachting.</Text>
                </>
              ) : null}
            </Card>
          </>
        ) : (
          <>
            <NumberedHeader n="1" title="STANDAARD VERTANDINGEN" subtitle="Kies een model als referentie of stel zelf in." />
            <Card>
              <ChipRow>
                {CHAIN_SPROCKET_PRESETS.map((preset) => (
                  <Chip
                    key={preset.id}
                    label={preset.label}
                    active={gearPresetId === preset.id}
                    onPress={() => {
                      setGearPresetId(preset.id);
                      setGearFront(preset.front);
                      setGearRear(preset.rear);
                    }}
                  />
                ))}
              </ChipRow>
              {PRIMARY_GEAR_INFO[block?.family ?? ''] ? (
                <Text style={styles.hint}>{PRIMARY_GEAR_INFO[block!.family]}</Text>
              ) : null}
              <Text style={styles.hint}>
                De interne primaire verhouding verschilt per blok en zit in de versnellingsbak zelf.
              </Text>
            </Card>

            <NumberedHeader n="2" title="JE COMBINATIE" subtitle="Voor = kettingrondsel · achter = wiel-tandwiel." />
            <Card>
              <Slider
                label="Voorste tandwiel (rondsel)"
                value={gearFront}
                min={10}
                max={17}
                step={1}
                unit="T"
                hint="Eén tand groter voor = langere gearing, meestal meer top en minder trek."
                onChange={(v) => setGearFront(v)}
              />
              <Slider
                label="Achterste tandwiel (wiel)"
                value={gearRear}
                min={35}
                max={75}
                step={1}
                unit="T"
                hint="Eén tand kleiner achter = langere gearing; groter achter = meer trek."
                onChange={(v) => setGearRear(v)}
              />
              <View style={styles.divider} />
              <Text style={styles.labelSmall}>VERHOUDING</Text>
              <Text style={styles.bigValue}>{gearing.ratio.toFixed(2)}</Text>
              {gearing.deltaPct !== null ? (
                <Text style={styles.midValue}>
                  {`${gearing.deltaPct > 0 ? '+' : ''}${String(gearing.deltaPct).replace('.', ',')}% t.o.v. ${gearPreset?.label ?? 'referentie'}`}
                </Text>
              ) : null}
              <Text style={styles.hint}>{gearing.direction}</Text>
              <View style={styles.divider} />
              <Text style={styles.labelSmall}>SUGGESTIES</Text>
              <ChipRow>
                {(Object.keys(GEAR_GOAL_LABELS) as GearingGoal[]).map((g) => (
                  <Chip
                    key={g}
                    label={GEAR_GOAL_LABELS[g]}
                    active={gearGoal === g}
                    onPress={() => setGearGoal((prev) => (prev === g ? null : g))}
                  />
                ))}
              </ChipRow>
              {gearGoal
                ? gearSuggestions.map((sug) => (
                    <View key={sug.id} style={styles.sugRow}>
                      <Text style={styles.sugTitle}>{sug.title}</Text>
                      <Text style={styles.sugDelta}>
                        {`${sug.deltaPct > 0 ? '+' : ''}${String(sug.deltaPct).replace('.', ',')}% ${
                          sug.goal === 'trek' ? 'korter' : 'langer'
                        } (ratio ${sug.ratio.toFixed(2)})`}
                      </Text>
                      <Text style={styles.hint}>{sug.note}</Text>
                      <Pressable
                        style={styles.sugApply}
                        onPress={() => {
                          setGearFront(sug.newFront);
                          setGearRear(sug.newRear);
                          setGearGoal(null);
                        }}
                      >
                        <Text style={styles.sugApplyText}>Instellen</Text>
                      </Pressable>
                    </View>
                  ))
                : null}
              <Text style={styles.nextStepText}>Vuistregels</Text>
              {GEARING_RULES.map((rule) => (
                <Text key={rule} style={styles.stepText}>
                  {'• ' + rule}
                </Text>
              ))}
              <Button label="Vertanding opslaan in tuninggeschiedenis" variant="secondary" onPress={saveGear} />
            </Card>
          </>
        )}

        <Card style={styles.disclaimerCard}>
          <Text style={styles.disclaimer}>
            Dit zijn universelke richtlijnen gebaseerd op algemene carburateur- en CVT-principes, geen exacte fabrieks-
            waarden. Gebruik het als startpunt om af te stellen — niet om blind onderdelen te bestellen.
          </Text>
          <Text style={styles.disclaimerBrand}>Gebruik deze waarden als startpunt, niet als heilige tekst.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  setupCard: { marginBottom: spacing.m },
  setupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setupCount: { color: colors.textSubtle, fontSize: 11 },
  setupSaveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s, marginTop: spacing.s },
  setupSaveBtn: { minWidth: 96, marginTop: 0 },
  setupActiveNote: { color: colors.success, fontSize: 11.5, marginTop: spacing.xs },
  liveCard: { marginBottom: spacing.m, backgroundColor: colors.surfaceAlt },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.m },
  liveEyebrow: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  liveTitle: { color: colors.text, fontSize: 17, fontWeight: '800', fontFamily: fonts.display, marginTop: 2 },
  liveTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh, marginTop: spacing.s, overflow: 'hidden' },
  liveFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  liveHint: { color: colors.textSubtle, fontSize: 11.5, marginTop: spacing.s },
  logNoteCard: { marginBottom: spacing.m },
  logNote: { color: colors.success, fontWeight: '700', fontSize: 13 },
  blockInfo: { marginTop: spacing.s, backgroundColor: colors.surfaceAlt, borderRadius: radii.s, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.s },
  blockInfoTitle: { color: colors.text, fontWeight: '800', fontSize: 14, textTransform: 'uppercase' },
  blockInfoLine: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  blockInfoPit: { color: colors.warning, fontSize: 12, lineHeight: 17, marginTop: 2 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  tabsCard: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  tabsRow: { flexDirection: 'row', gap: spacing.s, flex: 1 },
  numHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginBottom: spacing.m },
  numBadge: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: { color: colors.primary, fontWeight: '800', fontSize: 13, fontFamily: fonts.display },
  numTitle: { color: colors.text, fontSize: 15, fontWeight: '800', fontFamily: fonts.display, textTransform: 'uppercase' },
  numSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.xs - 2 },
  labelSmall: { color: colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs - 2 },
  bigValue: { color: colors.text, fontSize: 26, fontWeight: '800', fontFamily: fonts.display, marginTop: 2 },
  midValue: { color: colors.text, fontSize: 18, fontWeight: '700', fontFamily: fonts.display, marginTop: 2 },
  resultColText: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  nextStepText: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: spacing.s },
  jetRow: {},
  resultCol: {},
  divider: { height: 1, backgroundColor: colors.borderSoft, marginTop: spacing.m, marginBottom: spacing.s },
  mapRange: { color: colors.primary, fontWeight: '700', fontSize: 13, textTransform: 'uppercase' },
  mapComp: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  plugRow: { flexDirection: 'row', gap: spacing.s },
  plugScanRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.xs },
  plugTile: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radii.s, padding: spacing.s, borderWidth: 1, borderColor: colors.borderSoft },
  plugLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
  plugDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  diagBtn: { backgroundColor: colors.surfaceAlt, borderRadius: radii.s, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.s },
  diagBtnActive: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  diagTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  diagSub: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  diagResult: { marginTop: spacing.s, backgroundColor: colors.surfaceAlt, borderRadius: radii.s, padding: spacing.s, borderWidth: 1, borderColor: colors.primaryBorder },
  carterBtn: { backgroundColor: colors.surfaceAlt, borderRadius: radii.s, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.s },
  carterBtnActive: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  carterLabel: { color: colors.text, fontWeight: '700', fontSize: 14 },
  carterDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  carterBelt: { color: colors.textSubtle, fontSize: 11, marginTop: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surfaceAlt, borderRadius: radii.s, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.xs },
  stepperBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  stepperValue: { color: colors.text, fontWeight: '700', fontSize: 15, minWidth: 62, textAlign: 'center', fontFamily: fonts.display },
  verdictRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s },
  verdictSpeed: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.s },
  statTile: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radii.s, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.s, alignItems: 'center' },
  statLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statValue: { color: colors.text, fontWeight: '800', fontSize: 15, fontFamily: fonts.display, marginTop: 2 },
  stepText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  sugRow: { backgroundColor: colors.surfaceAlt, borderRadius: radii.s, padding: spacing.s, borderWidth: 1, borderColor: colors.borderSoft, marginTop: spacing.xs },
  sugTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  sugDelta: { color: colors.primary, fontWeight: '700', fontSize: 13, marginTop: 2 },
  sugApply: { alignSelf: 'flex-start', marginTop: spacing.s, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.primaryBorder, backgroundColor: colors.primarySubtle, paddingHorizontal: spacing.m, paddingVertical: spacing.xs },
  sugApplyText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  disclaimerCard: { marginTop: spacing.l },
  disclaimer: { color: colors.textSubtle, fontSize: 12, lineHeight: 18 },
  disclaimerBrand: { color: colors.textSubtle, fontSize: 12, marginTop: spacing.s, fontStyle: 'italic' },
  planRow: { flexDirection: 'row', gap: spacing.s, alignItems: 'flex-start' },
  planRowSpaced: { flexDirection: 'row', gap: spacing.s, alignItems: 'flex-start', marginTop: spacing.m },
  planDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planDotOk: { borderColor: colors.success, backgroundColor: 'rgba(34,197,94,0.12)' },
  planDotText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  planDotTextOk: { color: colors.success },
  planHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.s },
  planTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  planValue: { color: colors.success, fontSize: 12.5, fontWeight: '700' },
  planValueOff: { color: colors.primary },
  planWhy: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 1 },
  planHintMuted: { color: colors.textSubtle, fontSize: 12, lineHeight: 17, marginTop: spacing.s },
  changed: { color: colors.primary, fontWeight: '800' },
  compareRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  compareName: { width: 74, color: colors.textMuted, fontSize: 13 },
  compareVal: { width: 74, color: colors.text, fontSize: 13, fontWeight: '700' },
  compareArrow: { width: 22, color: colors.textSubtle, textAlign: 'center' },
});
