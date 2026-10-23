/** Privacy & gegevens — AVG-uitleg, cache wissen, account verwijderen. */
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, SectionTitle } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import * as authService from '@/services/auth';
import { clearCache } from '@/services/offline-cache';
import { colors, spacing } from '@/theme';

export default function PrivacyScreen() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  function handleDeleteAccount() {
    Alert.alert(
      'Account verwijderen?',
      'Alles wordt permanent verwijderd: scooters, onderhoud, tuning, metingen en gesprekken. Dit kan niet ongedaan worden.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Definitief verwijderen',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Laatste bevestiging',
              'Weet je het zeker? Je wordt uitgelogd en je gegevens worden opgeruimd.',
              [
                { text: 'Annuleren', style: 'cancel' },
                {
                  text: 'Ja, verwijderen',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(true);
                    try {
                      // 1) Server: account + data + foto's verwijderen.
                      await authService.deleteAccount();
                      // 2) Lokaal: cache en sessie opruimen.
                      await clearCache().catch(() => undefined);
                      await signOut().catch(() => undefined);
                      Alert.alert('Verwijderd', 'Je account en gegevens zijn verwijderd.');
                    } catch (err) {
                      Alert.alert(
                        'Verwijderen mislukt',
                        err instanceof Error ? err.message : 'Onbekende fout.',
                      );
                    } finally {
                      setBusy(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>Welke gegevens gebruikt FIX50?</SectionTitle>
        <Card>
          <Text style={styles.body}>
            • Je account (e-mail en naam) — nodig om je gegevens veilig bij jou te bewaren.{'\n'}
            • Je scooters, onderhoud, tuning en gesprekken — alleen zichtbaar voor jou.{'\n'}
            • Locatie — ALLÉÉN tijdens een performance-meting, om snelheid te meten. Routes worden niet opgeslagen;
            van meetpunten bewaren we alleen snelheid en nauwkeurigheid.{'\n'}
            • We verkopen niets en delen niets met derden.
          </Text>
        </Card>

        <SectionTitle>Jouw rechten</SectionTitle>
        <Card>
          <Text style={styles.body}>
            Je kunt op elk moment je gegevens bekijken in de app, metingen verwijderen, je scooters verwijderen of
            je hele account laten verwijderen.
          </Text>
        </Card>

        <SectionTitle>Opruimen</SectionTitle>
        <Card>
          <Button
            label="Lokale offline-cache wissen"
            variant="secondary"
            onPress={async () => {
              await clearCache().catch(() => undefined);
              Alert.alert('Klaar', 'Lokale cache gewist.');
            }}
          />
          <Text style={styles.hint}>Je online-gegevens blijven gewoon staan en worden opnieuw gecachet.</Text>
        </Card>

        <Button label="Account verwijderen" variant="danger" onPress={handleDeleteAccount} loading={busy} style={{ marginTop: spacing.l }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  body: { color: colors.text, lineHeight: 21 },
  hint: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.s },
});
