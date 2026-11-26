/** FIX50 UI-kit — één stijl voor alle schermen (Stitch: plat, zinc, oranje accent, display-cijfers). */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { PressableScale } from '@/components/motion';
import { ArrowRightIcon } from '@/components/icons';
import { colors, fonts, layout, radii, shadows, spacing, typography } from '@/theme';
import type { IconProps } from '@/components/icons';

// ── Eyebrow — uppercase micro-label (Stitch-signatuur) ───────
export function Eyebrow({
  children,
  brand,
  style,
}: {
  children: React.ReactNode;
  brand?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Text style={[brand ? typography.eyebrowBrand : typography.eyebrow, styles.eyebrowBlock, style as never]}>
      {children}
    </Text>
  );
}

// ── Button ───────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Optioneel icoon links van het label (ReactNode, bijv. <ChatIcon size={16} />). */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? 'rgba(239,68,68,0.10)'
        : variant === 'secondary'
          ? colors.surfaceAlt
          : 'transparent';
  const fg =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.text
          : colors.textMuted;
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
        variant === 'primary' && !disabled && shadows.glow,
        (variant === 'secondary' || variant === 'danger') && styles.buttonTinted,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
        </View>
      )}
    </PressableScale>
  );
}

// ── Card ─────────────────────────────────────────────────────
export function Card({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={[styles.card, style]}>
        <View pointerEvents="none" style={styles.cardGloss} />
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={[styles.card, style]}>
      <View pointerEvents="none" style={styles.cardGloss} />
      {children}
    </View>
  );
}

// ── IconTile — getint vierkant met border (Stitch icon-tiles) ──
export type IconTone = 'primary' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const iconTones: Record<IconTone, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primarySubtle, fg: colors.primary, border: colors.primaryBorder },
  neutral: { bg: colors.surfaceHigh, fg: colors.textMuted, border: colors.border },
  success: { bg: 'rgba(34,197,94,0.12)', fg: colors.success, border: 'rgba(34,197,94,0.3)' },
  warning: { bg: 'rgba(250,204,21,0.12)', fg: colors.warning, border: 'rgba(250,204,21,0.3)' },
  danger: { bg: 'rgba(239,68,68,0.12)', fg: colors.danger, border: 'rgba(239,68,68,0.3)' },
  info: { bg: 'rgba(56,189,248,0.12)', fg: colors.info, border: 'rgba(56,189,248,0.3)' },
};

