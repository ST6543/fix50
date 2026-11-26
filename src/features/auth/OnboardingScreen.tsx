/**
 * Onboarding: kort — naam + scooter (merk/model/bloktype). Rest kan later.
 * Toont alleen als het profiel nog niet onboarded is.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, ErrorText, Input, ChipRow, Chip, SegmentSwitch } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useScooters } from '@/hooks/useScooters';
import { ENGINE_FAMILIES, FUEL_SYSTEMS, type EngineFamily } from '@/constants/branding';
import { supabase } from '@/lib/supabase';
import { parseDateInput } from '@/lib/invoice-selection';
import type { ServiceBaseline } from '@/lib/maintenance-baseline';
import { colors, fonts, spacing } from '@/theme';
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
  /** Laatste beurt: km + datum, of "net gekocht" (geen historie). */
  const [baselineMode, setBaselineMode] = useState<'service' | 'new'>('service');
  const [serviceKm, setServiceKm] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skipBusy, setSkipBusy] = useState(false);

  async function handleDone() {
    setError(null);
    if (!scooterName.trim()) {
      setError('Geef je brommer een naam, bijv. "Mijn Aerox".');
      return;
    }

    const currentKmNumber = Number(km.trim().replace(',', '.'));
    const currentKm = Number.isFinite(currentKmNumber) && currentKmNumber > 0 ? Math.round(currentKmNumber) : 0;

    // Zonder beurt blijft het plan eerlijk "vanaf nu" rekenen.
    let baseline: ServiceBaseline | null = null;
    if (baselineMode === 'service') {
      const doneAtIso = parseDateInput(serviceDate);
      if (!doneAtIso) {
        setError('Vul de datum van je laatste beurt in als DD-MM-JJJJ, of kies "Net gekocht".');
        return;
      }
      const serviceKmNumber = Number(serviceKm.trim().replace(',', '.'));
      if (!serviceKm.trim() || !Number.isFinite(serviceKmNumber) || serviceKmNumber < 0) {
        setError('Vul de kilometerstand van je laatste beurt in, of kies "Net gekocht".');
        return;
      }
      const todayIso = new Date().toISOString().slice(0, 10);
      if (doneAtIso > todayIso) {
        setError('De datum van je laatste beurt kan niet in de toekomst liggen.');
        return;
      }
      if (currentKm > 0 && Math.round(serviceKmNumber) > currentKm) {
        setError('De stand van je laatste beurt kan niet hoger zijn dan je huidige kilometerstand.');
        return;
      }
      baseline = { km: Math.round(serviceKmNumber), doneAtIso };
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
          current_km: currentKm,
        })
        .select('id')
        .single();
      if (sErr) throw sErr;

      // Basisplanning meteen vullen: de laatste beurt (of "vanaf nu") bepaalt
      // de eerste vervalstanden en vervaldatums.
      const { ensureSchedulesForScooter } = await import('@/services/maintenance');
      await ensureSchedulesForScooter({ id: scooter.id, fuel_system: fuel, baseline });

      await refreshProfile();
      await reload();
      navigation.replace('Main');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Overslaan moet het profiel ook echt als onboarded markeren. De navigator
   * toont Onboarding zolang `onboarded_at` leeg is; alleen naar Main navigeren
   * zou daarom meteen weer naar dit scherm terugvallen. Naam en scooter kun je
   * later invullen via je account.
   */
  async function handleSkip() {
    setError(null);
    setSkipBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Niet ingelogd');

      // .select() maakt een ontbrekend profiel zichtbaar als fout in plaats van
      // als een stille no-op.
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ onboarded_at: new Date().toISOString() })
        .eq('user_id', userData.user.id)
        .select('user_id')
        .single();
      if (pErr) throw pErr;

      // De navigator wisselt zelf naar Main zodra het profiel onboarded is;
      // hier navigeren zou naar een scherm gaan dat nog niet in de stack staat.
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Overslaan mislukt. Probeer het opnieuw.');
    } finally {
      setSkipBusy(false);
    }
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

          <Text style={styles.fieldLabel}>Laatste onderhoudsbeurt</Text>
          <SegmentSwitch
            segments={[
              { key: 'service' as const, label: 'Beurt bekend' },
              { key: 'new' as const, label: 'Net gekocht' },
            ]}
            value={baselineMode}
            onChange={setBaselineMode}
          />
          {baselineMode === 'service' ? (
            <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.m }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Km bij die beurt"
                  value={serviceKm}
                  onChangeText={setServiceKm}
                  keyboardType="number-pad"
                  placeholder="11000"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Datum (DD-MM-JJJJ)"
                  value={serviceDate}
                  onChangeText={setServiceDate}
                  placeholder="15-06-2026"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>
            </View>
          ) : null}
          <Text style={styles.baselineHint}>
            {baselineMode === 'service'
              ? 'We rekenen je eerste planning vanaf deze beurt, zodat de vervaldatums meteen kloppen.'
              : 'Geen beurt bekend? We rekenen vanaf je huidige stand en vandaag, tot je een beurt registreert.'}
          </Text>

          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            label="Ga naar FIX50"
            onPress={handleDone}
            loading={busy}
            disabled={skipBusy}
            style={{ marginTop: spacing.m }}
          />
          <Button
            label="Later invullen"
            variant="ghost"
            onPress={handleSkip}
            loading={skipBusy}
            disabled={busy}
          />
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
  baselineHint: {
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.s,
  },
});
