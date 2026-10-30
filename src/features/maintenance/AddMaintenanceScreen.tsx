/** Onderhoud registreren — "Ik heb vandaag mijn olie vervangen." — of scan je factuur. */
import React, { useEffect, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Button, Card, Chip, ChipRow, EmptyState, ErrorText, Input, SectionTitle } from '@/components/ui';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { MotoIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import { listMaintenanceItems, registerMaintenance } from '@/services/maintenance';
import * as scootersService from '@/services/scooters';
import { scanInvoice, type InvoiceSuggestion } from '@/services/invoice-scan';
import { shrinkForScan } from '@/lib/image-shrink';
import { euroSchema, eurosToCents, kmUpdateSchema } from '@/lib/validation';
import { base64ToBytes, detectImageMime } from '@/lib/base64';
import { colors, spacing } from '@/theme';
import type { MaintenanceItem } from '@/types';

type Nav = AppNav;

export default function AddMaintenanceScreen() {
  const navigation = useNavigation<Nav>();
  const { activeScooter, reload } = useScooters();
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [km, setKm] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState('');
  const [parts, setParts] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Factuur-scan ───────────────────────────────────────────────────────────
  const [scanBusy, setScanBusy] = useState(false);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedPreview, setScannedPreview] = useState<string | null>(null);

  /** Foto maken/kiezen en direct naar de scan-stap (verkleinen via lib/image-shrink). */
  async function handleScan(source: 'camera' | 'library') {
    setScanError(null);
    setScanInfo(null);
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setScanError('Geen toestemming voor de camera/foto\'s — zet dit aan in de instellingen.');
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true, exif: false });
    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    const shrunk = await shrinkForScan(asset);
    const base64 = shrunk.base64;
    const mime = shrunk.mime;
    setScannedPreview(`data:${mime};base64,${base64}`);
    setScanBusy(true);
    try {
      const out = await scanInvoice({ base64, mime, scooterId: activeScooter?.id ?? null });
      if (!out.found || !out.suggestion) {
        setScanError(out.warning ?? 'Kon geen onderhoudsinfo in deze foto vinden.');
        return;
      }
      applySuggestion(out.suggestion);
      const confText = out.confidence === 'hoog' ? '' : ` (${out.confidence} zekerheid — controleer het goed)`;
      setScanInfo(
        `Gevonden op de factuur${confText}. Check de velden hieronder en vul aan wat ontbreekt.` +
          (out.missing_fields.length > 0 ? ` Niet op de factuur: ${out.missing_fields.join(', ')}.` : ''),
      );
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scannen mislukt. Probeer het opnieuw.');
    } finally {
      setScanBusy(false);
    }
  }

  /** AI-voorstel → formulier-velden (alleen niet-lege waarden overschrijven). */
  function applySuggestion(s: InvoiceSuggestion) {
    if (s.km_at_service !== null) setKm(String(s.km_at_service));
    if (s.service_date) setDate(s.service_date);
    if (s.cost_cents !== null) setCost((s.cost_cents / 100).toFixed(2).replace('.', ','));
    if (s.parts) setParts(s.parts);
    const noteParts: string[] = [];
    if (s.workshop_name) noteParts.push(`Werkplaats: ${s.workshop_name}`);
    if (s.notes) noteParts.push(s.notes);
    if (noteParts.length > 0) setNotes(noteParts.join(' — '));
    if (s.item_name) {
      const match = items.find(
        (i) => i.name.toLowerCase() === s.item_name!.toLowerCase(),
      );
      if (match) setSelectedId(match.id);
      else if (!s.custom_name) setCustomName(s.item_name);
    }
    if (s.custom_name) setCustomName(s.custom_name);
  }
  // ────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    listMaintenanceItems()
      .then((list) => {
        setItems(list);
        if (list[0]) setSelectedId(list[0].id);
      })
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (activeScooter) setKm(String(activeScooter.current_km));
  }, [activeScooter]);

  if (!activeScooter) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <EmptyState
          icon={MotoIcon}
          title="Voeg eerst je brommer toe"
          actionLabel="Naar scooters"
          onAction={() => navigation.navigate('Scooters')}
        />
      </SafeAreaView>
    );
  }

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;
  const active = activeScooter;

  async function handleSave() {
    setError(null);
    if (!active) return;
    const kmParsed = kmUpdateSchema.safeParse(Number(km));
    if (!kmParsed.success) {
      setError(kmParsed.error.issues[0]?.message ?? 'Ongeldige kilometerstand');
      return;
    }
    if (!selectedItem && !customName.trim()) {
      setError('Kies een onderdeel of vul een eigen omschrijving in.');
      return;
    }
    const costCents = eurosToCents(cost);
    if (cost.trim() && costCents === null) {
      setError('Ongeldige kosten — vul bijv. 12,50 in.');
      return;
    }
    if (costCents !== null) {
      const costCheck = euroSchema.safeParse(costCents / 100);
      if (!costCheck.success) {
        setError(costCheck.error.issues[0]?.message ?? 'Ongeldige kosten');
        return;
      }
    }
    setBusy(true);
    try {
      // Als de km hoger is dan bekend, updaten we de scooter ook (triggert server-side reminders).
      if (kmParsed.data > active.current_km) {
        await scootersService.updateKilometers(active.id, kmParsed.data);
      }
      // Eigen omschrijving gaat vóór het (voor-geselecteerde) onderdeel.
      const custom = customName.trim();
      await registerMaintenance({
        scooterId: active.id,
        itemId: custom ? null : (selectedItem?.id ?? null),
        customName: custom || null,
        kmAtService: kmParsed.data,
        costCents,
        parts: parts.trim() || null,
        notes: notes.trim() || null,
      });
      await reload();
      if (Platform.OS === 'web') {
        // Alert is een no-op op web — direct terug, anders blijft het formulier open.
        navigation.goBack();
      } else {
        Alert.alert('Opgeslagen', 'Onderhoud geregistreerd.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionTitle>Factuur scannen (optioneel)</SectionTitle>
        <Card>
          <Text style={styles.scanHint}>
            Foto van de factuur of werkplaatsbon — de app leest onderhoud, kosten en km automatisch uit.
          </Text>
          {scannedPreview ? (
            <Image source={{ uri: scannedPreview }} style={styles.scanPreview} resizeMode="cover" />
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Camera"
                onPress={() => void handleScan('camera')}
                loading={scanBusy}
                variant="secondary"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Kies foto"
                onPress={() => void handleScan('library')}
                loading={scanBusy}
                variant="secondary"
              />
            </View>
          </View>
          {scanInfo ? <Text style={styles.scanOk}>{scanInfo}</Text> : null}
          {scanError ? <ErrorText>{scanError}</ErrorText> : null}
        </Card>

        <SectionTitle>Wat heb je gedaan?</SectionTitle>
        <Card>
          <ChipRow>
            {items.map((i) => (
              <Chip key={i.id} label={i.name} active={selectedId === i.id} onPress={() => setSelectedId(i.id)} />
            ))}
          </ChipRow>
          <Input
            label="Of eigen omschrijving"
            value={customName}
            onChangeText={setCustomName}
            placeholder="bijv. rollen vervangen"
          />

          <Input
            label={`Kilometerstand (nu ${activeScooter.current_km.toLocaleString('nl-NL')})`}
            value={km}
            onChangeText={setKm}
            keyboardType="number-pad"
          />
          <Input label="Datum (jjjj-mm-dd)" value={date} onChangeText={setDate} placeholder={new Date().toISOString().slice(0, 10)} />
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Kosten (optioneel)"
                value={cost}
                onChangeText={setCost}
                keyboardType="decimal-pad"
                placeholder="bijv. 12,50"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Onderdelen (optioneel)"
                value={parts}
                onChangeText={setParts}
                placeholder="bijv. NGK BR9ES"
              />
            </View>
          </View>
          <Input label="Notitie (optioneel)" value={notes} onChangeText={setNotes} multiline placeholder="bijv. olie 10W40, nieuwe filter" />

          {selectedItem && selectedItem.interval_km_max ? (
            <Text style={styles.hint}>
              Excel-interval voor {selectedItem.name}: {selectedItem.interval_km_min}–{selectedItem.interval_km_max} km
              {selectedItem.interval_months_max ? ` · ${selectedItem.interval_months_max} mnd` : ''}
            </Text>
          ) : null}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="Opslaan" onPress={handleSave} loading={busy} style={{ marginTop: spacing.s }} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  hint: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.s },
  scanHint: { color: colors.textSubtle, fontSize: 12.5, marginBottom: spacing.s },
  scanPreview: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: spacing.s,
    backgroundColor: colors.textMuted + '22',
  },
  scanOk: { color: colors.primary, fontSize: 12.5, marginTop: spacing.s },
});
