/** Tankbeurt-log — verbruik bijhouden als "1 op X" (km per liter) met trend en totaalkosten. */
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Badge, Button, Card, EmptyState, ErrorText, IconTile, Input } from '@/components/ui';
import { CameraIcon, DropletIcon, ImageIcon, PlusIcon, SendIcon } from '@/components/icons';
import * as ImagePicker from 'expo-image-picker';
import { shrinkForScan } from '@/lib/image-shrink';
import {
  isPlausibleOdometerScan,
  scanOdometer,
} from '@/services/odometer-scan';
import { TrendChart } from '@/components/charts';
import { shareFuelLog } from '@/lib/export';
import { useScooters } from '@/hooks/useScooters';
import { addFuelLog, computeFuelStats, deleteFuelLog, formatCents, formatKmPerLiter, formatLPer100km, listFuelLogs } from '@/services/fuel';
import { fuelLogSchema, eurosToCents, euroSchema } from '@/lib/validation';
import { formatDate } from '@/lib/format';
import { colors, fonts, spacing, typography } from '@/theme';
import type { FuelLog } from '@/types';

export default function FuelScreen() {
  const { activeScooter } = useScooters();
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');
  const [station, setStation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Teller-scan (fase D): foto van de km-stand → prefill ──────────────
  const [kmScanBusy, setKmScanBusy] = useState(false);
  const [kmScanNote, setKmScanNote] = useState<string | null>(null);

  async function handleOdometerScan(source: 'camera' | 'library') {
    setKmScanNote(null);
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setKmScanNote("Geen toestemming voor camera/foto's — zet dit aan in de instellingen.");
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true, exif: false });
    if (result.canceled || !result.assets[0]?.base64) return;

    setKmScanBusy(true);
    try {
      const shrunk = await shrinkForScan(result.assets[0]);
      const out = await scanOdometer({
        base64: shrunk.base64,
        mime: shrunk.mime,
        scooterId: scooter.id,
        currentKm: scooter.current_km,
      });
      if (!out.found || out.km === null) {
        setKmScanNote(out.warning ?? 'Geen leesbare kilometerstand gevonden op deze foto.');
        return;
      }
      setOdometer(String(out.km));
      // Guardrail uit het plan: de gebruiker houdt de regie — bij twijfel
      // alleen noteren, nooit stil wegschrijven of blokkeren.
      if (out.warning) setKmScanNote(out.warning);
      else if (!isPlausibleOdometerScan(out.km, scooter.current_km)) {
        setKmScanNote(
          `${out.km} km leest lager dan je laatst bekende stand — controleer of de foto recent is.`,
        );
      } else if (out.confidence === 'laag') {
        setKmScanNote(`Afgelezen: ${out.km} km (lage zekerheid — check de cijfers).`);
      } else {
        setKmScanNote(`Afgelezen: ${out.km} km — check of het klopt.`);
      }
    } catch (err) {
      setKmScanNote(err instanceof Error ? err.message : 'Teller scannen mislukt. Probeer het opnieuw.');
    } finally {
      setKmScanBusy(false);
    }
  }

  const reload = useCallback(() => {
    if (!activeScooter) {
      setLoading(false);
      return;
    }
    listFuelLogs(activeScooter.id)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [activeScooter]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) return null;

  if (!activeScooter) {
    return (
      <EmptyState
        icon={DropletIcon}
        title="Geen scooter gekozen"
        subtitle="Kies eerst een scooter om tankbeurten bij te houden."
      />
    );
  }

  const stats = computeFuelStats(logs);
  const latest = stats.points[stats.points.length - 1] ?? null;
  const scooter = activeScooter;
  // Trendlijn: 1-op-X per beurt, chronologisch (labels = dd-mm).
  const trendData = stats.points.map((p) => ({
    label: p.filledAtIso.slice(8, 10) + '-' + p.filledAtIso.slice(5, 7),
    value: p.kmPerLiter,
  }));

  async function handleSave() {
    setError(null);
    const parsed = fuelLogSchema.safeParse({
      odometer_km: Number(odometer),
      liters: Number(liters.replace(',', '.')),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Ongeldige invoer');
      return;
    }
    const priceCents = eurosToCents(price);
    if (price.trim() && priceCents !== null) {
      const check = euroSchema.safeParse(priceCents / 100);
      if (!check.success) {
        setError(check.error.issues[0]?.message ?? 'Ongeldige literprijs');
        return;
      }
    }
    setBusy(true);
    try {
      await addFuelLog({
        scooterId: scooter.id,
        odometerKm: parsed.data.odometer_km,
        liters: parsed.data.liters,
        pricePerLiterCents: priceCents,
      });
      setOdometer('');
      setLiters('');
      setPrice('');
      setStation('');
      setFormOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (!activeScooter) return;
    setSharing(true);
    try {
      await shareFuelLog(logs, activeScooter.name);
    } catch {
      Alert.alert('Delen mislukt', 'Kon het tanklogboek niet delen. Probeer het opnieuw.');
    } finally {
      setSharing(false);
    }
  }

  async function handleDelete(log: FuelLog) {
    Alert.alert('Tankbeurt verwijderen', 'Deze beurt uit je log halen?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: async () => {
          await deleteFuelLog(log.id).catch(() => undefined);
          reload();
        },
      },
    ]);
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          {/* Statistiek */}
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.eyebrow}>GEMIDDELD VERBRUIK</Text>
                <Text style={styles.statValue}>
                  {stats.avgKmPerLiter !== null ? formatKmPerLiter(stats.avgKmPerLiter) : '—'}
                </Text>
                <Text style={styles.statSub}>
                  {latest !== null
                    ? `laatste: ${formatKmPerLiter(latest.kmPerLiter)}${stats.avgKmPerLiter !== null ? ` · ${formatLPer100km(stats.avgKmPerLiter)}` : ''}`
                    : 'vul 2 beurten in voor verbruik'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={typography.eyebrow}>GETANKT</Text>
                <Text style={styles.statValue}>{stats.totalLiters.toFixed(1).replace('.', ',')} L</Text>
                {stats.totalCents > 0 ? (
                  <Text style={styles.statSub}>{formatCents(stats.totalCents)} totaal</Text>
                ) : null}
              </View>
            </View>
            {!formOpen ? (
              <View style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.xs }}>
                <Button
                  label="Tankbeurt registreren"
                  icon={<PlusIcon size={16} color={colors.onPrimary} />}
                  onPress={() => setFormOpen(true)}
                  style={{ flex: 1 }}
                />
                {logs.length > 0 ? (
                  <Button
                    label="Delen"
                    variant="secondary"
                    icon={<SendIcon size={16} color={colors.text} />}
                    onPress={handleShare}
                    loading={sharing}
                    style={{ flex: 1 }}
                  />
                ) : null}
              </View>
            ) : null}
            {/* Verbruikstrend per beurt (1-op-X) */}
            {trendData.length >= 2 ? (
              <View style={styles.trendWrap}>
                <Text style={typography.eyebrow}>VERBRUIKSTREND (1 OP X)</Text>
                <TrendChart data={trendData} height={110} />
              </View>
            ) : null}
          </Card>

          {/* Invoerformulier */}
          {formOpen ? (
            <Card style={styles.formCard}>
              {/* Teller-scan: foto van de kilometerstand vult het km-veld (fase D). */}
              <Button
                label="Foto van km-stand"
                icon={<CameraIcon size={16} color={colors.onPrimary} />}
                onPress={() => handleOdometerScan('camera')}
                loading={kmScanBusy}
                style={styles.scanBtn}
              />
              {kmScanBusy ? (
                <Text style={styles.scanNote}>Teller wordt uitgelezen…</Text>
              ) : kmScanNote ? (
                <Text style={styles.scanNote}>{kmScanNote}</Text>
              ) : (
                <Text style={styles.scanHint}>
                  Of kies een foto van je teller — we lezen de stand automatisch in.
                </Text>
              )}
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Kilometerstand"
                    value={odometer}
                    onChangeText={setOdometer}
                    keyboardType="number-pad"
                    placeholder={String(activeScooter.current_km)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Liters getankt"
                    value={liters}
                    onChangeText={setLiters}
                    keyboardType="decimal-pad"
                    placeholder="bijv. 5,2"
                  />
                </View>
              </View>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Prijs per liter (optioneel)"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="bijv. 2,19"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Benzinestation (optioneel)"
                    value={station}
                    onChangeText={setStation}
                    placeholder="bijv. Tinq"
                  />
                </View>
              </View>
              {error ? <ErrorText>{error}</ErrorText> : null}
              <View style={styles.formActions}>
                <Button label="Opslaan" onPress={handleSave} loading={busy} style={{ flex: 1 }} />
                <Button
                  label="Annuleren"
                  variant="ghost"
                  onPress={() => {
                    setFormOpen(false);
                    setError(null);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ) : null}

          {logs.length > 0 ? <Text style={styles.listHeader}>JOUW TANKBEURTEN</Text> : null}
        </View>
      }
      ListEmptyComponent={
        formOpen ? null : (
          <EmptyState
            icon={DropletIcon}
            title="Nog geen tankbeurten"
            subtitle="Registreer elke beurt en zie je verbruik als 1 op X (km per liter)."
          />
        )
      }
      renderItem={({ item }) => {
        const point = stats.points.find((p) => p.odometerKm === item.odometer_km);
        const isFirstFill =
          logs.length > 0 && item.odometer_km === Math.min(...logs.map((l) => l.odometer_km));
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tankbeurt van ${formatDate(item.filled_at)} verwijderen`}
            onLongPress={() => handleDelete(item)}
            delayLongPress={400}
          >
            <Card style={styles.row}>
              <IconTile tone="primary" size={36} radius={10}>
                <DropletIcon size={17} color={colors.primary} />
              </IconTile>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {item.liters.toFixed(1).replace('.', ',')} L · {item.odometer_km.toLocaleString('nl-NL')} km
                </Text>
                <Text style={styles.rowSub}>
                  {formatDate(item.filled_at)}
                  {item.station ? ` · ${item.station}` : ''}
                </Text>
              </View>
              {point ? (
                <Badge
                  label={formatKmPerLiter(point.kmPerLiter)}
                  tone={
                    stats.avgKmPerLiter !== null && point.kmPerLiter < stats.avgKmPerLiter * 0.85
                      ? 'warning'
                      : 'success'
                  }
                />
              ) : isFirstFill ? (
                <Badge label="eerste beurt" />
              ) : (
                <Badge label="telt niet mee" />
              )}
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.l, paddingBottom: spacing.xxl },
  statsCard: { gap: spacing.m },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statValue: { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3, marginTop: 2 },
  statSub: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  addBtn: { marginTop: spacing.xs },
  trendWrap: { gap: spacing.s, marginTop: spacing.m, paddingTop: spacing.m, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  formCard: { marginBottom: spacing.m },
  formRow: { flexDirection: 'row', gap: spacing.s },
  formActions: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.xs },
  scanBtn: { marginTop: spacing.xs },
  scanNote: { color: colors.textSubtle, fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
  scanHint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11.5, marginTop: 4 },
  listHeader: { ...typography.eyebrow, marginBottom: spacing.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, marginBottom: spacing.m },
  rowTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 14.5, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
