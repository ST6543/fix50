/**
 * Kosten per kilometer en maandoverzicht voor één scooter.
 * De rekenregels staan in `@/lib/costs`; dit blok haalt alleen de al
 * opgeslagen onderhouds- en tankbeurten op en toont het resultaat.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Badge, Button, Card, SectionTitle, Skeleton } from '@/components/ui';
import { listRecords } from '@/services/maintenance';
import { formatCents, listFuelLogs } from '@/services/fuel';
import {
  buildCostSummary,
  formatCentsPerKm,
  type CostSummary,
} from '@/lib/costs';
import { formatDate, formatKm } from '@/lib/format';
import { colors, fonts, spacing, typography } from '@/theme';

const VALIDITY_LOOK = {
  goed: { label: 'Betrouwbaar', tone: 'success' },
  indicatief: { label: 'Indicatief', tone: 'warning' },
  onvoldoende: { label: 'Onvoldoende', tone: 'danger' },
} as const;

export default function CostsSection({ scooterId }: { scooterId: string }) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([listRecords(scooterId, 200), listFuelLogs(scooterId, 200)])
      .then(([records, fuelLogs]) => setSummary(buildCostSummary({ records, fuelLogs })))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [scooterId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View>
      <SectionTitle>Kosten per kilometer</SectionTitle>
      <Card>
        {loading ? (
          <>
            <Skeleton width="45%" height={26} />
            <Skeleton width="75%" height={10} style={{ marginTop: spacing.s }} />
            <Skeleton width="60%" height={10} style={{ marginTop: spacing.s }} />
          </>
        ) : failed ? (
          <>
            <Text style={styles.errorText}>
              Kostenoverzicht niet geladen. Controleer je verbinding en probeer het opnieuw.
            </Text>
            <Button
              label="Opnieuw proberen"
              variant="secondary"
              onPress={() => {
                setLoading(true);
                load();
              }}
              style={{ marginTop: spacing.m }}
            />
          </>
        ) : !summary || summary.totalCents === 0 ? (
          <Text style={styles.hint}>
            Nog geen kosten geregistreerd. Vul een bedrag in bij onderhoud of een tankbeurt; daarna
            rekent FIX50 hier kosten per kilometer en per maand uit.
          </Text>
        ) : (
          <>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.eyebrow}>Per kilometer</Text>
                <Text style={styles.bigValue}>
                  {summary.centsPerKm !== null ? formatCentsPerKm(summary.centsPerKm) : '—'}
                </Text>
                <Text style={styles.sub}>
                  {summary.distanceKm !== null && summary.from !== null
                    ? `${formatKm(summary.distanceKm)} sinds ${formatDate(summary.from)}`
                    : 'Nog te weinig kilometerstanden'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={typography.eyebrow}>Totaal</Text>
                <Text style={styles.bigValue}>{formatCents(summary.totalCents)}</Text>
                <Text style={styles.sub}>
                  {summary.entries} {summary.entries === 1 ? 'registratie' : 'registraties'}
                </Text>
              </View>
            </View>

            <View style={styles.validityRow}>
              <Badge
                label={VALIDITY_LOOK[summary.validity.level].label}
                tone={VALIDITY_LOOK[summary.validity.level].tone}
              />
              <Text style={styles.validityText}>{summary.validity.label}</Text>
            </View>
            {summary.validity.notes.map((note) => (
              <Text key={note} style={styles.note}>
                {note}
              </Text>
            ))}

            {summary.months.length > 0 ? (
              <>
                <View style={styles.divider} />
                <Text style={[typography.eyebrow, { marginBottom: spacing.s }]}>Per maand</Text>
                {summary.months.map((month) => {
                  const parts = [
                    month.maintenanceCents > 0 ? `onderhoud ${formatCents(month.maintenanceCents)}` : null,
                    month.fuelCents > 0 ? `brandstof ${formatCents(month.fuelCents)}` : null,
                    month.km !== null ? `${formatKm(month.km)} gemeten` : null,
                  ].filter(Boolean);
                  return (
                    <View key={month.month} style={styles.monthRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.monthLabel}>{month.label}</Text>
                        {parts.length > 0 ? (
                          <Text style={styles.monthSplit}>{parts.join(' · ')}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.monthTotal}>{formatCents(month.totalCents)}</Text>
                    </View>
                  );
                })}
                <Text style={styles.note}>
                  Alleen maanden met geregistreerde kosten. De gemeten afstand per maand is het
                  verschil tussen de eerste en laatste kilometerstand van die maand.
                </Text>
              </>
            ) : null}
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.m },
  bigValue: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  sub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  validityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s, marginTop: spacing.m },
  validityText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
  },
  note: {
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: spacing.s,
  },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginTop: spacing.m, marginBottom: spacing.m },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  monthLabel: { color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 13.5, fontWeight: '600' },
  monthSplit: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  monthTotal: {
    color: colors.primary,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: { color: colors.danger, fontFamily: fonts.body, fontSize: 13 },
  hint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
});
