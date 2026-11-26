/** Onderhoud — één plan per scooter: wat komt eraan, over hoeveel km, en wat is te laat. */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, EmptyState, SectionTitle, SkeletonScreen } from '@/components/ui';
import { AlertCircleIcon, ArrowRightIcon, MotoIcon, WrenchIcon } from '@/components/icons';
import { PressableScale } from '@/components/motion';
import { useScooters } from '@/hooks/useScooters';
import { useMaintenanceData } from '@/hooks/useAppData';
import {
  buildMaintenancePlan,
  groupPlan,
  planDueLong,
  planDueShort,
  summarizePlan,
} from '@/lib/maintenance-plan';
import { dismissReminder } from '@/services/maintenance';
import { syncLocalMaintenanceReminders } from '@/services/notifications';
import { highestDoneKm, isBelowLastService } from '@/lib/km-history';
import { formatKm } from '@/lib/format';
import { colors, fonts, radii, spacing, typography } from '@/theme';

type Nav = AppNav;

export default function MaintenanceScreen({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<Nav>();
  const { activeScooter } = useScooters();
  const {
    items,
    schedules,
    reminders,
    km,
    kmIsEstimated,
    loading,
    error: failed,
    refresh,
  } = useMaintenanceData();
  const [showAll, setShowAll] = useState(false);
  /** Laatst gesynchroniseerde km-stand; voorkomt herhalen bij elke focus. */
  const remSyncedRef = useRef<string | null>(null);

  const fuelSystem = activeScooter?.fuel_system ?? null;

  useFocusEffect(
    useCallback(() => {
      void refresh();
      // Lokale herinneringen volgen de km-stand: één keer per stand en planning.
      if (!activeScooter || schedules.length === 0) return;
      const syncKey = `${activeScooter.id}:${km}:${schedules.length}`;
      if (remSyncedRef.current === syncKey) return;
      remSyncedRef.current = syncKey;
      void syncLocalMaintenanceReminders({
        schedules,
        items,
        currentKm: km,
        fuelSystem: activeScooter.fuel_system,
      }).catch(() => undefined);
    }, [refresh, activeScooter, schedules, items, km]),
  );

  const plan = useMemo(
    () =>
      buildMaintenancePlan({
        items,
        schedules,
        currentKm: km,
        fuelSystem,
      }),
    [items, schedules, km, fuelSystem],
  );
  const groups = useMemo(() => groupPlan(plan), [plan]);
  const summary = useMemo(() => summarizePlan(plan), [plan]);
  /** Laatste beurt met een stand: een lagere km maakt het plan onbetrouwbaar. */
  const lastDoneKm = useMemo(() => highestDoneKm(schedules), [schedules]);
  const kmBehind = isBelowLastService(km, lastDoneKm);
  const laterCount = groups.find((group) => group.key === 'gepland')?.entries.length ?? 0;
  const planningFromNow = plan.filter((entry) => entry.basis === 'vanaf nu').length;
  const visibleGroups = showAll ? groups : groups.filter((group) => group.key !== 'gepland');

  async function handleDismiss(id: string, status: 'afgerond' | 'genegeerd') {
    await dismissReminder(id, status).catch(() => undefined);
    await refresh({ force: true });
  }

  if (loading) return <SkeletonScreen />;

  if (!activeScooter) {
    return (
      <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
        <EmptyState
          icon={MotoIcon}
          title="Voeg eerst je brommer toe"
          subtitle="Onderhoud wordt per voertuig bijgehouden. Zonder scooter weet de app niet welk blok je hebt."
          actionLabel="Brommer toevoegen"
          onAction={() => navigation.navigate('Scooters')}
        />
      </SafeAreaView>
    );
  }

  if (failed && items.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
        <EmptyState
          icon={AlertCircleIcon}
          tone="danger"
          title="Onderhoudsplan niet geladen"
          subtitle="Controleer je verbinding en probeer het opnieuw."
          actionLabel="Opnieuw proberen"
          onAction={() => void refresh({ force: true })}
        />
      </SafeAreaView>
    );
  }

  if (!fuelSystem) {
    return (
      <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            icon={WrenchIcon}
            title="Plan nog niet beschikbaar"
            subtitle="Vul in of je scooter 2T, 4T of injectie is. Dan weet de app welke onderdelen bij jouw blok horen en wanneer ze aan de beurt zijn."
            actionLabel="Brandstofsysteem instellen"
            onAction={() => navigation.navigate('EditScooter', { scooterId: activeScooter.id })}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={typography.eyebrowBrand}>Onderhoudsplan</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {activeScooter.name}
              </Text>
              <View style={styles.heroMetaRow}>
                <Text style={[styles.heroMeta, styles.heroMetaText]} numberOfLines={1}>
                  {fuelSystem} · {formatKm(km)}
                  {kmIsEstimated ? ' (geschat)' : ''}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Kilometerstand bijwerken"
                  onPress={() =>
                    navigation.navigate('EditScooter', { scooterId: activeScooter.id })
                  }
                  style={({ pressed }) => [styles.kmAction, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.kmActionLabel}>Bijwerken</Text>
                </Pressable>
              </View>
            </View>
            <Badge
              dot
              label={
                summary.overdue > 0 ? 'Actie nodig' : summary.soon > 0 ? 'Binnenkort' : 'Op schema'
              }
              tone={summary.overdue > 0 ? 'danger' : summary.soon > 0 ? 'warning' : 'success'}
            />
          </View>

          {kmBehind && lastDoneKm !== null ? (
            <View style={styles.kmWarn}>
              <Text style={styles.kmWarnTitle}>Stand lager dan je vorige beurt</Text>
              <Text style={styles.kmWarnBody}>
                Je laatste beurt staat op {formatKm(lastDoneKm)}, deze stand is {formatKm(km)}.
                Het plan rekent vanaf je beurt en lijkt daardoor te laat. Werk je kilometerstand
                bij of controleer de invoer.
              </Text>
            </View>
          ) : null}

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, summary.overdue > 0 && { color: colors.danger }]}>
                {summary.overdue}
              </Text>
              <Text style={styles.statLabel}>Te laat</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{summary.soon}</Text>
              <Text style={styles.statLabel}>Binnen 1.000 km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{summary.total}</Text>
              <Text style={styles.statLabel}>In je plan</Text>
            </View>
          </View>

          {summary.next ? (
            <View style={styles.nextBox}>
              <Text style={styles.nextLabel}>Volgende</Text>
              <Text style={styles.nextText}>
                {summary.next.item.name} · {planDueLong(summary.next)}
              </Text>
            </View>
          ) : null}
        </Card>

        {reminders.length > 0 ? (
          <>
            <SectionTitle>Herinneringen</SectionTitle>
            {reminders.map((reminder) => (
              <Card key={reminder.id} style={styles.reminderCard}>
                <View style={styles.reminderHead}>
                  <Badge
                    label={reminder.severity === 'warning' ? 'Te laat' : 'Herinnering'}
                    tone={reminder.severity === 'warning' ? 'danger' : 'warning'}
                  />
                  <Text style={styles.reminderTitle}>{reminder.title}</Text>
                </View>
                <Text style={styles.reminderBody}>{reminder.body}</Text>
                <View style={styles.reminderActions}>
                  <Button
                    label="Gedaan"
                    onPress={() => void handleDismiss(reminder.id, 'afgerond')}
                    style={styles.reminderBtn}
                  />
                  <Button
                    label="Sluiten"
                    variant="ghost"
                    onPress={() => void handleDismiss(reminder.id, 'genegeerd')}
                    style={styles.reminderBtn}
                  />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {groups.length === 0 ? (
          <EmptyState
            icon={WrenchIcon}
            title="Nog geen plan"
            subtitle="Er zijn nog geen onderhoudsintervallen bekend voor dit voertuig."
          />
        ) : null}

        {visibleGroups.map((group) => (
          <View key={group.key}>
            <SectionTitle>{group.title}</SectionTitle>
            <Card style={styles.listCard}>
              {group.entries.map((entry, index) => (
                <PressableScale
                  key={entry.schedule.id}
                  accessibilityLabel={`${entry.item.name}, ${planDueShort(entry)}`}
                  onPress={() =>
                    navigation.navigate('MaintenanceDetail', { scheduleId: entry.schedule.id })
                  }
                  style={[
                    styles.planRow,
                    index < group.entries.length - 1 && styles.rowDivider,
                  ]}
                >
                  <View style={styles.planCopy}>
                    <Text style={styles.planName} numberOfLines={1}>
                      {entry.item.name}
                    </Text>
                    <Text style={styles.planMeta} numberOfLines={1}>
                      {entry.interval}
                      {entry.dueKm !== null ? ` · bij ${formatKm(entry.dueKm)}` : ''}
                    </Text>
                  </View>
                  <View style={styles.planRight}>
                    <Badge
                      label={planDueShort(entry)}
                      tone={
                        entry.status === 'te laat'
                          ? 'danger'
                          : entry.status === 'binnenkort'
                            ? 'warning'
                            : 'neutral'
                      }
                    />
                    <ArrowRightIcon size={13} color={colors.textSubtle} />
                  </View>
                </PressableScale>
              ))}
            </Card>
            <Text style={styles.groupHint}>{group.hint}</Text>
          </View>
        ))}

        {laterCount > 0 ? (
          <Button
            label={showAll ? 'Toon minder' : `Toon alle ${summary.total} taken`}
            variant="secondary"
            onPress={() => setShowAll((prev) => !prev)}
            style={{ marginTop: spacing.m }}
          />
        ) : null}

        {planningFromNow > 0 ? (
          <Text style={styles.footnote}>
            {planningFromNow === 1 ? 'Eén taak is' : `${planningFromNow} taken zijn`} gerekend
            vanaf je huidige kilometerstand, omdat er nog geen beurt is geregistreerd. Zodra je
            een beurt opslaat, rekent het plan vanaf die stand.
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Onderhoud registreren"
            onPress={() => navigation.navigate('AddMaintenance')}
          />
          <Button
            label="Geschiedenis"
            variant="secondary"
            onPress={() => navigation.navigate('MaintenanceHistory')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  hero: { marginBottom: spacing.l },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.m },
  heroCopy: { flex: 1 },
  heroTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  heroMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: 2 },
  heroMetaText: { flex: 1, marginTop: 0 },
  kmAction: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: spacing.m + 2,
    paddingVertical: 5,
  },
  kmActionLabel: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '600',
  },
  kmWarn: {
    marginTop: spacing.m,
    padding: spacing.m,
    borderRadius: radii.m,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.22)',
    backgroundColor: 'rgba(250,204,21,0.06)',
  },
  kmWarnTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  kmWarnBody: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.l,
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: { width: 1, height: 28, backgroundColor: colors.borderSoft },
  nextBox: {
    marginTop: spacing.m,
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  nextLabel: {
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.primary,
  },
  nextText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13.5,
    color: colors.text,
    marginTop: 2,
  },
  reminderCard: { marginBottom: spacing.m },
  reminderHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s },
  reminderTitle: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '700',
    fontSize: 14.5,
    color: colors.text,
  },
  reminderBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  reminderActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  reminderBtn: { minHeight: 42, flex: 1 },
  listCard: { padding: 0, overflow: 'hidden' },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    minHeight: 58,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  planCopy: { flex: 1 },
  planName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.text,
  },
  planMeta: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  planRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flexShrink: 0 },
  groupHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSubtle,
    marginTop: spacing.s,
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSubtle,
    marginTop: spacing.m,
  },
  actions: { gap: spacing.s, marginTop: spacing.xl },
});
