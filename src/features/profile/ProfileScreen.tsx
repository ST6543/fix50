/** Profiel — account (met profielfoto), snelkoppelingen, uitloggen. */
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import type { AppNav } from '@/navigation/types';

import { Button, Card, SectionTitle } from '@/components/ui';
import { BellIcon, CameraIcon, ChevronRightIcon, GearIcon, LockIcon, MotoIcon, UserIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useScooters } from '@/hooks/useScooters';
import * as scootersService from '@/services/scooters';
import { colors, fonts, radii, spacing } from '@/theme';

type Nav = AppNav;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { profile, session, signOut, refreshProfile } = useAuth();
  const { activeScooter, reload } = useScooters();
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  /** Profielfoto wijzigen: gekoppelde scooterfoto (ook op de PDF's) of los. */
  async function changeAvatar(source: 'camera' | 'library') {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset?.base64) return;
    setPhotoBusy(true);
    try {
      const payload = { base64: asset.base64, mime: asset.mimeType ?? 'image/jpeg' };
      if (activeScooter) {
        await scootersService.uploadScooterPhoto(activeScooter.id, payload);
        await reload();
      } else {
        await scootersService.uploadProfilePhoto(payload);
      }
      await refreshProfile();
      Alert.alert('Profielfoto gewijzigd', activeScooter ? 'De foto staat ook op je onderhoudsboekje en tuningrapport.' : undefined);
    } catch (err) {
      Alert.alert('Uploaden mislukt', err instanceof Error ? err.message : 'Onbekende fout.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function pickAvatarSource() {
    Alert.alert('Profielfoto', 'Maak een foto of kies één uit je bibliotheek.', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Camera', onPress: () => void changeAvatar('camera') },
      { text: 'Kies foto', onPress: () => void changeAvatar('library') },
    ]);
  }

  function handleLogout() {
    Alert.alert('Uitloggen?', 'Je blijft uitgelogd tot je opnieuw inlogt.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Uitloggen',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await signOut().catch(() => undefined);
          setBusy(false);
        },
      },
    ]);
  }

  const links: { label: string; sub: string; icon: (p: { size?: number; color?: string }) => React.ReactElement; route: string }[] = [
    { label: 'Mijn scooters', sub: 'Voertuigen en kilometerstand', icon: MotoIcon, route: 'Scooters' },
    { label: 'Algemene instellingen', sub: 'App-voorkeuren', icon: GearIcon, route: 'Settings' },
    { label: 'Meldingen', sub: 'Herinneringen en updates', icon: BellIcon, route: 'Notifications' },
    { label: 'Privacy & gegevens', sub: 'Je data beheren', icon: LockIcon, route: 'Privacy' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="Profielfoto wijzigen"
            onPress={pickAvatarSource}
            disabled={photoBusy}
            style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.8 }]}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={styles.avatar}>
                <UserIcon size={26} color={colors.primary} />
              </View>
            )}
            <View style={styles.avatarCam}>
              <CameraIcon size={13} color={colors.onPrimary} />
            </View>
          </Pressable>
          <Text style={styles.name}>{profile?.display_name ?? 'Scooterrijder'}</Text>
          <Text style={styles.email}>{session?.user?.email ?? ''}</Text>
        </Card>

        <SectionTitle>Instellingen</SectionTitle>
        <Card style={{ paddingVertical: spacing.s }}>
          {links.map((link, i) => (
            <Pressable
              key={link.label}
              accessibilityRole="button"
              onPress={() => navigation.navigate(link.route as never)}
              style={({ pressed }) => [styles.linkRow, i > 0 && styles.linkDivider, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.linkIcon}>{link.icon({ size: 20, color: colors.textMuted })}</View>
              <View style={styles.linkText}>
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.linkSub}>{link.sub}</Text>
              </View>
              <ChevronRightIcon size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>

        <Button label="Uitloggen" variant="danger" onPress={handleLogout} loading={busy} style={{ marginTop: spacing.l }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  avatarWrap: { alignSelf: 'center', marginBottom: spacing.m },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: radii.l,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarCam: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.l,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    marginTop: 10,
  },
  name: { color: colors.text, fontFamily: fonts.display, fontWeight: '700', fontSize: 20 },
  email: { color: colors.textMuted, marginTop: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.m },
  linkDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  linkIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.m,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { flex: 1 },
  linkLabel: { color: colors.text, fontWeight: '600', fontSize: 15 },
  linkSub: { color: colors.textMuted, fontSize: 12.5, marginTop: 1 },
});
