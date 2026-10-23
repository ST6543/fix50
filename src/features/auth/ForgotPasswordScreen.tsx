/** Wachtwoord vergeten — verstuur herstelmail. */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, ErrorText, Input } from '@/components/ui';
import { requestPasswordReset } from '@/services/auth';
import { colors, spacing } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    setError(null);
    if (!email.includes('@')) {
      setError('Vul een geldig e-mailadres in.');
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Versturen mislukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          {sent ? (
            <>
              <Text style={styles.title}>Mail verstuurd</Text>
              <Text style={styles.body}>
                Staat er een mail met een herstellink naar {email.trim()}. Open die link op je telefoon om een
                nieuw wachtwoord in te stellen.
              </Text>
              <Button label="Terug naar inloggen" onPress={() => navigation.popToTop()} />
            </>
          ) : (
            <>
              <Text style={styles.title}>Wachtwoord vergeten</Text>
              <Text style={styles.body}>We sturen je een link om een nieuw wachtwoord in te stellen.</Text>
              <Input
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="jij@voorbeeld.nl"
              />
              {error ? <ErrorText>{error}</ErrorText> : null}
              <Button label="Herstelmail versturen" onPress={handleSend} loading={busy} />
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  body: { color: colors.textMuted, marginBottom: spacing.m, lineHeight: 20 },
});
