/** FIX50 UI-kit — één stijl voor alle schermen (Stitch: plat, zinc, oranje accent, display-cijfers). */
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { PressableScale } from '@/components/motion';
import { ArrowRightIcon } from '@/components/icons';
import { colors, fonts, radii, spacing, typography } from '@/theme';
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
        ? colors.danger
        : variant === 'secondary'
          ? colors.surfaceAlt
          : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger'
      ? colors.onPrimary
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
        variant === 'secondary' && styles.buttonSecondary,
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
        {children}
      </PressableScale>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
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

// ── Input ────────────────────────────────────────────────────
export function Input({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textSubtle}
        {...props}
        style={[styles.input, props.style, error ? { borderColor: colors.danger } : null]}
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

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const t = badgeTones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
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
      {action}
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
    minHeight: 48,
    borderRadius: radii.m,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
  },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  buttonIcon: { marginRight: spacing.s },
  buttonLabel: { fontFamily: fonts.display, fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.m,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
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
    minHeight: 48,
    fontSize: 15,
  },
  chip: {
    borderRadius: radii.m,
    borderWidth: 1,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    marginRight: spacing.s,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, fontWeight: '600' },
  badge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.m,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontFamily: fonts.display, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  errorText: { color: colors.danger, fontFamily: fonts.body, fontSize: 13, marginTop: spacing.xs },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.m,
  },
  chipRow: { paddingHorizontal: spacing.l, paddingVertical: spacing.s },
});