export function IconTile({
  children,
  tone = 'primary',
  size = 40,
  radius = radii.m,
  style,
}: {
  children: React.ReactNode;
  tone?: IconTone;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = iconTones[tone];
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: t.bg,
          borderWidth: 1,
          borderColor: t.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── StatTile — compacte stat met icon-tile, eyebrow-label en display-cijfer ──
export function StatTile({
  icon,
  label,
  value,
  tone = 'primary',
  onPress,
  style,
}: {
  icon: (p: IconProps) => React.ReactElement;
  label: string;
  value: string | number;
  tone?: IconTone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <View style={styles.statRow}>
      <IconTile tone={tone} size={34} radius={10}>
        {React.createElement(icon, { size: 17, color: iconTones[tone].fg })}
      </IconTile>
      <View style={styles.statCol}>
        <Text style={typography.eyebrow} numberOfLines={1}>
          {label}
        </Text>
        <Text style={typography.stat} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={[styles.stat, style]}>
        {body}
      </PressableScale>
    );
  }
  return <View style={[styles.stat, style]}>{body}</View>;
}

// ── PressableTile — actie-tile met icoon, kop en sub ────────
export function PressableTile({
  icon,
  title,
  sub,
  onPress,
  style,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale onPress={onPress} style={[styles.pressTile, style]}>
      <View style={styles.pressTileHead}>
        <IconTile tone="primary" size={38} radius={11}>
          {icon}
        </IconTile>
        <ArrowRightIcon size={15} color={colors.textSubtle} />
      </View>
      <Text style={styles.pressTileTitle} numberOfLines={1}>
        {title}
      </Text>
      {sub ? (
        <Text style={styles.pressTileSub} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </PressableScale>
  );
}

// ── Ring — dunne voortgangsring om een metric ────────────────
export function Ring({
  progress,
  size = 64,
  strokeWidth = 4,
  color = colors.primary,
  trackColor = colors.border,
  children,
}: {
  /** 0…1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// ── MetricCard — hero-metric met eyebrow, grote display-waarde ─
export function MetricCard({
  label,
  value,
  unit,
  progress,
  icon,
  caption,
  style,
}: {
  label: string;
  /** String of node — bijv. <CountUp value={x} /> uit '@/components/motion'. */
  value: React.ReactNode;
  unit?: string;
  /** Optionele voortgang 0…1 voor de ring rondom de waarde. */
  progress?: number;
  icon?: React.ReactNode;
  caption?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card style={[styles.metric, style]}>
      <View style={styles.metricTop}>
        <Text style={typography.eyebrowBrand}>{label}</Text>
        {icon}
      </View>
      <View style={styles.metricRow}>
        {typeof progress === 'number' ? (
          <Ring progress={progress} size={76} strokeWidth={5}>
            <View style={styles.metricCenter}>
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
                {value}
              </Text>
              {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
            </View>
          </Ring>
        ) : (
          <View style={styles.metricValueRow}>
            <Text style={[typography.metric, styles.metricValue]}>{value}</Text>
            {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
          </View>
        )}
      </View>
      {caption ? <Text style={styles.metricCaption}>{caption}</Text> : null}
    </Card>
  );
}

// ── Slider — sleepbare baan met optionele doelmarkering ─────
/** Web-props die react-native-web doorgeeft maar die niet in ViewProps staan. */
type WebKeyboardProps = {
  onKeyDown?: (e: { key?: string; preventDefault?: () => void }) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  tabIndex?: number;
};

/** Procentwaarde voor absolute positionering binnen de baan. */
function asPercent(ratio: number): `${number}%` {
  return `${ratio * 100}%` as `${number}%`;
}

/** Positie van een waarde op de baan, 0 (min) tot 1 (max). */
function ratioOf(value: number, min: number, span: number): number {
  return Math.max(0, Math.min(1, (value - min) / span));
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  target,
  format,
  decimals = 0,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  /** Aanbevolen waarde uit het afsteladvies — verschijnt als streepje op de baan. */
  target?: number | null;
  /** Eigen weergave van de waarde (bijv. "8,5 g" of "7.600 rpm"). */
  format?: (v: number) => string;
  decimals?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<View>(null);
  const [trackX, setTrackX] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);

  const span = max - min || 1;
  const ratio = ratioOf(value, min, span);
  const targetRatio = typeof target === 'number' && Number.isFinite(target) ? ratioOf(target, min, span) : null;
  // Aan de uiteinden valt de knop binnen de baan, net als voorheen.
  const thumbOffset = ratio === 0 ? 0 : ratio === 1 ? -22 : -11;

  const snap = useCallback(
    (raw: number) => {
      const stepped = Math.round((raw - min) / step) * step + min;
      return Number(Math.min(max, Math.max(min, stepped)).toFixed(6));
    },
    [min, max, step],
  );

  const measure = useCallback(() => {
    trackRef.current?.measure?.((_x, _y, w, _h, pageX) => {
      setTrackX(pageX);
      setTrackW(w);
    });
  }, []);

  const setFromPageX = (pageX: number) => {
    if (trackW <= 0) return;
    onChange(snap(min + ((pageX - trackX) / trackW) * span));
  };

  const onGesture = (e: { nativeEvent: { pageX?: number; locationX?: number } }) => {
    const { pageX, locationX } = e.nativeEvent;
    setFromPageX(typeof pageX === 'number' ? pageX : trackX + (locationX ?? 0));
  };

  const display = format ? format(value) : `${value.toFixed(decimals).replace('.', ',')}${unit ? ` ${unit}` : ''}`;

  /**
   * Toetsenbordbediening (web): pijltjes één stap, PageUp/PageDown tien stappen,
   * Home/End naar de uiteinden. Dezelfde snap-functie als slepen, dus de waarde
   * blijft exact op het raster.
   */
  const onKeyDown = (e: { key?: string; preventDefault?: () => void }) => {
    if (disabled) return;
    const big = step * 10;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - step;
        break;
      case 'PageUp':
        next = value + big;
        break;
      case 'PageDown':
        next = value - big;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault?.();
    onChange(snap(next));
  };

  // Web-only props: toetsenbord, focus en tabvolgorde. Native kent dit niet; de
  // schermlezer gebruikt daar accessibilityActions hieronder.
  const webProps: ViewProps & WebKeyboardProps =
    Platform.OS === 'web'
      ? {
          onKeyDown,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          tabIndex: disabled ? -1 : 0,
        }
      : {};

  return (
    <View style={[styles.slider, disabled && { opacity: 0.5 }]}>
      <View style={styles.sliderHead}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <View style={styles.sliderValuePill}>
          <Text style={styles.sliderValue}>{display}</Text>
        </View>
      </View>
      <View
        ref={trackRef}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
        accessibilityState={{ disabled }}
        /* Echte slider-semantiek op web: RNW leest aria-* direct, accessibilityValue niet. */
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={display}
        {...webProps}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(snap(value + step));
          if (e.nativeEvent.actionName === 'decrement') onChange(snap(value - step));
        }}
        onLayout={(e) => {
          setTrackW(e.nativeEvent.layout.width);
          measure();
        }}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={(e) => {
          setDragging(true);
          measure();
          onGesture(e);
        }}
        onResponderMove={onGesture}
        onResponderRelease={() => setDragging(false)}
        onResponderTerminate={() => setDragging(false)}
        style={[styles.sliderTrackWrap, focused && styles.sliderTrackWrapFocused]}
      >
        {/*
          De baan, het streepje en de knop staan op procenten, niet op de gemeten
          breedte: die meting komt op web pas bij de eerste tik binnen, waardoor
          de knop na een toetsenbordstap op zijn oude plek bleef staan.
        */}
        <View style={styles.sliderRail} />
        <View style={[styles.sliderRailFill, { width: asPercent(ratio) }]} />
        {targetRatio !== null ? (
          <View pointerEvents="none" style={[styles.sliderTarget, { left: asPercent(targetRatio), marginLeft: -1 }]} />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            styles.sliderThumb,
            dragging && styles.sliderThumbActive,
            { left: asPercent(ratio), marginLeft: thumbOffset },
          ]}
        />
      </View>
      <View style={styles.sliderScale}>
        <Text style={styles.sliderScaleText}>{format ? format(min) : `${min}${unit ? ` ${unit}` : ''}`}</Text>
        {targetRatio !== null && typeof target === 'number' ? (
          <Text style={styles.sliderTargetText}>{`advies ${format ? format(target) : `${target}${unit ? ` ${unit}` : ''}`}`}</Text>
        ) : null}
        <Text style={styles.sliderScaleText}>{format ? format(max) : `${max}${unit ? ` ${unit}` : ''}`}</Text>
      </View>
      {hint ? <Text style={styles.sliderHint}>{hint}</Text> : null}
    </View>
  );
}

// ── Input ────────────────────────────────────────────────────
export function Input({
  label,
  error,
  hint,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSubtle}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          props.style,
          focused && styles.inputFocused,
          error ? { borderColor: colors.danger } : null,
        ]}
      />
      {hint && !error ? <Text style={styles.inputHint}>{hint}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

// ── Chip ─────────────────────────────────────────────────────
export function Chip({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
}) {
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.primary : colors.surfaceAlt, borderColor: active ? colors.primary : colors.border },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: active ? colors.onPrimary : colors.text },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

// ── Badge ────────────────────────────────────────────────────
type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const badgeTones: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: colors.surfaceHigh, fg: colors.textMuted, border: colors.border },
  success: { bg: 'rgba(34,197,94,0.13)', fg: colors.success, border: 'rgba(34,197,94,0.3)' },
  warning: { bg: 'rgba(250,204,21,0.12)', fg: colors.warning, border: 'rgba(250,204,21,0.3)' },
  danger: { bg: 'rgba(239,68,68,0.13)', fg: colors.danger, border: 'rgba(239,68,68,0.32)' },
  info: { bg: 'rgba(56,189,248,0.12)', fg: colors.info, border: 'rgba(56,189,248,0.3)' },
};

