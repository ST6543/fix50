/**
 * FIX50 charts — rustige, professionele grafieken.
 * Ontwerpprincipes: veel witruimte, kleur alleen semantisch (oranje accent),
 * dunne gridlines zonder as-frame, motion met betekenis (gegroeide balken, fade-in).
 */
import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Polygon, Polyline, Rect, Stop } from 'react-native-svg';

import { FadeInView, GrowInView } from '@/components/motion';
import { colors, spacing } from '@/theme';

// ── MiniBarChart ─────────────────────────────────────────────
/** Geanimeerde balkgrafiek (bijv. 7-daagse activiteit). Balken groeien met stagger van onderaf. */
export function MiniBarChart({
  data,
  height = 110,
  style,
}: {
  data: { label: string; value: number }[];
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={[styles.chartRow, style]}>
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} style={styles.barCol}>
          <View style={[styles.barTrack, { height }]}>
            <GrowInView index={i} style={styles.barGrow}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (d.value / max) * height),
                    backgroundColor: d.value > 0 ? colors.primary : colors.surfaceAlt,
                  },
                ]}
              />
            </GrowInView>
          </View>
          <Text style={styles.barLabel}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── TrendChart ───────────────────────────────────────────────
/**
 * Trendlijn van een waarde over tijd (bijv. verbruik per tankbeurt).
 * Punten zijn chronologisch; automatisch geschaald met marge, met markeerpunten.
 * Geeft null bij minder dan 2 punten — caller toont dan niets.
 */
export function TrendChart({
  data,
  height = 120,
  style,
}: {
  data: { label: string; value: number }[];
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (data.length < 2) return null;

  const W = 320;
  const PAD = { top: 12, bottom: 10, left: 10, right: 10 };
  const inner = height - PAD.top - PAD.bottom;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || Math.abs(max) * 0.15 || 1;
  const vMin = min - range * 0.2;
  const vMax = max + range * 0.2;

  const coords = data.map((d, i) => {
    const x = PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right);
    const y = PAD.top + (1 - (d.value - vMin) / (vMax - vMin)) * inner;
    return [x, y] as const;
  });
  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <FadeInView style={[styles.chartWrap, style]}>
      <Svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {[0.33, 0.66].map((f) => (
          <Line
            key={f}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + f * inner}
            y2={PAD.top + f * inner}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 6"
          />
        ))}
        <Line x1={PAD.left} x2={W - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} stroke={colors.border} strokeWidth={1} />
        <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 4 : 2.5} fill={i === coords.length - 1 ? colors.primary : colors.primaryDim} />
        ))}
      </Svg>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel} numberOfLines={1}>{data[0]!.label}</Text>
        <Text style={styles.axisLabel} numberOfLines={1}>{data[data.length - 1]!.label}</Text>
      </View>
    </FadeInView>
  );
}

// ── SpeedChart ───────────────────────────────────────────────
/** Lijngrafiek van snelheid over tijd: gradient-vulling, minimale gridlines, fade-in. */
export function SpeedChart({
  points,
  height = 150,
  style,
}: {
  points: { t_ms: number; speed_kmh: number }[];
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const gradientId = useRef(`speed-${Math.random().toString(36).slice(2, 8)}`).current;
  const W = 320;
  const PAD = { top: 10, bottom: 8, left: 6, right: 6 };
  const inner = height - PAD.top - PAD.bottom;

  const { linePath, areaPath, maxT } = useMemo(() => {
    const maxT = Math.max(...points.map((p) => p.t_ms), 1);
    const maxS = Math.max(...points.map((p) => p.speed_kmh), 10);
    const coords = points.map((p) => {
      const x = PAD.left + (p.t_ms / maxT) * (W - PAD.left - PAD.right);
      const y = PAD.top + (1 - p.speed_kmh / maxS) * inner;
      return [x, y] as const;
    });
    const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const first = coords.length > 0 ? coords[0] : undefined;
    const last = coords.length > 1 ? coords[coords.length - 1] : undefined;
    const areaPath =
      first && last
        ? `${linePath} L${last[0].toFixed(1)},${(height - PAD.bottom).toFixed(1)} L${first[0].toFixed(1)},${(height - PAD.bottom).toFixed(1)} Z`
        : '';
    return { linePath, areaPath, maxT };
  }, [points, height, inner]);

  return (
    <FadeInView style={[styles.chartWrap, style]}>
      <Svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Minimale gridlines: dun en gedempt, geen as-frame */}
        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={f}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + (1 - f) * inner}
            y2={PAD.top + (1 - f) * inner}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 6"
          />
        ))}
        <Line x1={PAD.left} x2={W - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} stroke={colors.border} strokeWidth={1} />

        {areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>0 s</Text>
        <Text style={styles.axisLabel}>{(maxT / 1000).toFixed(1)} s</Text>
      </View>
    </FadeInView>
  );
}

