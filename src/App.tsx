/** FIX50 root — providers + navigatie (+ Space Grotesk & Inter fonts). */
import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

import AppNavigator from '@/navigation';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ScootersProvider } from '@/hooks/useScooters';
import { colors } from '@/theme';
import { Loading } from '@/components/ui';

function Gate() {
  const { loading } = useAuth();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {!fontsLoaded ? <Loading label="FIX50 laden…" /> : loading ? <Loading label="FIX50 laden…" /> : <AppNavigator />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ScootersProvider>
          <Gate />
        </ScootersProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
