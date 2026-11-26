/** Werkplaats-tab — Diagnose en Onderhoud bij elkaar, met segment-switch bovenin. */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';

import DiagnosisScreen from '@/features/diagnosis/DiagnosisScreen';
import MaintenanceScreen from '@/features/maintenance/MaintenanceScreen';
import { ChatIcon, WrenchIcon } from '@/components/icons';
import { SegmentSwitch } from '@/components/ui';
import { colors, spacing } from '@/theme';

type Segment = 'diagnose' | 'onderhoud';

type TabParams = { Werkplaats: { segment?: Segment } | undefined };

export default function WorkshopScreen() {
  const route = useRoute<RouteProp<TabParams, 'Werkplaats'>>();
  const [segment, setSegment] = useState<Segment>(route.params?.segment ?? 'diagnose');

  useEffect(() => {
    if (route.params?.segment) setSegment(route.params.segment);
  }, [route.params?.segment]);

  const segments = [
    { key: 'diagnose' as const, label: 'Diagnose', icon: ChatIcon },
    { key: 'onderhoud' as const, label: 'Onderhoud', icon: WrenchIcon },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SegmentSwitch segments={segments} value={segment} onChange={setSegment} style={styles.switchRow} />
      <View style={styles.body}>{segment === 'diagnose' ? <DiagnosisScreen embedded /> : <MaintenanceScreen embedded />}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  switchRow: { marginHorizontal: spacing.l, marginTop: spacing.m, marginBottom: spacing.s },
  body: { flex: 1 },
});
