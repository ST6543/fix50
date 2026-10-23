/** Scooterdetail — km bijwerken, setup, verwijderen. */
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Button, Card, ErrorText, Input, SectionTitle } from '@/components/ui';
import { useScooters } from '@/hooks/useScooters';
import * as scootersService from '@/services/scooters';
import { kmUpdateSchema } from '@/lib/validation';
import { formatDate, formatKm } from '@/lib/format';
import { colors, spacing } from '@/theme';

type RouteParams = { ScooterDetail: { scooterId: string } };
type Nav = AppNav;

export default function ScooterDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'ScooterDetail'>>();
  const navigation = useNavigation<Nav>();
  const { scooters, activeScooter, setActiveScooterId, setup, reload, updateKm } = useScooters();
  const scooter = scooters.find((s) => s.id === route.params.scooterId) ?? null;

  const [km, setKm] = useState(scooter ? String(scooter.current_km) : '0');
  const [error, setError] = useState<string | null>(null);

  if (!scooter) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.body}>Scooter niet gevonden.</Text>
      </SafeAreaView>
    );
  }

  async function handleKmSave() {
    setError(null);
    const parsed = kmUpdateSchema.safeParse(Number(km));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Ongeldige kilometerstand');
      return;
    }
    try {
      await updateKm(parsed.data);
      Alert.alert('Opgeslagen', 'Kilometerstand bijgewerkt. Onderhoudsintervallen zijn gecontroleerd.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    }
  }

  async function handleDelete() {
    Alert.alert('Scooter verwijderen?', `Alles van "${scooter!.name}" wordt verwijderd (onderhoud, tuning, metingen).`, [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: async () => {
          await scootersService.deleteScooter(scooter!.id).catch(() => undefined);
          await reload();
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.name}>{scooter.name}</Text>
          <Text style={styles.meta}>
            {[scooter.brand, scooter.model].filter(Boolean).join(' ') || 'Merk onbekend'}
            {scooter.year ? ` · ${scooter.year}` : ''}
          </Text>
          <Text style={styles.meta}>
            {scooter.engine_type ?? 'Bloktype onbekend'}
            {scooter.fuel_system ? ` · ${scooter.fuel_system}` : ''}
          </Text>
          <Text style={styles.km}>{formatKm(scooter.current_km)}</Text>
          {scooter.notes ? <Text style={styles.notes}>{scooter.notes}</Text> : null}
          <View style={styles.actions}>
            {activeScooter?.id !== scooter.id ? (
              <Button label="Selecteren" variant="secondary" onPress={() => setActiveScooterId(scooter.id)} style={{ flex: 1 }} />
            ) : null}
            <Button
              label="Aanpassen"
              variant="secondary"
              onPress={() => navigation.navigate('EditScooter', { scooterId: scooter.id })}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        <SectionTitle>Kilometerstand bijwerken</SectionTitle>
        <Card>
          <Input label="Nieuwe kilometerstand" value={km} onChangeText={setKm} keyboardType="number-pad" />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Opslaan" onPress={handleKmSave} />
          <Text style={styles.hint}>
            Bij een hogere stand controleert FIX50 automatisch je onderhoudsintervallen.
          </Text>
        </Card>

        <SectionTitle>Setup</SectionTitle>
        <Card>
          {setup ? (
            <>
              {(
                [
                  ['Blok', setup.bloktype],
                  ['Cilinder', setup.cilinder],
                  ['Carburateur', setup.carburateur],
                  ['Maat (mm)', setup.carburateurmaat_mm],
                  ['Hoofdsproeier', setup.hoofdsproeier],
                  ['Stationairsproeier', setup.stationairsproeier],
                  ['Naald', setup.naaldpositie],
                  ['Luchtfilter', setup.luchtfilter],
                  ['Spruitstuk', setup.spruitstuk],
                  ['Membraan', setup.membraan],
                  ['Uitlaat', setup.uitlaat],
                  ['Vertanding', setup.vertanding],
                  ['Variateur', setup.variateur],
                  ['Rollen', setup.rollen],
                  ['Drukveer', setup.drukveer],
                  ['Trekveren', setup.trekveren],
                  ['Koppeling', setup.koppeling],
                  ['Bougie', setup.bougie],
                  ['Ontsteking', setup.ontsteking],
                  ['Brandstof', setup.brandstof],
                  ['Olie', setup.olie],
                  ['Overig', setup.overig],
                ] as [string, unknown][]
              )
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => (
                  <View key={k as string} style={styles.setupRow}>
                    <Text style={styles.setupKey}>{k}</Text>
                    <Text style={styles.setupValue}>{String(v)}</Text>
                  </View>
                ))}
              {Object.keys(setup).length <= 3 ? (
                <Text style={styles.hint}>Nog bijna niets ingevuld.</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.hint}>Nog geen setup ingevuld.</Text>
          )}
          <Button
            label="Setup bewerken"
            variant="secondary"
            onPress={() => navigation.navigate('EditScooter', { scooterId: scooter.id })}
            style={{ marginTop: spacing.m }}
          />
        </Card>

        <Button label="Deze scooter verwijderen" variant="ghost" onPress={handleDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  name: { color: colors.text, fontWeight: '800', fontSize: 22 },
  meta: { color: colors.textMuted, marginTop: 2 },
  km: { color: colors.primary, fontWeight: '800', fontSize: 18, marginTop: spacing.s },
  notes: { color: colors.textMuted, marginTop: spacing.s },
  actions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.m },
  hint: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.s },
  setupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setupKey: { color: colors.textMuted },
  setupValue: { color: colors.text, fontWeight: '600' },
  body: { color: colors.text, padding: spacing.xl },
});
