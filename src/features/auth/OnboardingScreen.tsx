/**
 * Onboarding: kort — naam + scooter (merk/model/bloktype). Rest kan later.
 * Toont alleen als het profiel nog niet onboarded is.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, ErrorText, Input, ChipRow, Chip } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useScooters } from '@/hooks/useScooters';
import { ENGINE_FAMILIES, FUEL_SYSTEMS, type EngineFamily } from '@/constants/branding';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const { profile, refreshProfile } = useAuth();
  const { reload } = useScooters();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [scooterName, setScooterName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [engine, setEngine] = useState<EngineFamily | null>(null);
  const [fuel, setFuel] = useState<'2T' | '4T' | 'Injectie' | null>(null);
  const [km, setKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDone() {
    setError(null);
    if (!scooterName.trim()) {
      setError('Geef je brommer een naam, bijv. "Mijn Aerox".');
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Niet ingelogd');

      await supabase
        .from('profiles')
        .update({ display_name: name.trim() || null, onboarded_at: new Date().toISOString() })
        .eq('user_id', userData.user.id);

      const { data: scooter, error: sErr } = await supabase
        .from('scooters')
        .insert({
          user_id: userData.user.id,
          name: scooterName.trim(),
          brand: brand.trim() || null,
          model: model.trim() || null,
          engine_type: engine,
          fuel_system: fuel,
          current_km: Number(km) > 0 ? Number(km) : 0,
        })
        .select('id')
        .single();
      if (sErr) throw sErr;

      // Zorg dat de basis-onderhoudsschedules bestaan zodat reminders direct werken.
      const { ensureSchedulesForScooter } = await import('@/services/maintenance');
      await ensureSchedulesForScooter({ id: scooter.id, fuel_system: fuel });

      await refreshProfile();
      await reload();
      navigation.replace('Main');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  function handleSkip() {
    navigation.replace('Main');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.welcome}>Welkom bij FIX50</Text>
        <Text style={styles.subtitle}>Vertel kort over jezelf en je brommer. Je kunt later alles aanpassen.</Text>

        <Card>
          <Input label="Jouw naam" value={name} onChangeText={setName} placeholder="Bijv. Sven" />
          <Input label="Naam van je brommer/scooter" value={scooterName} onChangeText={setScooterName} placeholder="Bijv. Mijn Aerox" />
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input label="Merk" value={brand} onChangeText={setBrand} placeholder="Yamaha" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Model" value={model} onChangeText={setModel} placeholder="Aerox" />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Bloktype</Text>
          <ChipRow>
            {ENGINE_FAMILIES.map((e) => (
              <Chip key={e} label={e} active={engine === e} onPress={() => setEngine(e)} />
            ))}
          </ChipRow>

          <Text style={styles.fieldLabel}>Brandstofsysteem</Text>
          <ChipRow>
            {FUEL_SYSTEMS.map((f) => (
              <Chip key={f} label={f} active={fuel === f} onPress={() => setFuel(f)} />
            ))}
          </ChipRow>

          <Input label="Kilometerstand (mag leeg)" value={km} onChangeText={setKm} keyboardType="number-pad" placeholder="12450" />

          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Ga naar FIX50" onPress={handleDone} loading={busy} style={{ marginTop: spacing.m }} />
          <Button label="Later invullen" variant="ghost" onPress={handleSkip} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl },
  welcome: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.l },
  fieldLabel: { color: colors.textMuted, fontSize: 13, marginTop: spacing.m, marginBottom: spacing.xs },
});
