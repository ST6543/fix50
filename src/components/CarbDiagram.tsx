/**
 * Schematische doorsnede van een vlottercarburateur.
 *
 * Elk onderdeel is aantikbaar (vorm én nummer) en licht op als het bij de
 * gekozen gasstand het mengsel bepaalt. De tekening is een schema, geen
 * fabrieksdoorsnede: verhoudingen zijn bewust vereenvoudigd.
 *
 * Let op: geen onPress/accessibilityRole op de SVG-vormen. Op web maakt
 * react-native-svg daar HTML-buttons van (of crasht), waardoor de tekening
 * verdwijnt. De tikbare gebieden staan daarom als onzichtbare Pressables
 * bovenop het diagram, precies op de genummerde hotspots.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '@/theme';
import { CARB_PARTS, isPartActiveAt, clampThrottle, type CarbPartId } from '@/lib/carb-diagram';

const W = 340;
const H = 320;

/** Volgnummer per onderdeel, gelijk aan de lijst eronder. */
const PARTNUM: Record<CarbPartId, number> = CARB_PARTS.reduce(
  (acc, part, i) => {
    acc[part.id] = i + 1;
    return acc;
  },
  {} as Record<CarbPartId, number>,
);

export function CarbDiagram({
  throttle,
  selected,
  onSelect,
}: {
  /** Gasstand in procenten (0–100). */
  throttle: number;
  selected: CarbPartId | null;
  onSelect: (id: CarbPartId) => void;
}) {
  const t = clampThrottle(throttle);
  const open = t / 100;

  // De schuif zakt bij gesloten gas tot net boven de bodem van de venturi.
  const slideBottom = 118 - 28 * open;
  const needleTip = Math.min(152, slideBottom + 30);

  const styleFor = (id: CarbPartId) => {
    const part = CARB_PARTS.find((p) => p.id === id)!;
    const active = isPartActiveAt(part, t);
    const isSelected = selected === id;
    if (isSelected) {
      return { stroke: colors.primary, strokeWidth: 2.6, fill: 'rgba(255,107,0,0.30)', opacity: 1, on: true };
    }
    if (active) {
      return { stroke: 'rgba(255,107,0,0.75)', strokeWidth: 2, fill: 'rgba(255,107,0,0.16)', opacity: 1, on: true };
    }
    return { stroke: colors.border, strokeWidth: 1.6, fill: '#1A1D22', opacity: 0.7, on: false };
  };

  /** Positie van de genummerde hotspots, in viewBox-coördinaten. */
  const pins: { id: CarbPartId; x: number; y: number }[] = [
    { id: 'luchtfilter', x: 28, y: 58 },
    { id: 'choke', x: 72, y: 40 },
    { id: 'venturi', x: 161, y: 70 },
    { id: 'gasklep', x: 232, y: 62 },
    { id: 'naald', x: 226, y: 104 },
    { id: 'naaldsproeier', x: 168, y: 130 },
    { id: 'uitgang', x: 316, y: 128 },
    { id: 'vlotternaald', x: 101, y: 178 },
    { id: 'vlotter', x: 112, y: 240 },
    { id: 'hoofdsproeier', x: 178, y: 272 },
    { id: 'stationairsproeier', x: 234, y: 252 },
    { id: 'luchtschroef', x: 303, y: 184 },
  ];

  /** Genummerde hotspot; klikbaar en gekleurd naar de gasstand. */
  const Pinn = ({ id, x, y }: { id: CarbPartId; x: number; y: number }) => {
    const part = CARB_PARTS.find((p) => p.id === id)!;
    const active = isPartActiveAt(part, t);
    const isSelected = selected === id;
    const on = active || isSelected;
    return (
      <G>
        <Circle
          cx={x}
          cy={y}
          r={9.5}
          fill={on ? colors.primary : colors.surfaceHigh}
          stroke={isSelected ? colors.text : on ? colors.primary : colors.border}
          strokeWidth={isSelected ? 2 : 1.4}
        />
        <SvgText
          x={x}
          y={y + 3.6}
          fontSize={10}
          fontWeight="700"
          textAnchor="middle"
          fill={on ? colors.onPrimary : colors.textMuted}
        >
          {String(PARTNUM[id])}
        </SvgText>
      </G>
    );
  };

  const fuel = 'rgba(56,189,248,0.14)';

  return (
    <View style={styles.wrap}>
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
      {/* Luchtfilter links */}
      <G>
        <Rect
          x={10}
          y={66}
          width={36}
          height={86}
          rx={8}
          fill={styleFor('luchtfilter').fill}
          stroke={styleFor('luchtfilter').stroke}
          strokeWidth={styleFor('luchtfilter').strokeWidth}
        />
        {[0, 1, 2, 3].map((i) => (
          <Line key={i} x1={17 + i * 8} x2={17 + i * 8} y1={72} y2={146} stroke={colors.border} strokeWidth={2} />
        ))}
      </G>

      {/* Carburateurhuis */}
      <Rect x={46} y={50} width={254} height={110} rx={16} fill={colors.surface} stroke={colors.border} strokeWidth={1.6} />

      {/* Luchtkanaal: lichte band van filter naar motor */}
      <Rect x={50} y={70} width={246} height={70} fill={colors.surfaceHigh} stroke={colors.borderSoft} strokeWidth={1.2} />

      {/* Venturi-wanden: bepalen de vernauwing waar de lucht versnelt */}
      <G>
        <Path d="M 148 70 L 172 90 L 218 90 L 242 70 Z" fill={colors.surface} />
        <Path d="M 148 140 L 172 120 L 218 120 L 242 140 Z" fill={colors.surface} />
        <Path
          d="M 148 70 L 172 90 L 218 90 L 242 70"
          fill="none"
          stroke={styleFor('venturi').stroke}
          strokeWidth={styleFor('venturi').strokeWidth}
          strokeLinejoin="round"
        />
        <Path
          d="M 148 140 L 172 120 L 218 120 L 242 140"
          fill="none"
          stroke={styleFor('venturi').stroke}
          strokeWidth={styleFor('venturi').strokeWidth}
          strokeLinejoin="round"
        />
      </G>

      {/* Choke-klep bovenin het kanaal */}
      <G>
        <Ellipse
          cx={72}
          cy={78}
          rx={11}
          ry={9}
          fill={styleFor('choke').fill}
          stroke={styleFor('choke').stroke}
          strokeWidth={styleFor('choke').strokeWidth}
        />
        <Line x1={72} y1={69} x2={72} y2={58} stroke={styleFor('choke').stroke} strokeWidth={1.8} />
      </G>

      {/* Gasschuif: zakt bij gesloten gas naar beneden en dekt de volle venturi */}
      <G>
        <Rect
          x={172}
          y={68}
          width={46}
          height={Math.max(6, slideBottom - 68)}
          rx={3}
          fill={styleFor('gasklep').fill}
          stroke={styleFor('gasklep').stroke}
          strokeWidth={styleFor('gasklep').strokeWidth}
        />
      </G>

      {/* Naaldsproeier / verstuiverbuis */}
      <G>
        <Rect
          x={189}
          y={120}
          width={13}
          height={58}
          rx={2}
          fill={styleFor('naaldsproeier').fill}
          stroke={styleFor('naaldsproeier').stroke}
          strokeWidth={styleFor('naaldsproeier').strokeWidth}
        />
      </G>

      {/* Gasnaald: hangt aan de schuif en zakt mee de buis in */}
      <G>
        <Line
          x1={195.5}
          y1={slideBottom}
          x2={195.5}
          y2={needleTip}
          stroke={styleFor('naald').stroke}
          strokeWidth={3}
        />
        <Path
          d={`M 192 ${needleTip} L 195.5 ${needleTip + 6} L 199 ${needleTip}`}
          fill={styleFor('naald').fill}
          stroke={styleFor('naald').stroke}
          strokeWidth={1.6}
        />
      </G>

      {/* Uitgang naar de motor */}
      <G>
        <Path d="M 296 105 L 314 105" stroke={styleFor('uitgang').stroke} strokeWidth={3} strokeLinecap="round" />
        <Path
          d="M 308 99 L 317 105 L 308 111"
          fill="none"
          stroke={styleFor('uitgang').stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>

      {/* Vlotterkamer */}
      <Rect x={110} y={160} width={160} height={132} rx={12} fill={colors.surface} stroke={colors.border} strokeWidth={1.6} />
      <Rect x={114} y={210} width={152} height={78} rx={9} fill={fuel} />
      <Line x1={114} y1={210} x2={266} y2={210} stroke="rgba(56,189,248,0.5)" strokeWidth={1.4} strokeDasharray="5 4" />

      {/* Brandstoftoevoer */}
      <Rect x={56} y={192} width={56} height={12} rx={4} fill={colors.surfaceAlt} stroke={colors.border} strokeWidth={1.4} />

      {/* Vlotternaald: sluit de toevoer met de vlotter */}
      <G>
        <Rect
          x={116}
          y={190}
          width={9}
          height={16}
          rx={3}
          fill={styleFor('vlotternaald').fill}
          stroke={styleFor('vlotternaald').stroke}
          strokeWidth={styleFor('vlotternaald').strokeWidth}
        />
        <Path
          d="M 120.5 206 L 124 212 L 117 212 Z"
          fill={styleFor('vlotternaald').fill}
          stroke={styleFor('vlotternaald').stroke}
          strokeWidth={1.4}
        />
      </G>

      {/* Vlotter */}
      <G>
        <Rect
          x={128}
          y={226}
          width={74}
          height={22}
          rx={11}
          fill={styleFor('vlotter').fill}
          stroke={styleFor('vlotter').stroke}
          strokeWidth={styleFor('vlotter').strokeWidth}
        />
        <Line x1={124} y1={230} x2={130} y2={224} stroke={styleFor('vlotter').stroke} strokeWidth={1.8} />
      </G>

      {/* Hoofdsproeier onderin de verstuiverbuis */}
      <G>
        <Circle
          cx={195.5}
          cy={252}
          r={9}
          fill={styleFor('hoofdsproeier').fill}
          stroke={styleFor('hoofdsproeier').stroke}
          strokeWidth={styleFor('hoofdsproeier').strokeWidth}
        />
        <Circle cx={195.5} cy={252} r={3} fill={colors.background} />
      </G>

      {/* Stationaircircuit: kanaal, sproeier en luchtschroef */}
      <Path d="M 195.5 266 L 262 266 L 262 148" fill="none" stroke={colors.borderSoft} strokeWidth={3} strokeLinecap="round" />
      <G>
        <Circle
          cx={262}
          cy={238}
          r={9}
          fill={styleFor('stationairsproeier').fill}
          stroke={styleFor('stationairsproeier').stroke}
          strokeWidth={styleFor('stationairsproeier').strokeWidth}
        />
        <Circle cx={262} cy={238} r={2.8} fill={colors.background} />
      </G>
      <G>
        <Line x1={262} y1={204} x2={288} y2={204} stroke={styleFor('luchtschroef').stroke} strokeWidth={2.2} />
        <Circle
          cx={294}
          cy={204}
          r={7.5}
          fill={styleFor('luchtschroef').fill}
          stroke={styleFor('luchtschroef').stroke}
          strokeWidth={styleFor('luchtschroef').strokeWidth}
        />
        <Line x1={289} y1={204} x2={299} y2={204} stroke={styleFor('luchtschroef').stroke} strokeWidth={1.4} />
      </G>

      {/* Nummers bij de onderdelen */}
      {pins.map((p) => (
        <Pinn key={p.id} id={p.id} x={p.x} y={p.y} />
      ))}
    </Svg>

    {/* Onzichtbare tikvlakken bovenop de hotspots. */}
    {pins.map((p) => {
      const part = CARB_PARTS.find((x) => x.id === p.id)!;
      return (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${PARTNUM[p.id]}. ${part.label}`}
          onPress={() => onSelect(p.id)}
          style={[
            styles.hit,
            { left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` },
          ]}
        />
      );
    })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  hit: {
    position: 'absolute',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    borderRadius: 20,
  },
});

export default CarbDiagram;
