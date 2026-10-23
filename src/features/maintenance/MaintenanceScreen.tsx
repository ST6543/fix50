/** Onderhoud tab — weekoverzicht + reminders. */
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, EmptyState, Loading, SectionTitle, StatTile } from '@/components/ui';
import { AlertCircleIcon, CheckIcon, MotoIcon, WrenchIcon } from '@/components/icons';
import { FadeInView } from '@/components/motion';
import { useScooters } from '@/hooks/useScooters';
import {
  buildWeekOverview,
  dismissReminder,
  listMaintenanceItems,
  listOpenReminders,
  listSchedules,
} from '@/services/maintenance';
import { formatKm } from '@/lib/format';
import { colors, spacing } from '@/theme';
import type { MaintenanceReminder, WeekTask } from '@/types';

type Nav = AppNav;

export default function MaintenanceScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  const [tasks, setTasks] = useState<WeekTask[]>([]);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!activeScooter) {
        setLoading(false);
        return;
      }
      (async () => {
        setLoading(true);
        try {
          const [items, schedules, rems] = await Promise.all([
            listMaintenanceItems(),
            listSchedules(activeScooter.id),
            listOpenReminders(activeScooter.id),
          ]);
          setTasks(buildWeekOverview(schedules, items, activeScooter.current_km));
          setReminders(rems);
        } catch {
          setTasks([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [activeScooter]),
  );

  const overdue = tasks.filter((t) => t.overdue);
  const thisWeek = tasks.filter((t) => t.dueThisWeek && !t.overdue);

  function askComplete(t: WeekTask) {
    Alert.prompt?.(
      'Onderhoud uitvoeren',
      `Bij welke kilometerstand? (nu: ${activeScooter?.current_km ?? 0})`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Opslaan',
          onPress: async (kmText?: string) => {
            const km = Number(kmText) > 0 ? Number(kmText) : (activeScooter?.current_km ?? 0);
            const { registerMaintenance } = await import('@/services/maintenance');
            await registerMaintenance({
              scooterId: activeScooter!.id,
              itemId: t.schedule.item_id,
              kmAtService: km,
              notes: null,
            }).catch(() => undefined);
          },
        },
      ],
      'plain-text',
      String(activeScooter?.current_km ?? ''),
    );
  }

  if (loading) return <Loading label="Onderhoud laden…" />;

  if (!activeScooter) {
    return (
      <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
        <EmptyState
          icon={MotoIcon}
          title="Voeg eerst je brommer toe"
          subtitle="Onderhoud wordt per voertuig bijgehouden."
          actionLabel="Brommer toevoegen"
          onAction={() => navigation.navigate('Scooters')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <StatTile
            icon={WrenchIcon}
            tone="primary"
            label="Kilometerstand"
            value={formatKm(activeScooter.current_km)}
          />
          <StatTile
            icon={AlertCircleIcon}
            tone={overdue.length > 0 ? 'danger' : 'success'}
            label="Te laat"
            value={overdue.length}
          />
        </View>

        {reminders.length > 0 ? (
          <>
            <SectionTitle>Herinneringen</SectionTitle>
            {reminders.map((r, ri) => (
              <FadeInView key={r.id} index={ri}>
              <Card style={styles.reminderCard}>
                <View style={styles.reminderRow}>
                  <Badge
                    label={r.severity === 'warning' ? 'Te laat' : 'Herinnering'}
                    tone={r.severity === 'warning' ? 'danger' : 'warning'}
                  />
                  <Text style={styles.reminderTitle}>{r.title}</Text>
                </View>
                <Text style={styles.reminderBody}>{r.body}</Text>
                <View style={styles.reminderActions}>                    <Button
                    label="Gedaan"
                    onPress={async () => {
                      await dismissReminder(r.id, 'afgerond').catch(() => undefined);
                      setReminders((prev) => prev.filter((x) => x.id !== r.id));
                    }}
                    style={styles.reminderBtn}
                  />
                  <Button
                    label="Sluiten"
                    variant="ghost"
                    onPress={async () => {
                      await dismissReminder(r.id, 'genegeerd').catch(() => undefined);
                      setReminders((prev) => prev.filter((x) => x.id !== r.id));
                    }}
                    style={styles.reminderBtn}
                  />
                </View>
              </Card>
              </FadeInView>
            ))}
          </>
        ) : null}

        <SectionTitle
          action={
            <Button
              label="Onderhoud gedaan"
              variant="secondary"
              onPress={() => navigation.navigate('AddMaintenance')}
            />
          }
        >
          Deze week
        </SectionTitle>
        {thisWeek.length === 0 && overdue.length === 0 ? (
          <EmptyState
            icon={WrenchIcon}
            title="Niets te doen deze week"
            subtitle="Je onderhoud is op schema. Mooi meegenomen."
          />
        ) : null}
        {[...overdue, ...thisWeek].map((t, ti) => (
          <FadeInView key={t.schedule.id} index={ti}>
          <Card
            style={[styles.taskCard, t.overdue && { borderColor: colors.danger }]}
            onPress={() => navigation.navigate('MaintenanceDetail', { scheduleId: t.schedule.id })}
          >
            <View style={styles.taskRow}>
              <Text style={styles.taskName}>{t.item.name}</Text>
              {t.overdue ? <Badge label="Te laat" tone="danger" /> : <Badge label="Deze week" tone="warning" />}
            </View>
            <Text style={styles.taskMeta}>{t.dueLabel}</Text>
            <View style={styles.taskBtnRow}>
              <Button label="Uitgevoerd" variant="secondary" onPress={() => askComplete(t)} style={styles.taskBtn} />
              <View style={styles.taskCheck}>
                <CheckIcon size={18} color={colors.success} />
              </View>
            </View>
          </Card>
          </FadeInView>
        ))}

        <Button
          label="Volledige geschiedenis"
          variant="secondary"
          onPress={() => navigation.navigate('MaintenanceHistory')}
          style={{ marginTop: spacing.m }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.m, marginBottom: spacing.l },
  taskBtnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.s },
  taskCheck: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderCard: { marginBottom: spacing.m, borderLeftWidth: 3, borderLeftColor: colors.warning },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  reminderTitle: { color: colors.text, fontWeight: '700', flexShrink: 1 },
  reminderBody: { color: colors.textMuted, marginTop: spacing.xs },
  reminderActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  reminderBtn: { minHeight: 40, flex: 1 },
  taskCard: { marginBottom: spacing.m },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskName: { color: colors.text, fontWeight: '700', fontSize: 16, flexShrink: 1 },
  taskMeta: { color: colors.textMuted, marginTop: 2, marginBottom: spacing.s },
  taskBtn: { minHeight: 40, flex: 1 },
});
