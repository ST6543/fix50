/** Profiel — account (met profielfoto), snelkoppelingen, uitloggen. */
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, SectionTitle } from '@/components/ui';
import { BellIcon, CameraIcon, ChevronRightIcon, GearIcon, LockIcon, MotoIcon, UserIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useScooters } from '@/hooks/useScooters';
import * as scootersService from '@/services/scooters';
import { monthYearLabel } from '@/lib/format';
import { colors, fonts, radii, spacing, typography } from '@/theme';
import type { Profile } from '@/types';

type Nav = AppNav;

/** "Lid sinds maart 2025" op basis van het echte aanmaakmoment van het profiel. */
function memberSince(profile: Profile | null): string | null {
  if (!profile?.created_at) return null;
  const d = new Date(profile.created_at);
  if (Number.isNaN(d.getTime())) return null;
  return `Lid sinds ${monthYearLabel(d)}`;
}

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
        {/* Persoonlijke kaart: foto, naam en de feiten die de app écht kent. */}
        <Card style={styles.profileCard}>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="Profielfoto wijzigen"
            onPress={pickAvatarSource}
            disabled={photoBusy}
            style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.85 }]}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={styles.avatar}>
                <UserIcon size={34} color={colors.primary} />
              </View>
            )}
            <View style={styles.avatarCam}>
              <CameraIcon size={13} color={colors.onPrimary} />
            </View>
          </Pressable>
          <Text style={styles.name}>{profile?.display_name ?? 'Scooterrijder'}</Text>
          <Text style={styles.email}>{session?.user?.email ?? ''}</Text>
          <View style={styles.profileMeta}>
            {activeScooter ? (
              <Badge label={activeScooter.name} tone="info" dot />
            ) : (
              <Badge label="Nog geen scooter" tone="neutral" />
            )}
            {memberSince(profile) ? <Badge label={memberSince(profile) as string} tone="neutral" /> : null}
          </View>
        </Card>

        <SectionTitle>Instellingen</SectionTitle>
        <Card style={styles.linksCard}>
          {links.map((link, i) => (
            <Pressable
              key={link.label}
              accessibilityRole="button"
              onPress={() => navigation.navigate(link.route as never)}
              style={({ pressed }) => [styles.linkRow, i > 0 && styles.linkDivider, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.linkIcon}>{link.icon({ size: 18, color: colors.textMuted })}</View>
              <View style={styles.linkText}>
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.linkSub}>{link.sub}</Text>
              </View>
              <ChevronRightIcon size={17} color={colors.textSubtle} />
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
  content: {
    padding: spacing.l,
    paddingBottom: spacing.xxl,
    gap: spacing.s,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  profileCard: { alignItems: 'center', paddingVertical: spacing.xl },
  avatarWrap: { alignSelf: 'center', marginBottom: spacing.m },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
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
    width: 84,
    height: 84,
    borderRadius: radii.xl,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontWeight: '700',
    fontSize: 21,
    letterSpacing: -0.4,
  },
  email: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, marginTop: 3 },
  profileMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.s,
    marginTop: spacing.m,
  },
  linksCard: { paddingVertical: spacing.xs, paddingHorizontal: 0, overflow: 'hidden' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
  },
  linkDivider: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.s + 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { flex: 1 },
  linkLabel: { ...typography.subheading, fontSize: 14.5 },
  linkSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
