/**
 * FIX50 motion-kit — lichte, consistente animaties zonder extra dependencies.
 * Alles via de ingebouwde Animated-API. Op native draait de driver op de
 * UI-thread (60 fps); op web (react-native-web) is er geen RCTAnimation-module,
 * dus daar forceert `useNativeDriver: true` anders een JS-fallback-warning.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

/** Op web geen native driver aanvragen — RNW heeft geen RCTAnimation-module. */
const NATIVE_DRIVER = Platform.OS === 'ios' || Platform.OS === 'android';

// ── FadeInView ───────────────────────────────────────────────
/** Fade + zachte slide-up bij mount. Gebruik `index` voor een stagger-effect in lijsten. */
export function FadeInView({
  children,
  index = 0,
  duration = 320,
  offset = 14,
  style,
}: {
  children: React.ReactNode;
  /** 0 = geen vertraging; anders delay = index * 45 ms (mooi in lijsten). */
  index?: number;
  duration?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration,
      delay: Math.min(index, 8) * 45, // cap zodat lange lijsten niet traag voelen
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [t, index, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ── PressableScale ───────────────────────────────────────────
/** Pressable die iets inspringt bij indrukken — consistent gevoel over de hele app. */
export function PressableScale({
  children,
  onPress,
  disabled,
  scaleTo = 0.97,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: React.ComponentProps<typeof Pressable>['accessibilityRole'];
  accessibilityState?: Record<string, unknown>;
  hitSlop?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    Animated.spring(scale, { toValue: scaleTo, speed: 50, bounciness: 0, useNativeDriver: NATIVE_DRIVER }).start();
  }, [scale, scaleTo]);

  const pressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, speed: 40, bounciness: 5, useNativeDriver: NATIVE_DRIVER }).start();
  }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState as never}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// ── TypingIndicator ──────────────────────────────────────────
/** Drie dansende puntjes — chatbot is "aan het denken". */
export function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 180),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={styles.typing}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0.3, 1], outputRange: [0, -3] }) }] }]} />
      ))}
    </Animated.View>
  );
}

// ── CountUp ─────────────────────────────────────────────────
/** Telt een getal op naar `value` (ease-out) — laat cijfers op dashboarden tot leven komen. */
export function CountUp({
  value,
  duration = 800,
  decimals = 0,
  prefix = '',
  suffix = '',
  style,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState(0);
  const val = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = val.addListener((state) => setDisplay(state.value));
    return () => val.removeListener(id);
  }, [val]);

  useEffect(() => {
    Animated.timing(val, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // waarde-driver: er worden geen native props geanimeerd, alleen tekst
    }).start();
  }, [val, value, duration]);

  return (
    <Text style={style}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </Text>
  );
}

// ── GrowInView ───────────────────────────────────────────────
/** Groeit vanuit de onderrand (scaleY + fade) — voor gegroeide balken in grafieken. */
export function GrowInView({
  children,
  index = 0,
  duration = 420,
  style,
}: {
  children: React.ReactNode;
  /** Vertraging = index * 45 ms (stagger in grafieken). */
  index?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration,
      delay: Math.min(index, 8) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [t, index, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ scaleY: t }],
          transformOrigin: 'bottom',
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  typing: { flexDirection: 'row', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9CA3AF' },
});