export function Badge({
  label,
  tone = 'neutral',
  dot,
}: {
  label: string;
  tone?: BadgeTone;
  /** Klein gekleurd stipje vóór het label — status in één oogopslag. */
  dot?: boolean;
}) {
  const t = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: t.fg }]} /> : null}
      <Text style={[styles.badgeLabel, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

// ── States ───────────────────────────────────────────────────
export function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.errorText}>{children}</Text>;
}

export function EmptyState({
  icon,
  tone = 'neutral',
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  /** Icoon-component, bijv. MotoIcon uit '@/components/icons'. */
  icon: (p: IconProps) => React.ReactElement;
  tone?: IconTone;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <IconTile tone={tone} size={56} radius={16}>
        {React.createElement(icon, { size: 24, color: iconTones[tone].fg })}
      </IconTile>
      <Text style={[typography.subheading, { textAlign: 'center', marginTop: spacing.l }]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.caption, { textAlign: 'center', marginTop: spacing.xs }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.l }} />
      ) : null}
    </View>
  );
}

export function Loading({ label = 'Gegevens laden…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[typography.caption, { marginTop: spacing.m }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={[styles.sectionRow, !action && { justifyContent: 'flex-start' }]}>
      <Text style={typography.eyebrow}>{children}</Text>
      {/* Dunne lijn ernaast geeft de sectiekop rust en richting. */}
      {!action ? <View style={styles.sectionRule} /> : null}
      {action}
    </View>
  );
}

