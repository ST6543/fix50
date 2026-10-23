/** Inlogscherm — eerste scherm voor nieuwe gebruikers. */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, ErrorText, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { APP_NAME, APP_TAGLINE } from '@/constants/branding';
import { colors, spacing } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      // Navigatie regelt de overgang via auth-state.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <Text style={styles.logo}>FIX50</Text>
            <Text style={styles.tagline}>{APP_TAGLINE}</Text>
          </View>

          <Card>
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
              label="Wachtwoord"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
            />
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button label="Inloggen" onPress={handleLogin} loading={busy} style={{ marginTop: spacing.s }} />
            <Button
              label="Account aanmaken"
              variant="secondary"
              onPress={() => navigation.navigate('Register')}
              style={{ marginTop: spacing.s }}
            />
            <Button
              label="Wachtwoord vergeten?"
              variant="ghost"
              onPress={() => navigation.navigate('ForgotPassword')}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, justifyContent: 'center', flexGrow: 1 },
  brandBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: { fontSize: 44, fontWeight: '900', color: colors.primary, letterSpacing: 1 },
  tagline: { color: colors.textMuted, marginTop: spacing.xs, fontSize: 15 },
});
