/**
 * Zichtbare offline-wachtrij: wat nog niet verstuurd is, staat hier — in plaats
 * van stil als mislukt of als verzonden te gelden.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, IconTile } from '@/components/ui';
import { SendIcon } from '@/components/icons';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { colors, fonts, spacing } from '@/theme';

/** Tijdstip van de oudste wachtende rij, bijv. "14:32". */
function timeLabel(ms: number | null): string | null {
  if (ms === null) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

export default function SyncBanner() {
  const { pending, oldestAt, syncing, flush } = useSyncQueue();
  if (pending === 0) return null;

  const since = timeLabel(oldestAt);
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <IconTile tone="warning" size={34} radius={10}>
          <SendIcon size={16} color={colors.warning} />
        </IconTile>
        <View style={styles.text}>
          <Text style={styles.title}>
            {pending === 1 ? '1 wijziging nog niet verzonden' : `${pending} wijzigingen nog niet verzonden`}
          </Text>
          <Text style={styles.body}>
            Bewaard op dit toestel{since ? ` sinds ${since}` : ''}. Zodra je online bent, gaan ze
            automatisch naar de server.
          </Text>
        </View>
      </View>
      <Button
        label={syncing ? 'Bezig…' : 'Nu proberen'}
        variant="secondary"
        onPress={() => void flush()}
        loading={syncing}
        style={{ marginTop: spacing.m }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.m, borderColor: 'rgba(250,204,21,0.28)' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.m },
  text: { flex: 1 },
  title: { color: colors.warning, fontFamily: fonts.bodySemiBold, fontSize: 14, fontWeight: '600' },
  body: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
});