// ── SegmentSwitch — segmented control voor tabs binnen een scherm ──
export type SegmentItem<T extends string> = {
  key: T;
  label: string;
  icon?: (p: { size?: number; color?: string }) => React.ReactElement;
};

export function SegmentSwitch<T extends string>({
  segments,
  value,
  onChange,
  style,
}: {
  segments: SegmentItem<T>[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmentWrap, style]}>
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <PressableScale
            key={s.key}
            accessibilityLabel={s.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(s.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <View style={styles.segmentInner}>
              {s.icon ? s.icon({ size: 15, color: active ? colors.primary : colors.textMuted }) : null}
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Horizontale chip-rij die buiten beeld scrollt. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  eyebrowBlock: { marginBottom: spacing.s },
  button: {
    minHeight: 50,
    borderRadius: radii.m,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
  },
  buttonTinted: { borderWidth: 1, borderColor: colors.border },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonIcon: { marginRight: spacing.s },
  buttonLabel: { fontFamily: fonts.display, fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.l,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: layout.cardPadding,
    ...shadows.card,
  },
  /** Lichtlijn bovenaan de kaart: laat het vlak net opgetild lijken. */
  cardGloss: {
    position: 'absolute',
    top: 0,
    left: spacing.l,
    right: spacing.l,
    height: 1,
    backgroundColor: colors.hairline,
    borderRadius: 1,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.m,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  statCol: { flexShrink: 1 },
  pressTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.m,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    minHeight: 118,
  },
  pressTileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pressTileTitle: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontWeight: '700',
    fontSize: 15.5,
    letterSpacing: -0.2,
    marginTop: spacing.m,
  },
  pressTileSub: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 3,
  },
  metric: { padding: spacing.xl },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.s },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.s },
  metricCenter: { alignItems: 'center' },
  metricValue: { color: colors.text },
  metricUnit: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '500',
  },
  metricCaption: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, marginTop: spacing.m },
  inputWrap: { marginBottom: spacing.m },
  inputLabel: { ...typography.eyebrow, marginBottom: spacing.xs },
  inputHint: {
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.m,
    color: colors.text,
    fontFamily: fonts.body,
    paddingHorizontal: spacing.m,
    minHeight: 50,
    fontSize: 15,
  },
  inputFocused: { borderColor: colors.primaryBorder, backgroundColor: colors.surface },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    marginRight: spacing.s,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.m,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeLabel: { fontFamily: fonts.display, fontSize: 11.5, fontWeight: '600', letterSpacing: 0.4 },
  errorText: { color: colors.danger, fontFamily: fonts.body, fontSize: 13, marginTop: spacing.xs },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
    marginBottom: spacing.m,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.borderSoft },
  segmentWrap: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.pill,
    justifyContent: 'center',
    paddingHorizontal: spacing.m,
  },
  segmentActive: { backgroundColor: colors.primarySubtle, borderWidth: 1, borderColor: colors.primaryBorder },
  segmentInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentLabel: { fontFamily: fonts.display, fontSize: 13, fontWeight: '600', letterSpacing: 0.2, color: colors.textMuted },
  segmentLabelActive: { color: colors.primary },
  chipRow: { paddingHorizontal: spacing.l, paddingVertical: spacing.s },
  slider: { marginTop: spacing.m },
  sliderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s },
  sliderLabel: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13.5, fontWeight: '600' },
  sliderValuePill: {
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: 3,
  },
  sliderValue: { color: colors.primary, fontFamily: fonts.display, fontSize: 14, fontWeight: '700' },
  sliderTrackWrap: { height: 34, justifyContent: 'center' },
  sliderTrackWrapFocused: {
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineColor: colors.primary,
    outlineOffset: 2,
    borderRadius: radii.s,
  },
  sliderRail: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh },
  sliderRailFill: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: colors.primary },
  sliderTarget: { position: 'absolute', width: 2, height: 18, borderRadius: 1, backgroundColor: colors.textSubtle },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  sliderThumbActive: { transform: [{ scale: 1.12 }] },
  sliderScale: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  sliderScaleText: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11 },
  sliderTargetText: { color: colors.textMuted, fontFamily: fonts.bodySemiBold, fontSize: 11, fontWeight: '600' },
  sliderHint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: spacing.xs },
});
