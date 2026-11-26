/** Onderhoudstaak-detail: interval aanpassen, uitschakelen, laatst gedaan. */
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';

import { Badge, Button, Card, Input, Loading, SectionTitle } from '@/components/ui';
import { useScooters } from '@/hooks/useScooters';
import { listRecords, registerMaintenance, updateSchedule } from '@/services/maintenance';
import { formatDate, formatKmShort, intervalLabel } from '@/lib/format';
import { colors, spacing } from '@/theme';
import type { MaintenanceItem, MaintenanceRecord, MaintenanceSchedule } from '@/types';

type RouteParams = { MaintenanceDetail: { scheduleId: string } };

/** Adviesbereik uit het onderhoudsschema, los van het gekozen interval. */
function adviceRange(item: MaintenanceItem): string | null {
  const parts: string[] = [];
  if (item.interval_km_min !== null) {
    parts.push(
      item.interval_km_max !== null && item.interval_km_max !== item.interval_km_min
        ? `${formatKmShort(item.interval_km_min)}–${formatKmShort(item.interval_km_max)} km`
        : `${formatKmShort(item.interval_km_min)} km`,
    );
  }
  if (item.interval_months_min !== null) {
    parts.push(
      item.interval_months_max !== null && item.interval_months_max !== item.interval_months_min
        ? `${item.interval_months_min}–${item.interval_months_max} mnd`
        : `${item.interval_months_min} mnd`,
    );
  }
  return parts.join(' · ') || null;
}

export default function MaintenanceDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'MaintenanceDetail'>>();
  const { activeScooter, reload: reloadScooters } = useScooters();
  const [schedule, setSchedule] = useState<MaintenanceSchedule | null>(null);
  const [item, setItem] = useState<MaintenanceItem | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [intervalKm, setIntervalKm] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { listSchedules, listMaintenanceItems } = await import('@/services/maintenance');
    const [schedules, items, recs] = await Promise.all([
      listSchedules(route.params.scheduleId ? (activeScooter?.id ?? '') : ''),
      listMaintenanceItems(),
      listRecords(activeScooter?.id ?? '', 20),
    ]);
    const s = schedules.find((x) => x.id === route.params.scheduleId) ?? null;
    setSchedule(s);
    setItem(items.find((i) => i.id === s?.item_id) ?? null);
    setIntervalKm(s?.interval_km ? String(s.interval_km) : '');
    setIntervalMonths(s?.interval_months ? String(s.interval_months) : '');
    setRecords(recs.filter((r) => r.item_id === s?.item_id).slice(0, 5));
    setLoading(false);
  }, [route.params.scheduleId, activeScooter]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleSaveInterval() {
    if (!schedule) return;
    const km = Number(intervalKm);
    const months = Number(intervalMonths);
    await updateSchedule(schedule.id, {
      interval_km: km > 0 ? km : null,
      interval_months: months > 0 ? months : null,
    }).catch(() => undefined);
    Alert.alert('Opgeslagen', 'Interval bijgewerkt.');
    void load();
  }

  async function handleComplete() {
    if (!schedule || !activeScooter) return;
    await registerMaintenance({
      scooterId: activeScooter.id,
      itemId: schedule.item_id,
      kmAtService: activeScooter.current_km,
      notes: null,
    }).catch(() => undefined);
    await reloadScooters();
    Alert.alert('Geregistreerd', 'Onderhoud is opgeslagen.');
    void load();
  }

  async function handleToggle() {
    if (!schedule) return;
    await updateSchedule(schedule.id, { enabled: !schedule.enabled }).catch(() => undefined);
    void load();
  }

  if (loading) return <Loading />;

  const advice = item ? adviceRange(item) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>{item?.name ?? 'Taak'}</Text>
            {schedule?.enabled ? <Badge label="Actief" tone="success" /> : <Badge label="Uit" />}
          </View>
          {schedule ? (
            <Text style={styles.meta}>
              Huidig interval: {intervalLabel(schedule.interval_km, schedule.interval_months)}
            </Text>
          ) : null}
          {advice ? <Text style={styles.meta}>Advies uit het schema: {advice}</Text> : null}
          {schedule && schedule.next_due_km === null && schedule.next_due_at === null ? (
            <Text style={styles.meta}>
              Nog geen volgende beurt bekend — registreer er een of stel hieronder een interval in.
            </Text>
          ) : null}
          {schedule?.next_due_km ? (
            <Text style={styles.meta}>Volgende keer: bij {schedule.next_due_km.toLocaleString('nl-NL')} km</Text>
          ) : null}
          {schedule?.next_due_at ? (
            <Text style={styles.meta}>Of voor {formatDate(schedule.next_due_at)}</Text>
          ) : null}
          {schedule?.last_done_km !== null && schedule?.last_done_km !== undefined ? (
            <Text style={styles.meta}>Laatst gedaan bij {schedule.last_done_km.toLocaleString('nl-NL')} km</Text>
          ) : null}
          <Button label="Nu uitvoeren" onPress={handleComplete} style={{ marginTop: spacing.m }} />
        </Card>

        <SectionTitle>Interval aanpassen</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input label="Elke X km" value={intervalKm} onChangeText={setIntervalKm} keyboardType="number-pad" placeholder="bijv. 3000" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Elke X maanden" value={intervalMonths} onChangeText={setIntervalMonths} keyboardType="number-pad" placeholder="bijv. 12" />
            </View>
          </View>
          <Button label="Interval opslaan" variant="secondary" onPress={handleSaveInterval} />
        </Card>

        <SectionTitle>Recente uitvoeringen</SectionTitle>
        {records.length === 0 ? (
          <Text style={styles.meta}>Nog nooit geregistreerd.</Text>
        ) : (
          records.map((r) => (
            <Card key={r.id} style={{ marginBottom: spacing.s }}>
              <Text style={styles.recordDate}>{formatDate(r.done_at)}</Text>
              <Text style={styles.meta}>{r.km_at_service ? `bij ${r.km_at_service.toLocaleString('nl-NL')} km` : ''}</Text>
              {r.notes ? <Text style={styles.meta}>{r.notes}</Text> : null}
            </Card>
          ))
        )}

        <Button label={schedule?.enabled ? 'Taak uitschakelen' : 'Taak inschakelen'} variant="ghost" onPress={handleToggle} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontWeight: '800', fontSize: 20 },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
  recordDate: { color: colors.text, fontWeight: '600' },
});
