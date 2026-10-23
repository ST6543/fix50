/** Garage-tab — Tuning en GPS-test bij elkaar, met segment-switch bovenin. */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';

import TuningScreen from '@/features/tuning/TuningScreen';
import PerformanceScreen from '@/features/performance/PerformanceScreen';
import FuelScreen from '@/features/fuel/FuelScreen';
import { DropletIcon, GaugeIcon, SlidersIcon } from '@/components/icons';
import { colors, fonts, spacing } from '@/theme';

type Segment = 'tuning' | 'gpstest' | 'tankbeurten';

type TabParams = { Garage: { segment?: Segment } | undefined };

export default function GarageScreen() {
  const route = useRoute<RouteProp<TabParams, 'Garage'>>();
  const [segment, setSegment] = useState<Segment>(route.params?.segment ?? 'tuning');

  useEffect(() => {
    if (route.params?.segment) setSegment(route.params.segment);
  }, [route.params?.segment]);

  const segments: { key: Segment; label: string; icon: React.ReactNode }[] = [
    { key: 'tuning', label: 'Tuning', icon: <SlidersIcon size={15} color={segment === 'tuning' ? colors.onPrimary : colors.textMuted} /> },
    { key: 'tankbeurten', label: 'Tankbeurten', icon: <DropletIcon size={15} color={segment === 'tankbeurten' ? colors.onPrimary : colors.textMuted} /> },
    { key: 'gpstest', label: 'GPS-test', icon: <GaugeIcon size={15} color={segment === 'gpstest' ? colors.onPrimary : colors.textMuted} /> },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.switchRow}>
        {segments.map((s) => {
          const active = segment === s.key;
          return (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSegment(s.key)}
              style={[styles.seg, active ? styles.segActive : styles.segInactive]}
            >
              {s.icon}
              <Text style={[styles.segLabel, active ? styles.segLabelActive : styles.segLabelInactive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.body}>
        {segment === 'tuning' ? (
          <TuningScreen embedded />
        ) : segment === 'tankbeurten' ? (
          <FuelScreen />
        ) : (
          <PerformanceScreen embedded />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  switchRow: {
    flexDirection: 'row',
    gap: spacing.s,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
    paddingBottom: spacing.s,
  },
  seg: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  segActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segInactive: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  segLabel: { fontFamily: fonts.display, fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  segLabelActive: { color: colors.onPrimary },
  segLabelInactive: { color: colors.textMuted },
  body: { flex: 1 },
});
