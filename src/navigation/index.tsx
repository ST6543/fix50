/** Navigatie: auth-stack voor ingelogde gebruikers, daarna 3 icon-only tabs. */
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors, fonts } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  ChatIcon,
  HomeIcon,
  SlidersIcon,
  type IconProps,
} from '@/components/icons';

import LoginScreen from '@/features/auth/LoginScreen';
import type { RootStackParamList } from './types';
import RegisterScreen from '@/features/auth/RegisterScreen';
import ForgotPasswordScreen from '@/features/auth/ForgotPasswordScreen';
import OnboardingScreen from '@/features/auth/OnboardingScreen';

import HomeScreen from '@/features/home/HomeScreen';
import WorkshopScreen from '@/features/workshop/WorkshopScreen';
import GarageScreen from '@/features/garage/GarageScreen';
import ScootersScreen from '@/features/scooters/ScootersScreen';
import ChatHistoryScreen from '@/features/diagnosis/ChatHistoryScreen';
import ChatDetailScreen from '@/features/diagnosis/ChatDetailScreen';
import MaintenanceDetailScreen from '@/features/maintenance/MaintenanceDetailScreen';
import MaintenanceHistoryScreen from '@/features/maintenance/MaintenanceHistoryScreen';
import AddMaintenanceScreen from '@/features/maintenance/AddMaintenanceScreen';
import SetupDetailScreen from '@/features/tuning/SetupDetailScreen';
import AfstelScreen from '@/features/tuning/AfstelScreen';
import TuningHistoryScreen from '@/features/tuning/TuningHistoryScreen';
import SetupComparisonScreen from '@/features/tuning/SetupComparisonScreen';
import PerformanceScreen from '@/features/performance/PerformanceScreen';
import PerformanceRunScreen from '@/features/performance/PerformanceRunScreen';
import PerformanceResultScreen from '@/features/performance/PerformanceResultScreen';
import PerformanceHistoryScreen from '@/features/performance/PerformanceHistoryScreen';
import ScooterDetailScreen from '@/features/scooters/ScooterDetailScreen';
import EditScooterScreen from '@/features/scooters/EditScooterScreen';
import ProfileScreen from '@/features/profile/ProfileScreen';
import SettingsScreen from '@/features/profile/SettingsScreen';
import NotificationsScreen from '@/features/profile/NotificationsScreen';
import PrivacyScreen from '@/features/profile/PrivacyScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.primary,
  },
};

const TAB_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  Home: HomeIcon,
  Werkplaats: ChatIcon,
  Garage: SlidersIcon,
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,
          height: 58,
          paddingBottom: 7,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabel: () => null,
        tabBarShowLabel: false,
        tabBarIcon: ({ focused }) => {
          const Icon = TAB_ICONS[route.name];
          if (!Icon) return null;
          return <Icon size={23} color={focused ? colors.primary : colors.textSubtle} strokeWidth={focused ? 2.1 : 1.8} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Werkplaats" component={WorkshopScreen} />
      <Tab.Screen name="Garage" component={GarageScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading, profile } = useAuth();

  if (loading) return null;

  const needsOnboarding = Boolean(session && profile && !profile.onboarded_at);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {!session ? (
          <>
            <Stack.Screen name="Auth" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Account aanmaken' }} />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: 'Wachtwoord vergeten' }}
            />
          </>
        ) : needsOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Account" component={ProfileScreen} options={{ title: 'Account' }} />
            <Stack.Screen name="Scooters" component={ScootersScreen} options={{ title: 'Mijn scooters' }} />
            <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ title: 'Diagnose-assistent' }} />
            <Stack.Screen name="ChatHistory" component={ChatHistoryScreen} options={{ title: 'Gesprekken' }} />
            <Stack.Screen name="MaintenanceDetail" component={MaintenanceDetailScreen} options={{ title: 'Onderhoudstaak' }} />
            <Stack.Screen name="MaintenanceHistory" component={MaintenanceHistoryScreen} options={{ title: 'Onderhoudsgeschiedenis' }} />
            <Stack.Screen name="AddMaintenance" component={AddMaintenanceScreen} options={{ title: 'Onderhoud registreren' }} />
            <Stack.Screen name="SetupDetail" component={SetupDetailScreen} options={{ title: 'Setup' }} />
            <Stack.Screen name="Afstel" component={AfstelScreen} options={{ title: 'Afstelhulp' }} />
            <Stack.Screen name="TuningHistory" component={TuningHistoryScreen} options={{ title: 'Tuninggeschiedenis' }} />
            <Stack.Screen name="SetupComparison" component={SetupComparisonScreen} options={{ title: 'Setups vergelijken' }} />
            <Stack.Screen name="PerformanceRun" component={PerformanceRunScreen} options={{ title: 'GPS-test' }} />
            <Stack.Screen name="PerformanceResult" component={PerformanceResultScreen} options={{ title: 'Resultaat' }} />
            <Stack.Screen name="PerformanceHistory" component={PerformanceHistoryScreen} options={{ title: 'Metingsgeschiedenis' }} />
            <Stack.Screen name="ScooterDetail" component={ScooterDetailScreen} options={{ title: 'Scooter' }} />
            <Stack.Screen name="EditScooter" component={EditScooterScreen} options={{ title: 'Scooter' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Instellingen' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Meldingen' }} />
            <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: 'Privacy' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
