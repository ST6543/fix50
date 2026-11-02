/** Centrale navigatietypes — geen circulaire imports tussen schermen en de navigator. */
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Auth: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Onboarding: undefined;
  Main: undefined;
  Account: undefined;
  Scooters: undefined;
  ChatDetail: { sessionId?: string; seedMessage?: string } | undefined;
  ChatHistory: undefined;
  MaintenanceDetail: { scheduleId: string };
  MaintenanceHistory: undefined;
  AddMaintenance: undefined;
  SetupDetail: { setupId?: string } | undefined;
  Afstel: undefined;
  TuningHistory: undefined;
  SetupComparison: undefined;
  PerformanceRun: undefined;
  PerformanceResult: { runId: string };
  PerformanceHistory: undefined;
  ScooterDetail: { scooterId: string };
  EditScooter: { scooterId?: string } | undefined;
  Settings: undefined;
  Notifications: undefined;
  Privacy: undefined;
};

/** 3 icon-only tabs: Home · Werkplaats (diagnose+onderhoud) · Garage (tuning+tankbeurten+GPS-test). */
export type MainTabParamList = {
  Home: undefined;
  Werkplaats: { segment?: 'diagnose' | 'onderhoud' } | undefined;
  Garage: { segment?: 'tuning' | 'gpstest' | 'tankbeurten' } | undefined;
};

/**
 * Stack-navigatie: werkt vanuit tab-screens en stack-schermen
 * (React Navigation lost acties runtime omhoog op naar de root-stack).
 */
export type AppNav = NativeStackNavigationProp<RootStackParamList>;

/** Losse hook voor tab-wissels (bijv. Home → Werkplaats-tab). */
export type TabNav = BottomTabNavigationProp<MainTabParamList>;

/** Volledige screen-props wanneer gewenst. */
export type AppScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
