/** Scooters-lijst — meerdere voertuigen beheren. */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { AppNav } from '@/navigation/types';

import { Badge, Button, Card, EmptyState, Loading } from '@/components/ui';
import { MotoIcon, PlusIcon } from '@/components/icons';
import { FadeInView } from '@/components/motion';
import { useScooters } from '@/hooks/useScooters';
import { formatKm } from '@/lib/format';
import { colors, spacing } from '@/theme';

type Nav = AppNav;

export default function ScootersScreen() {
  const navigation = useNavigation<Nav>();
  const { scooters, activeScooter, setActiveScooterId, loading, reload } = useScooters();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (loading && scooters.length === 0) return <Loading label="Scooters laden…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {scooters.length === 0 ? (
          <EmptyState
            icon={MotoIcon}
            title="Je hebt nog geen scooter toegevoegd"
            subtitle="Voeg je brommer toe om onderhoud, diagnose en tuning te koppelen aan het juiste blok."
            actionLabel="Brommer toevoegen"
            onAction={() => navigation.navigate('EditScooter', {})}
          />
        ) : (
          scooters.map((s, si) => (
            <FadeInView key={s.id} index={si}>
            <Card
              style={[styles.card, activeScooter?.id === s.id && { borderColor: colors.primary }]}
              onPress={() => navigation.navigate('ScooterDetail', { scooterId: s.id })}
            >
              <View style={styles.row}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.name}>{s.name}</Text>
                  <Text style={styles.meta}>
                    {[s.brand, s.model].filter(Boolean).join(' ') || 'Onbekend merk'}
                    {s.engine_type ? ` · ${s.engine_type}` : ''}
                    {s.fuel_system ? ` · ${s.fuel_system}` : ''}
                  </Text>
                  <Text style={styles.km}>{formatKm(s.current_km)}</Text>
                </View>
                {activeScooter?.id === s.id ? <Badge label="Geselecteerd" tone="success" /> : null}
              </View>
              {activeScooter?.id !== s.id ? (
                <Button
                  label="Selecteren"
                  variant="secondary"
                  onPress={() => setActiveScooterId(s.id)}
                  style={styles.selectBtn}
                />
              ) : null}
            </Card>
            </FadeInView>
          ))
        )}

        <Button
          label="Nieuwe scooter"
          icon={<PlusIcon size={16} color={colors.onPrimary} />}
          onPress={() => navigation.navigate('EditScooter', {})}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  card: { marginBottom: spacing.m },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontWeight: '800', fontSize: 18 },
  meta: { color: colors.textMuted, marginTop: 2 },
  km: { color: colors.primary, fontWeight: '700', marginTop: spacing.xs },
  selectBtn: { marginTop: spacing.m, minHeight: 40 },
});