// ── MultiLineChart ───────────────────────────────────────────
/**
 * Meerdere voorspellingslijnen in één grafiek, met optionele onzekerheidsband.
 * Voorspellingen horen gestreept te zijn; echte metingen doorgetrokken.
 */
export function MultiLineChart({
  series,
  band,
  height = 180,
  xMax = 110,
  yMax = 12000,
  xUnit = 'km/u',
  yUnit = 'rpm',
}: {
  series: {
    label: string;
    color: string;
    dashed?: boolean;
    dash?: string;
    /** 1 = volle nadruk; lager dimt de lijn (bijv. niet-geselecteerde scenario's). */
    opacity?: number;
    width?: number;
    points: { x: number; y: number }[];
  }[];
  band?: { points: { x: number; yLow: number; yHigh: number }[]; color: string };
  height?: number;
  xMax?: number;
  yMax?: number;
  xUnit?: string;
  yUnit?: string;
}) {
  // Breed canvas dat met preserveAspectRatio="none" altijd de volle kaartbreedte vult.
  // De lijnen gebruiken non-scaling-stroke, zodat ze op elk scherm even dik blijven.
  const W = 1000;
  const PAD = { top: 12, bottom: 20, left: 34, right: 14 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const px = (x: number) => PAD.left + (Math.min(Math.max(x, 0), xMax) / xMax) * innerW;
  const py = (y: number) => PAD.top + (1 - Math.min(Math.max(y, 0), yMax) / yMax) * innerH;

  const bandPoints = band
    ? [
        ...band.points.map((p) => `${px(p.x).toFixed(1)},${py(p.yHigh).toFixed(1)}`),
        ...[...band.points].reverse().map((p) => `${px(p.x).toFixed(1)},${py(p.yLow).toFixed(1)}`),
      ].join(' ')
    : '';

  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={f}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + (1 - f) * innerH}
            y2={PAD.top + (1 - f) * innerH}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <Line x1={PAD.left} x2={W - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} stroke={colors.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <Line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={height - PAD.bottom} stroke={colors.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />

        {band && bandPoints ? <Polygon points={bandPoints} fill={band.color} opacity={0.22} /> : null}

        {series.map((s) => (
          <Polyline
            key={s.label}
            points={s.points.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={s.color}
            opacity={s.opacity ?? 1}
            strokeWidth={s.width ?? 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.dash ?? (s.dashed ? '6 5' : undefined)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </Svg>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>0 {xUnit}</Text>
        <Text style={styles.axisLabel}>
          {xMax} {xUnit}
        </Text>
      </View>
      <Text style={styles.axisNote}>verticale as: 0 – {yMax.toLocaleString('nl-NL')} {yUnit}</Text>
      <View style={styles.legendRow}>
        {series.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View
              style={[
                styles.legendSwatch,
                { backgroundColor: s.color },
                s.dashed ? styles.legendDashed : null,
              ]}
            />
            <Text style={styles.legendText} numberOfLines={1}>
              {s.label}
            </Text>
          </View>
        ))}
        {band ? (
          <View style={styles.legendItem}>
            <Rect width={14} height={8} fill={band.color} opacity={0.3} rx={2} />
            <Text style={styles.legendText}>onzekerheid</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.s },
  barCol: { flex: 1, alignItems: 'center', gap: spacing.s },
  barTrack: { alignSelf: 'stretch', justifyContent: 'flex-end' },
  barGrow: { alignSelf: 'stretch' },
  bar: { alignSelf: 'stretch', borderRadius: 6 },
  barLabel: { color: colors.textMuted, fontSize: 12.5 },
  chartWrap: { alignSelf: 'stretch' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  axisLabel: { color: colors.textMuted, fontSize: 12.5 },
  axisNote: { color: colors.textSubtle, fontSize: 10.5, marginTop: 1 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 14, height: 3, borderRadius: 2 },
  legendDashed: { opacity: 0.75 },
  legendText: { color: colors.textMuted, fontSize: 11.5 },
});
