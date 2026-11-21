/**
 * Carburateurdiagram — klikbare doorsnede.
 *
 * Kies een gasstand, zie welke onderdelen dan het mengsel bepalen, en tik een
 * onderdeel aan voor uitleg. Alles is een schema en een richtlijn: geen meting.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Badge, Button, Card, Chip, ChipRow, SectionTitle, Slider } from '@/components/ui';
import CarbDiagram from '@/components/CarbDiagram';
import {
  activePartsAt,
  bandAt,
  CARB_BAND_LABELS,
  CARB_PARTS,
  CARB_PARTS_BY_ID,
  circuitForPart,
  throttleSummary,
  type CarbPartId,
} from '@/lib/carb-diagram';
import { throttleBandLabel } from '@/lib/throttle-bands';
import type { AppNav } from '@/navigation/types';
import { colors, fonts, radii, spacing } from '@/theme';

const QUICK: { label: string; value: number }[] = [
  { label: 'Gas dicht', value: 0 },
  { label: '1/8 gas', value: 12.5 },
  { label: 'Halfgas', value: 50 },
  { label: 'Volgas', value: 100 },
];

export default function CarbDiagramScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<AppNav>();
  const [throttle, setThrottle] = useState(0);
  const [selected, setSelected] = useState<CarbPartId>('stationairsproeier');
  // Naar welk circuit van de sproeier-simulator dit onderdeel hoort (null = altijd actief).
  const circuit = circuitForPart(selected);

  const band = useMemo(() => bandAt(throttle), [throttle]);
  const activeIds = useMemo(() => activePartsAt(throttle), [throttle]);
  const part = CARB_PARTS_BY_ID[selected];
  const selectedActive = activeIds.includes(selected);

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Live-regio: kondigt de gekozen onderdeel aan, ook als je het in het diagram aantikt. */}
        <Text
          style={styles.srOnly}
          accessibilityLiveRegion="polite"
          aria-live="polite"
        >
          {`Gekozen: ${CARB_PARTS.indexOf(part) + 1}. ${part.label}, ${CARB_BAND_LABELS[part.band]}`}
        </Text>

        <Card>
          <Text style={styles.eyebrow}>DIAGRAM · GASSTAND {Math.round(throttle)}%</Text>
          <Text style={styles.title}>{band.component}</Text>
          <Text style={styles.body}>{band.why}</Text>
          <View style={styles.badgeRow}>
            <Badge label={band.range} tone="info" />
            <Badge label={`${activeIds.length} onderdelen actief`} tone="neutral" />
          </View>
          <Text style={styles.hint}>{throttleSummary(throttle)}</Text>
        </Card>

        <Card style={styles.sliderCard}>
          <Slider
            label="Gasstand"
            value={throttle}
            min={0}
            max={100}
            step={1}
            unit="%"
            hint="Sleep om te zien welk deel van de carburateur op dat moment het mengsel bepaalt."
            onChange={setThrottle}
          />
          <ChipRow>
            {QUICK.map((q) => (
              <Chip key={q.label} label={q.label} active={Math.round(throttle) === q.value} onPress={() => setThrottle(q.value)} />
            ))}
          </ChipRow>
        </Card>

        <Card style={styles.diagramCard}>
          <View style={styles.diagramWrap}>
            <CarbDiagram throttle={throttle} selected={selected} onSelect={setSelected} />
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>actief bij deze gasstand</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: colors.surfaceHigh, borderColor: colors.border, borderWidth: 1 }]} />
              <Text style={styles.legendText}>nu niet actief</Text>
            </View>
          </View>
          <Text style={styles.hint}>Tik een onderdeel of nummer aan voor uitleg.</Text>
        </Card>

        <SectionTitle>{`${CARB_PARTS.indexOf(part) + 1}. ${part.label}`}</SectionTitle>
        <Card>
          <View style={styles.partHead}>
            <Badge label={CARB_BAND_LABELS[part.band]} tone={part.band === 'altijd' ? 'neutral' : 'info'} />
            <Badge label={selectedActive ? 'actief bij deze gasstand' : 'niet actief nu'} tone={selectedActive ? 'success' : 'neutral'} />
          </View>
          <Text style={styles.partRole}>{part.role}</Text>

          <Text style={styles.labelSmall}>WAT JE MERKT ALS HET NIET KLOPT</Text>
          {part.symptoms.map((s) => (
            <View key={s} style={styles.bulletRow}>
              <Text style={styles.bullet}>·</Text>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <Text style={styles.labelSmall}>AFSTELLEN OF VERVANGEN</Text>
          <Text style={styles.body}>{part.adjust}</Text>

          {circuit ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.labelSmall}>HET BIJBEHORENDE GASBEREIK</Text>
              <Text style={styles.body}>{`${part.label} bepaalt het mengsel vooral bij ${throttleBandLabel(circuit)}.`}</Text>
              <Button
                label={`Naar de sproeier-simulator (${throttleBandLabel(circuit)})`}
                variant="secondary"
                onPress={() => navigation.navigate('Afstel', { circuit, partLabel: part.label })}
                style={{ marginTop: spacing.m }}
              />
            </>
          ) : (
            <Text style={styles.hint}>
              Dit onderdeel telt bij elke gasstand mee en hoort dus bij geen enkel gasbereik in de simulator.
            </Text>
          )}
        </Card>

        <SectionTitle>Alle onderdelen</SectionTitle>
        <Card style={styles.listCard}>
          {CARB_PARTS.map((p, i) => {
            const isActive = activeIds.includes(p.id);
            const isSelected = p.id === selected;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}. ${p.label} — ${CARB_BAND_LABELS[p.band]}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelected(p.id)}
                style={[styles.partRow, i > 0 && styles.partRowSpaced, isSelected && styles.partRowSelected]}
              >
                <View style={[styles.numBadge, isActive && styles.numBadgeActive, isSelected && styles.numBadgeSelected]}>
                  <Text style={[styles.numText, isActive && styles.numTextActive]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.partLabel, !isActive && !isSelected && styles.partLabelDim]}>{p.label}</Text>
                  <Text style={styles.partBand}>{CARB_BAND_LABELS[p.band]}</Text>
                </View>
                {isActive ? <View style={styles.activeDot} /> : null}
              </Pressable>
            );
          })}
        </Card>

        <Card style={styles.noteCard}>
          <Text style={styles.labelSmall}>LET OP</Text>
          <Text style={styles.hint}>
            Dit is een schema van een eenvoudige vlottercarburateur, geen fabrieksdoorsnede: kanalen, maten en
            sproeierposities verschillen per model. De gasstand bepaalt alleen welk deel het mengsel vooral regelt —
            de overgangen lopen vloeiend in elkaar over. De choke licht daarom nooit op: die hoort bij een koude start,
            niet bij een gasstand.
          </Text>
          <Text style={styles.hint}>
            Een te arm mengsel bij volgas kan de motor oververhitten. Controleer eerst op valse lucht voordat je
            sproeiers wijzigt.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  eyebrow: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 21,
    color: colors.text,
    marginTop: spacing.xs,
    letterSpacing: -0.3,
  },
  body: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20, marginTop: spacing.xs },
  hint: { color: colors.textSubtle, fontSize: 12.5, lineHeight: 18, marginTop: spacing.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.m },
  sliderCard: { marginTop: spacing.m },
  diagramCard: { marginTop: spacing.m },
  diagramWrap: { width: '100%', aspectRatio: 340 / 320 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m, marginTop: spacing.s },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: colors.textMuted, fontSize: 11.5 },
  partHead: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.s },
  partRole: { color: colors.text, fontSize: 14.5, lineHeight: 21 },
  labelSmall: {
    fontFamily: fonts.display,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textSubtle,
    textTransform: 'uppercase',
    marginTop: spacing.m,
    marginBottom: spacing.xs,
  },
  bulletRow: { flexDirection: 'row', gap: 6, marginTop: 3 },
  bullet: { color: colors.primary, fontSize: 13.5, lineHeight: 20 },
  bulletText: { flex: 1, color: colors.textMuted, fontSize: 13.5, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.m },
  listCard: { paddingVertical: spacing.s },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.s, paddingHorizontal: spacing.xs },
  partRowSpaced: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  partRowSelected: { backgroundColor: colors.primarySubtle, borderRadius: radii.s },
  numBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  numBadgeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  numBadgeSelected: { borderColor: colors.text },
  numText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.bodyBold },
  numTextActive: { color: colors.onPrimary },
  partLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyMedium },
  partLabelDim: { color: colors.textMuted },
  partBand: { color: colors.textSubtle, fontSize: 11.5, marginTop: 1 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  noteCard: { marginTop: spacing.m },
  // Alleen voor schermlezers: wel in de tree, niet zichtbaar op het scherm.
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
