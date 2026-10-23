/** Instellingen — notificaties, herinneringen, eenheden, taal. */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Button, Card, Chip, ChipRow, Loading, SectionTitle } from '@/components/ui';
import { getUserSettings, updateUserSettings } from '@/services/notifications';
import { colors, spacing } from '@/theme';

interface Settings {
  push_enabled: boolean;
  maintenance_notifications: boolean;
  reminder_days_ahead: number;
  reminder_km_before: number;
  weekly_overview: boolean;
  ai_watch_enabled: boolean;
  language: string;
  units: string;
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      getUserSettings()
        .then((s) => setSettings(s as Settings | null))
        .catch(() => setSettings(null))
        .finally(() => setLoading(false));
    }, []),
  );

  async function patch(update: Partial<Settings>) {
    if (!settings) return;
    const next = { ...settings, ...update };
    setSettings(next);
    await updateUserSettings(update).catch(() => undefined);
  }

  if (loading) return <Loading label="Instellingen laden…" />;
  if (!settings) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Card><Text style={styles.body}>Instellingen konden niet worden geladen. Ben je online?</Text></Card>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Meldingen</SectionTitle>
        <Card>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Pushmeldingen</Text>
            <Switch
              value={settings.push_enabled}
              onValueChange={(v) => patch({ push_enabled: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Onderhoudsmeldingen</Text>
            <Switch
              value={settings.maintenance_notifications}
              onValueChange={(v) => patch({ maintenance_notifications: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Weekoverzicht</Text>
            <Switch
              value={settings.weekly_overview}
              onValueChange={(v) => patch({ weekly_overview: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>

        <SectionTitle>Slimme signalen (AI)</SectionTitle>
        <Card>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>AI meekijken</Text>
            <Switch
              value={settings.ai_watch_enabled}
              onValueChange={(v) => patch({ ai_watch_enabled: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          <Text style={styles.hint}>
            Verwoordt je slimme signalen in gewone taal, met de diagnose-database als bron. De cijfers komen altijd uit je eigen data.
          </Text>
        </Card>

        <SectionTitle>Herinneringen vooraf</SectionTitle>
        <Card>
          <Text style={styles.label}>Kilometers vooraf waarschuwen</Text>
          <ChipRow>
            {[50, 100, 250, 500].map((v) => (
              <Chip key={v} label={`${v} km`} active={settings.reminder_km_before === v} onPress={() => patch({ reminder_km_before: v })} />
            ))}
          </ChipRow>
          <Text style={styles.label}>Dagen vooraf waarschuwen</Text>
          <ChipRow>
            {[1, 3, 7, 14].map((v) => (
              <Chip key={v} label={`${v} dgn`} active={settings.reminder_days_ahead === v} onPress={() => patch({ reminder_days_ahead: v })} />
            ))}
          </ChipRow>
        </Card>

        <SectionTitle>Eenheden & taal</SectionTitle>
        <Card>
          <Text style={styles.label}>Eenheden</Text>
          <ChipRow>
            <Chip label="km · km/h" active={settings.units === 'km'} onPress={() => patch({ units: 'km' })} />
          </ChipRow>
          <Text style={styles.label}>Taal</Text>
          <ChipRow>
            <Chip label="Nederlands" active={settings.language === 'nl'} onPress={() => patch({ language: 'nl' })} />
          </ChipRow>
          <Text style={styles.hint}>Meertaligheid komt in een latere versie.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.s,
  },
  switchLabel: { color: colors.text, fontSize: 15 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs, marginTop: spacing.s },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.s },
  body: { color: colors.textMuted },
});
