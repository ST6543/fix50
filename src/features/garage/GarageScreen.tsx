/** Garage-tab — Tuning en GPS-test bij elkaar, met segment-switch bovenin. */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';

import TuningScreen from '@/features/tuning/TuningScreen';
import PerformanceScreen from '@/features/performance/PerformanceScreen';
import FuelScreen from '@/features/fuel/FuelScreen';
import { DropletIcon, GaugeIcon, SlidersIcon } from '@/components/icons';
import { SegmentSwitch, TabHeader } from '@/components/ui';
import { colors, spacing } from '@/theme';

type Segment = 'tuning' | 'gpstest' | 'tankbeurten';

type TabParams = { Garage: { segment?: Segment } | undefined };

export default function GarageScreen() {
  const route = useRoute<RouteProp<TabParams, 'Garage'>>();
  const [segment, setSegment] = useState<Segment>(route.params?.segment ?? 'tuning');

  useEffect(() => {
    if (route.params?.segment) setSegment(route.params.segment);
  }, [route.params?.segment]);

  const segments = [
    { key: 'tuning' as const, label: 'Tuning', icon: SlidersIcon },
    { key: 'tankbeurten' as const, label: 'Tankbeurten', icon: DropletIcon },
    { key: 'gpstest' as const, label: 'GPS-test', icon: GaugeIcon },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TabHeader title="Garage" subtitle="Tuning, tankbeurten en metingen" />
      <SegmentSwitch segments={segments} value={segment} onChange={setSegment} style={styles.switchRow} />
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
  switchRow: { marginHorizontal: spacing.l, marginTop: spacing.s, marginBottom: spacing.s },
  body: { flex: 1 },
});
