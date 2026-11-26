/** Inlogscherm — eerste scherm voor nieuwe gebruikers. */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, ErrorText, Eyebrow, IconTile, Input } from '@/components/ui';
import { MotoIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { APP_TAGLINE } from '@/constants/branding';
import { colors, fonts, spacing } from '@/theme';
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
            <IconTile tone="primary" size={62} radius={20} style={styles.logoMark}>
              <MotoIcon size={30} color={colors.primary} />
            </IconTile>
            <Text style={styles.logo}>
              FIX<Text style={styles.logoAccent}>50</Text>
            </Text>
            <Text style={styles.tagline}>{APP_TAGLINE}</Text>
          </View>

          <Card style={styles.card}>
            <Eyebrow style={{ marginBottom: spacing.l }}>Welkom terug</Eyebrow>
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
  content: {
    padding: spacing.xl,
    justifyContent: 'center',
    flexGrow: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  brandBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  logoMark: { marginBottom: spacing.l },
  logo: {
    fontFamily: fonts.displayBold,
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -1,
  },
  logoAccent: { color: colors.primary },
  tagline: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontSize: 14,
    fontFamily: fonts.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: { padding: spacing.xl },
});
