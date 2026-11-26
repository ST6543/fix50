/** Navigatie: auth-stack voor ingelogde gebruikers, daarna 3 icon-only tabs. */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors, fonts } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToMaintenanceOpens } from '@/services/notifications';
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
import TuningDashboardScreen from '@/features/tuning/TuningDashboardScreen';
import TuningSimulatorScreen from '@/features/tuning/TuningSimulatorScreen';
import CarbDiagramScreen from '@/features/tuning/CarbDiagramScreen';
import GearingScreen from '@/features/tuning/GearingScreen';
import EngineDatabaseScreen from '@/features/tuning/EngineDatabaseScreen';
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

/** Root-referentie: een tik op een melding navigeert ook buiten een scherm. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Tik die binnenkwam voordat de navigator klaar was (koude start). */
const pendingNotification: { scheduleId: string | null } = { scheduleId: null };

function openNotificationTarget(scheduleId: string) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('MaintenanceDetail', { scheduleId });
  } else {
    pendingNotification.scheduleId = scheduleId;
  }
}

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

/** Korte labels onder de iconen — de tabbladen zijn zonder tekst te raden. */
const TAB_LABELS: Record<string, string> = {
  Home: 'Home',
  Werkplaats: 'Werkplaats',
  Garage: 'Garage',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,
          height: 66,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: {
          fontFamily: fonts.display,
          fontSize: 10.5,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarIcon: ({ focused }) => {
          const Icon = TAB_ICONS[route.name];
          if (!Icon) return null;
          // Actief tabblad krijgt een zachte oranje pil achter het icoon.
          return (
            <View
              style={{
                width: 44,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? colors.primarySubtle : 'transparent',
              }}
            >
              <Icon size={21} color={focused ? colors.primary : colors.textSubtle} strokeWidth={focused ? 2.1 : 1.8} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: TAB_LABELS.Home }} />
      <Tab.Screen name="Werkplaats" component={WorkshopScreen} options={{ tabBarLabel: TAB_LABELS.Werkplaats }} />
      <Tab.Screen name="Garage" component={GarageScreen} options={{ tabBarLabel: TAB_LABELS.Garage }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { session, loading, profile } = useAuth();
  const canRoute = Boolean(session && profile?.onboarded_at);

  // Lokale herinneringen dragen de schedule-id mee; een tik opent die taak.
  useEffect(() => {
    if (!canRoute) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    subscribeToMaintenanceOpens(openNotificationTarget)
      .then((fn) => {
        if (alive) unsubscribe = fn;
        else fn();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [canRoute]);

  if (loading) return null;

  const needsOnboarding = Boolean(session && profile && !profile.onboarded_at);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        const scheduleId = pendingNotification.scheduleId;
        if (scheduleId) {
          pendingNotification.scheduleId = null;
          openNotificationTarget(scheduleId);
        }
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 17, fontWeight: '600' },
          headerShadowVisible: false,
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
            <Stack.Screen name="TuningDashboard" component={TuningDashboardScreen} options={{ title: 'Tuning-dashboard' }} />
            <Stack.Screen name="TuningSimulator" component={TuningSimulatorScreen} options={{ title: 'Simulator' }} />
            <Stack.Screen name="CarbDiagram" component={CarbDiagramScreen} options={{ title: 'Carburateurdiagram' }} />
            <Stack.Screen name="Gearing" component={GearingScreen} options={{ title: 'Vertanding' }} />
            <Stack.Screen name="EngineDatabase" component={EngineDatabaseScreen} options={{ title: 'Motordatabase' }} />
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
