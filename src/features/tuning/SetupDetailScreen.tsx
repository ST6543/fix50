/** Setup editor — onderdelen toevoegen/aanpassen/verwijderen. */
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Button, Card, Chip, ChipRow, ErrorText, Input, SectionTitle } from '@/components/ui';
import { useScooters } from '@/hooks/useScooters';
import * as tuningService from '@/services/tuning';
import * as scootersService from '@/services/scooters';
import { colors, spacing } from '@/theme';

type RouteParams = { SetupDetail: { setupId?: string } };
type Nav = AppNav;

/** Veelgebruikte onderdelen als startpunt; uitbreidbaar via eigen velden. */
const COMMON_PARTS = [
  'Cilinder',
  'Carburateur',
  'Hoofdsproeier',
  'Luchtfilter',
  'Uitlaat',
  'Variateur',
  'Rollen',
  'Drukveer',
  'Trekveren',
  'Koppeling',
  'Vertanding',
  'Bougie',
] as const;

const PRESET_NAMES = ['Origineel', 'Dagelijks', 'Sport', 'Test setup'] as const;

export default function SetupDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'SetupDetail'>>();
  const navigation = useNavigation<Nav>();
  const { activeScooter, setup: currentSetup, reload } = useScooters();
  const editingId = route.params?.setupId;

  const [name, setName] = useState(editingId ? '' : 'Nieuwe setup');
  const [parts, setParts] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingId) {
      tuningService
        .listSetups(activeScooter?.id ?? '')
        .then((setups) => {
          const s = setups.find((x) => x.id === editingId);
          if (s) {
            setName(s.name);
            setParts(Object.fromEntries(Object.entries(s.parts ?? {}).map(([k, v]) => [k, String(v ?? '')])));
          }
        })
        .catch(() => undefined);
    } else if (currentSetup) {
      // Pre-fill vanuit de scooter-setup zodat de gebruiker niet opnieuw typt.
      const filled: Record<string, string> = {};
      if (currentSetup.cilinder) filled['Cilinder'] = currentSetup.cilinder;
      if (currentSetup.carburateur) filled['Carburateur'] = currentSetup.carburateur;
      if (currentSetup.hoofdsproeier) filled['Hoofdsproeier'] = String(currentSetup.hoofdsproeier);
      if (currentSetup.uitlaat) filled['Uitlaat'] = currentSetup.uitlaat;
      if (currentSetup.rollen) filled['Rollen'] = currentSetup.rollen;
      setParts(filled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  function setPart(key: string, value: string) {
    setParts((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    if (!activeScooter) {
      setError('Voeg eerst je brommer toe.');
      return;
    }
    if (!name.trim()) {
      setError('Geef de setup een naam.');
      return;
    }
    const cleaned = Object.fromEntries(
      Object.entries(parts).filter(([, v]) => v.trim() !== ''),
    );
    setBusy(true);
    try {
      if (editingId) {
        await tuningService.updateSetup(editingId, { name: name.trim(), parts: cleaned });
      } else {
        const created = await tuningService
          .createSetup(activeScooter.id, name.trim(), cleaned)
          .catch(async () => {
            // Bestaat de naam al? Dan bijwerken.
            const existing = await tuningService.listSetups(activeScooter.id);
            const found = existing.find((x) => x.name === name.trim());
            if (found) {
              await tuningService.updateSetup(found.id, { parts: cleaned });
              return found;
            }
            throw new Error('Kon setup niet opslaan.');
          });
        await tuningService.activateSetup(activeScooter.id, created.id);
      }
      await reload();
      Alert.alert('Opgeslagen', 'Setup bewaard.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setBusy(false);
    }
  }

  const keys = Array.from(new Set([...Object.keys(parts), ...COMMON_PARTS]));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.fieldLabel}>Naam</Text>
          <Input value={name} onChangeText={setName} placeholder="bijv. Sport" />
          <ChipRow>
            {PRESET_NAMES.map((n) => (
              <Chip key={n} label={n} onPress={() => setName(n)} />
            ))}
          </ChipRow>
        </Card>

        <SectionTitle>Onderdelen</SectionTitle>
        <Card>
          {keys.map((key) => (
            <Input
              key={key}
              label={key}
              value={parts[key] ?? ''}
              onChangeText={(v) => setPart(key, v)}
              placeholder={
                /sproeier/i.test(key) ? 'bijv. 92' : /rol/i.test(key) ? 'bijv. 6.5g' : 'waarde…'
              }
              keyboardType={/sproeier/i.test(key) || /rol/i.test(key) ? 'decimal-pad' : undefined}
            />
          ))}

          <View style={styles.addRow}>
            <View style={{ flex: 1 }}>
              <Input label="Eigen onderdeel" value={newKey} onChangeText={setNewKey} placeholder="bijv. Membraan" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Waarde" value={newValue} onChangeText={setNewValue} placeholder="bijv. VForce3" />
            </View>
          </View>
          {newKey.trim() ? (
            <Button
              label="Onderdeel toevoegen"
              variant="secondary"
              onPress={() => {
                setPart(newKey.trim(), newValue.trim());
                setNewKey('');
                setNewValue('');
              }}
            />
          ) : null}
        </Card>

        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button label="Setup opslaan" onPress={handleSave} loading={busy} style={{ marginTop: spacing.m }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  fieldLabel: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs },
  addRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
});
