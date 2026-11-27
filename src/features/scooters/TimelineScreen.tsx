/** Tijdlijn per scooter — onderhoud, tanken, tuning, metingen en diagnoses op één lijn. */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';

import { Card, Chip, ChipRow, EmptyState, IconTile, Loading, type IconTone } from '@/components/ui';
import {
  ChatIcon,
  DropletIcon,
  SlidersIcon,
  TimerIcon,
  WrenchIcon,
  type IconProps,
} from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import { listRecords, listMaintenanceItems } from '@/services/maintenance';
import { listFuelLogs } from '@/services/fuel';
import { listChanges } from '@/services/tuning';
import { listRuns } from '@/services/performance';
import { listSessions } from '@/services/chat';
import {
  buildScooterTimeline,
  filterTimeline,
  TIMELINE_KINDS,
  timelineCounts,
  type TimelineEvent,
  type TimelineKind,
} from '@/lib/timeline';
import { formatDate } from '@/lib/format';
import { colors, fonts, layout, radii, spacing, typography } from '@/theme';

type RouteParams = { Timeline: { scooterId?: string } | undefined };

const KIND_LOOK: Record<TimelineKind, { icon: (p: IconProps) => React.ReactElement; tone: IconTone }> = {
  onderhoud: { icon: WrenchIcon, tone: 'primary' },
  tankbeurt: { icon: DropletIcon, tone: 'info' },
  tuning: { icon: SlidersIcon, tone: 'warning' },
  meting: { icon: TimerIcon, tone: 'success' },
  diagnose: { icon: ChatIcon, tone: 'neutral' },
};

const KIND_LABEL: Record<TimelineKind, string> = TIMELINE_KINDS.reduce(
  (acc, kind) => ({ ...acc, [kind.key]: kind.label }),
  {} as Record<TimelineKind, string>,
);

export default function TimelineScreen() {
  const route = useRoute<RouteProp<RouteParams, 'Timeline'>>();
  const { scooters, activeScooter } = useScooters();
  const scooterId = route.params?.scooterId ?? activeScooter?.id ?? null;
  const scooter = scooters.find((s) => s.id === scooterId) ?? null;

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimelineKind | 'alles'>('alles');

  useFocusEffect(
    useCallback(() => {
      if (!scooterId) {
        setEvents([]);
        setLoading(false);
        return;
      }
      let alive = true;
      setLoading(true);
      Promise.all([
        listRecords(scooterId, 200).catch(() => []),
        listMaintenanceItems().catch(() => []),
        listFuelLogs(scooterId, 200).catch(() => []),
        listChanges(scooterId, 200).catch(() => []),
        listRuns(200, scooterId).catch(() => []),
        // Gesprekken zijn niet per scooter op te halen; de bouwer filtert ze.
        listSessions().catch(() => []),
      ])
        .then(([records, items, fuelLogs, changes, runs, sessions]) => {
          if (!alive) return;
          setEvents(
            buildScooterTimeline({
              scooterId,
              records,
              items,
              fuelLogs,
              changes,
              runs,
              sessions,
            }),
          );
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [scooterId]),
  );

  const counts = useMemo(() => timelineCounts(events), [events]);
  const visible = useMemo(() => filterTimeline(events, filter), [events, filter]);

  if (loading) return <Loading label="Tijdlijn laden…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={visible}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{scooter?.name ?? 'Scooter'}</Text>
            <Text style={styles.subtitle}>
              Alles wat je met deze scooter doet, op één chronologische lijn.
            </Text>
            <ChipRow>
              <View style={styles.chipRow}>
                <Chip
                  label={`Alles · ${events.length}`}
                  active={filter === 'alles'}
                  onPress={() => setFilter('alles')}
                />
                {TIMELINE_KINDS.filter((kind) => counts[kind.key] > 0).map((kind) => (
                  <Chip
                    key={kind.key}
                    label={`${kind.label} · ${counts[kind.key]}`}
                    active={filter === kind.key}
                    onPress={() => setFilter(kind.key)}
                  />
                ))}
              </View>
            </ChipRow>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={WrenchIcon}
            title="Nog geen geschiedenis"
            subtitle="Zodra je onderhoud registreert, tankt, tunet of meet, verschijnt het hier."
          />
        }
        renderItem={({ item, index }) => (
          <TimelineRow event={item} last={index === visible.length - 1} />
        )}
      />
    </SafeAreaView>
  );
}

function TimelineRow({ event, last }: { event: TimelineEvent; last: boolean }) {
  const look = KIND_LOOK[event.kind];
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <IconTile tone={look.tone} size={30} radius={10}>
          {React.createElement(look.icon, { size: 15, color: colors.text })}
        </IconTile>
        {!last ? <View style={styles.railLine} /> : null}
      </View>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.kind}>{KIND_LABEL[event.kind]}</Text>
          <Text style={styles.date}>{formatDate(event.at)}</Text>
        </View>
        <Card style={styles.card}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          {event.detail ? <Text style={styles.detail}>{event.detail}</Text> : null}
          {event.meta.length > 0 ? (
            <View style={styles.metaRow}>
              {event.meta.map((label) => (
                <Text key={label} style={styles.meta}>
                  {label}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.l,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 3,
  },
  chipRow: { flexDirection: 'row', marginTop: spacing.m, marginBottom: spacing.s },
  row: { flexDirection: 'row', gap: spacing.m },
  rail: { width: 30, alignItems: 'center' },
  railLine: { flex: 1, width: 1, backgroundColor: colors.borderSoft, marginTop: spacing.xs },
  body: { flex: 1, paddingBottom: spacing.m },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.s },
  kind: { ...typography.eyebrow, marginBottom: spacing.xs },
  date: {
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginBottom: spacing.xs,
  },
  card: { paddingVertical: spacing.m, paddingHorizontal: spacing.l, borderRadius: radii.m },
  eventTitle: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14.5,
    fontWeight: '600',
  },
  detail: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginTop: spacing.s },
  meta: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
