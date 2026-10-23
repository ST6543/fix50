/** Scooter toevoegen/bewerken — incl. foto, setup-velden. */
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import type { AppNav } from '@/navigation/types';

import { Button, Card, Chip, ChipRow, ErrorText, Input, SectionTitle } from '@/components/ui';
import { CameraIcon, ImageIcon, MotoIcon, TrashIcon } from '@/components/icons';
import { useScooters } from '@/hooks/useScooters';
import * as scootersService from '@/services/scooters';
import { ENGINE_FAMILIES, FUEL_SYSTEMS, type EngineFamily } from '@/constants/branding';
import { scooterSchema } from '@/lib/validation';
import { dailyFromWeekly, weeklyFromDaily } from '@/lib/km-estimate';
import { colors, fonts, spacing } from '@/theme';

type RouteParams = { EditScooter: { scooterId?: string } };
type Nav = AppNav;

export default function EditScooterScreen() {
  const route = useRoute<RouteProp<RouteParams, 'EditScooter'>>();
  const navigation = useNavigation<Nav>();
  const { scooters, reload } = useScooters();
  const editing = route.params?.scooterId ? scooters.find((s) => s.id === route.params!.scooterId) ?? null : null;

  const [name, setName] = useState(editing?.name ?? '');
  const [brand, setBrand] = useState(editing?.brand ?? '');
  const [model, setModel] = useState(editing?.model ?? '');
  const [year, setYear] = useState(editing?.year ? String(editing.year) : '');
  const [engine, setEngine] = useState<EngineFamily | null>(editing?.engine_type ?? null);
  const [fuel, setFuel] = useState<'2T' | '4T' | 'Injectie' | null>(editing?.fuel_system ?? null);
  const [km, setKm] = useState(String(editing?.current_km ?? ''));
  const [weeklyKm, setWeeklyKm] = useState(
    editing?.avg_km_per_week != null ? String(editing.avg_km_per_week) : '',
  );
  const [dailyKm, setDailyKm] = useState(
    editing?.avg_km_per_week != null ? String(dailyFromWeekly(editing.avg_km_per_week)) : '',
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');

  // setup-velden
  const [bloktype, setBloktype] = useState('');
  const [cilinder, setCilinder] = useState('');
  const [carburateur, setCarburateur] = useState('');
  const [carbMaat, setCarbMaat] = useState('');
  const [hoofdsproeier, setHoofdsproeier] = useState('');
  const [stationair, setStationair] = useState('');
  const [naald, setNaald] = useState('');
  const [luchtfilter, setLuchtfilter] = useState('');
  const [uitlaat, setUitlaat] = useState('');
  const [variateur, setVariateur] = useState('');
  const [rollen, setRollen] = useState('');
  const [drukveer, setDrukveer] = useState('');
  const [trekveren, setTrekveren] = useState('');
  const [koppeling, setKoppeling] = useState('');
  const [bougie, setBougie] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  /** Foto kiezen/maken en direct uploaden → scooter + profiel + PDF-dossiers. */
  async function pickPhoto(source: 'camera' | 'library') {
    if (!editing) {
      Alert.alert('Eerst opslaan', 'Sla de scooter eerst op, daarna kun je een foto toevoegen.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset?.base64) return;
    setPhotoBusy(true);
    try {
      await scootersService.uploadScooterPhoto(editing.id, {
        base64: asset.base64,
        mime: asset.mimeType ?? 'image/jpeg',
      });
      await reload();
      Alert.alert('Foto opgeslagen', 'Hij staat nu op je profiel én in je onderhoudsboekje en tuningrapport.');
    } catch (err) {
      Alert.alert('Uploaden mislukt', err instanceof Error ? err.message : 'Onbekende fout.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    if (!editing?.image_url) return;
    Alert.alert('Foto verwijderen?', 'De foto verdwijnt van je profiel en uit je dossiers.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: () => {
          if (!editing) return;
          setPhotoBusy(true);
          scootersService
            .clearScooterPhoto(editing.id)
            .then(reload)
            .catch((err: unknown) => Alert.alert('Verwijderen mislukt', err instanceof Error ? err.message : 'Onbekende fout.'))
            .finally(() => setPhotoBusy(false));
        },
      },
    ]);
  }

  useEffect(() => {
    if (editing) {
      scootersService.getSetup(editing.id).then((s) => {
        if (!s) return;
        setBloktype(s.bloktype ?? '');
        setCilinder(s.cilinder ?? '');
        setCarburateur(s.carburateur ?? '');
        setCarbMaat(s.carburateurmaat_mm ? String(s.carburateurmaat_mm) : '');
        setHoofdsproeier(s.hoofdsproeier ? String(s.hoofdsproeier) : '');
        setStationair(s.stationairsproeier ? String(s.stationairsproeier) : '');
        setNaald(s.naaldpositie ?? '');
        setLuchtfilter(s.luchtfilter ?? '');
        setUitlaat(s.uitlaat ?? '');
        setVariateur(s.variateur ?? '');
        setRollen(s.rollen ?? '');
        setDrukveer(s.drukveer ?? '');
        setTrekveren(s.trekveren ?? '');
        setKoppeling(s.koppeling ?? '');
        setBougie(s.bougie ?? '');
      }).catch(() => undefined);
    }
  }, [editing]);

  /** Invoer parsen met komma-ondersteuning; null bij leeg/ongeldig. */
  const parseKm = (v: string): number | null => {
    const t = v.trim().replace(',', '.');
    if (!t || Number.isNaN(Number(t))) return null;
    return Number(t);
  };

  /** Typ je per dag? Dan rekenen we per week bij (en andersom). */
  function handleDailyKm(v: string) {
    setDailyKm(v);
    const n = parseKm(v);
    setWeeklyKm(n != null ? String(weeklyFromDaily(n)) : '');
  }
  function handleWeeklyKm(v: string) {
    setWeeklyKm(v);
    const n = parseKm(v);
    setDailyKm(n != null ? String(dailyFromWeekly(n)) : '');
  }

  async function handleSave() {
    setError(null);
    const parsed = scooterSchema.safeParse({
      name: name.trim(),
      brand: brand.trim() || null,
      model: model.trim() || null,
      year: year ? Number(year) : null,
      engine_type: engine,
      fuel_system: fuel,
      current_km: km ? Number(km) : 0,
      avg_km_per_week:
        weeklyKm.trim() && !Number.isNaN(Number(weeklyKm.replace(',', '.')))
          ? Number(weeklyKm.replace(',', '.'))
          : null,
      notes: notes.trim() || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Ongeldige invoer');
      return;
    }
    setBusy(true);
    try {
      let scooterId = editing?.id ?? null;
      if (editing) {
        await scootersService.updateScooter(editing.id, parsed.data);
      } else {
        const created = await scootersService.createScooter(parsed.data);
        scooterId = created.id;
      }
      if (scooterId) {
        const num = (v: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
        await scootersService.saveSetup(scooterId, {
          bloktype: bloktype.trim() || null,
          cilinder: cilinder.trim() || null,
          carburateur: carburateur.trim() || null,
          carburateurmaat_mm: num(carbMaat),
          hoofdsproeier: num(hoofdsproeier),
          stationairsproeier: num(stationair),
          naaldpositie: naald.trim() || null,
          luchtfilter: luchtfilter.trim() || null,
          uitlaat: uitlaat.trim() || null,
          variateur: variateur.trim() || null,
          rollen: rollen.trim() || null,
          drukveer: drukveer.trim() || null,
          trekveren: trekveren.trim() || null,
          koppeling: koppeling.trim() || null,
          bougie: bougie.trim() || null,
        });
        if (!editing) {
          const { ensureSchedulesForScooter } = await import('@/services/maintenance');
          await ensureSchedulesForScooter({ id: scooterId, fuel_system: fuel });
        }
      }
      await reload();
      Alert.alert('Opgeslagen', 'Scooter bewaard.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionTitle>Scooterfoto</SectionTitle>
        <Card>
          <View style={styles.photoRow}>
            {editing?.image_url ? (
              <Image source={{ uri: editing.image_url }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <MotoIcon size={28} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.photoActions}>
              <View style={{ flexDirection: 'row', gap: spacing.s }}>
                <View style={{ flex: 1 }}>
                  <Button label="Camera" variant="secondary" icon={<CameraIcon size={16} color={colors.text} />} onPress={() => void pickPhoto('camera')} loading={photoBusy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Kies foto" variant="secondary" icon={<ImageIcon size={16} color={colors.text} />} onPress={() => void pickPhoto('library')} loading={photoBusy} />
                </View>
              </View>
              {editing?.image_url ? (
                <Button label="Foto verwijderen" variant="ghost" icon={<TrashIcon size={15} color={colors.danger} />} onPress={removePhoto} disabled={photoBusy} style={{ marginTop: spacing.s }} />
              ) : null}
              <Text style={styles.photoHint}>
                Wordt je profielfoto en staat op je onderhoudsboekje & tuningrapport.
              </Text>
            </View>
          </View>
        </Card>

        <SectionTitle>Basisgegevens</SectionTitle>
        <Card>
          <Input label="Naam" value={name} onChangeText={setName} placeholder="Bijv. Mijn Aerox" />
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input label="Merk" value={brand} onChangeText={setBrand} placeholder="Yamaha" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Model" value={model} onChangeText={setModel} placeholder="Aerox" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input label="Bouwjaar" value={year} onChangeText={setYear} keyboardType="number-pad" placeholder="2015" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Kilometerstand" value={km} onChangeText={setKm} keyboardType="number-pad" placeholder="12450" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Km per dag"
                value={dailyKm}
                onChangeText={handleDailyKm}
                keyboardType="decimal-pad"
                placeholder="bijv. 15"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Km per week"
                value={weeklyKm}
                onChangeText={handleWeeklyKm}
                keyboardType="decimal-pad"
                placeholder="bijv. 100"
              />
            </View>
          </View>
          <Text style={styles.fieldHint}>
            Vul één van de twee in — de andere rekenen we automatisch om. Zo blijft je kilometerstand op Home actueel en voorspellen we je onderhoud.
          </Text>

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

          <Input label="Notities" value={notes} onChangeText={setNotes} multiline placeholder="bijv. vorige eigenaar heeft zuiger vervangen" />
        </Card>

        <SectionTitle>Setup (optioneel, kan later)</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input label="Cilinder" value={cilinder} onChangeText={setCilinder} placeholder="70cc DMP" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Uitlaat" value={uitlaat} onChangeText={setUitlaat} placeholder="Yasuni Z" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input label="Carburateur" value={carburateur} onChangeText={setCarburateur} placeholder="PHBN" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Maat (mm)" value={carbMaat} onChangeText={setCarbMaat} keyboardType="decimal-pad" placeholder="16" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input label="Hoofdsproeier" value={hoofdsproeier} onChangeText={setHoofdsproeier} keyboardType="number-pad" placeholder="92" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Stationair" value={stationair} onChangeText={setStationair} keyboardType="number-pad" placeholder="42" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s }}>
            <View style={{ flex: 1 }}>
              <Input label="Naaldpositie" value={naald} onChangeText={setNaald} placeholder="2e groef" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Rollen" value={rollen} onChangeText={setRollen} placeholder="6.5g" />
            </View>
          </View>
          <Input label="Luchtfilter" value={luchtfilter} onChangeText={setLuchtfilter} placeholder="Origineel / powerfilter" />
          <Input label="Variateur" value={variateur} onChangeText={setVariateur} placeholder="Origineel / Malossi" />
          <Input label="Drukveer" value={drukveer} onChangeText={setDrukveer} placeholder="bijv. standaard" />
          <Input label="Trekveren" value={trekveren} onChangeText={setTrekveren} placeholder="bijv. 1000 rpm" />
          <Input label="Koppeling" value={koppeling} onChangeText={setKoppeling} placeholder="bijv. origineel" />
          <Input label="Bougie" value={bougie} onChangeText={setBougie} placeholder="bijv. NGK BR9ES" />
        </Card>

        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button label={editing ? 'Wijzigingen opslaan' : 'Scooter toevoegen'} onPress={handleSave} loading={busy} style={{ marginTop: spacing.m }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  photoRow: { flexDirection: 'row', gap: spacing.m, alignItems: 'center' },
  photo: { width: 104, height: 78, borderRadius: 10, backgroundColor: colors.surfaceAlt },
  photoPlaceholder: { borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  photoActions: { flex: 1 },
  photoHint: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 15, marginTop: spacing.s },
  fieldLabel: { color: colors.textMuted, fontSize: 13, marginTop: spacing.m, marginBottom: spacing.xs },
  fieldHint: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, marginTop: spacing.xs, marginBottom: spacing.m },
});
