/** Registratiescherm — naam, e-mail en wachtwoord. E-mail is verplicht. */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, ErrorText, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRegister() {
    setError(null);
    if (displayName.trim().length < 2) {
      setError('Vul je naam in.');
      return;
    }
    if (!email.trim().includes('@')) {
      setError('Vul een geldig e-mailadres in (bijv. jij@gmail.com).');
      return;
    }
    if (password.length < 6) {
      setError('Gebruik minimaal 6 tekens voor je wachtwoord.');
      return;
    }
    setBusy(true);
    try {
      await signUp(email, password, displayName);
      // Na succes registreren ben je meteen ingelogd; de auth-state
      // stuurt automatisch door naar onboarding/main.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registreren mislukt. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <Input label="Je naam" value={displayName} onChangeText={setDisplayName} placeholder="Bijv. Sven" autoComplete="name" />
            <Input
              label="E-mailadres"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              placeholder="jij@voorbeeld.nl"
            />
            <Input
              label="Wachtwoord (min. 6 tekens)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button label="Account aanmaken" onPress={handleRegister} loading={busy} style={{ marginTop: spacing.s }} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, justifyContent: 'center', flexGrow: 1 },
});
