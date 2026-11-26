/**
 * Smoke-tests per hoofdscherm: met gemockte services en context renderen we
 * Home, Werkplaats en Garage (en de schermen eronder) en controleren we of de
 * kerncijfers en acties er nog staan. Zo merkt een redesign meteen dat een
 * scherm leeg of stuk is, zonder echte backend of device.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import HomeScreen from '@/features/home/HomeScreen';
import MaintenanceScreen from '@/features/maintenance/MaintenanceScreen';
import TuningScreen from '@/features/tuning/TuningScreen';
import PerformanceScreen from '@/features/performance/PerformanceScreen';
import WorkshopScreen from '@/features/workshop/WorkshopScreen';
import GarageScreen from '@/features/garage/GarageScreen';
import type {
  MaintenanceItem,
  MaintenanceReminder,
  MaintenanceSchedule,
  PerformanceRun,
  Scooter,
  ScooterSetup,
  TuningSetup,
} from '@/types';

const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };
const mockRouteParams: { segment?: string } = {};

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useNavigation: () => mockNavigation,
    useFocusEffect: (effect: () => void | (() => void)) => ReactModule.useEffect(effect, [effect]),
    useRoute: () => ({ params: mockRouteParams }),
  };
});

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    profile: { display_name: 'Sam' },
    session: { access_token: 'test' },
    loading: false,
  }),
}));

const mockScooter: Scooter = {
  id: 'scooter-1',
  user_id: 'user-1',
  name: 'Aerox',
  brand: 'Yamaha',
  model: 'Aerox',
  year: 2019,
  engine_type: 'AM6',
  engine_code: null,
  fuel_system: '2T',
  license_plate: null,
  current_km: 12000,
  avg_km_per_week: 120,
  notes: null,
  image_url: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-11-20T00:00:00.000Z',
};

const mockScooterSetup: ScooterSetup = {
  id: 'setup-1',
  scooter_id: 'scooter-1',
  bloktype: 'Minarelli',
  cilinder: '50cc',
  cilinderinhoud_cc: 50,
  krukas: null,
  carburateur: 'Dellorto',
  carburateurmaat_mm: 17,
  hoofdsproeier: 92,
  stationairsproeier: 38,
  naaldpositie: null,
  luchtfilter: null,
  spruitstuk: null,
  membraan: null,
  uitlaat: null,
  vertanding: null,
  variateur: null,
  rollen: null,
  drukveer: null,
  trekveren: null,
  koppeling: null,
  bougie: null,
  ontsteking: null,
  brandstof: null,
  olie: null,
  overig: null,
  updated_at: '2026-11-20T00:00:00.000Z',
};

jest.mock('@/hooks/useScooters', () => ({
  useScooters: () => ({
    scooters: [mockScooter],
    activeScooter: mockScooter,
    setup: mockScooterSetup,
    loading: false,
    reload: jest.fn(),
    setActiveScooterId: jest.fn(),
    updateKm: jest.fn(),
  }),
}));

const mockItem: MaintenanceItem = {
  id: 'item-1',
  name: 'Bougie vervangen',
  category: 'ontsteking',
  interval_km_min: 6000,
  interval_km_max: 8000,
  interval_months_min: null,
  interval_months_max: null,
  applies_2t: true,
  applies_4t: true,
  applies_injectie: true,
  description: null,
  active: true,
};

const mockSchedule: MaintenanceSchedule = {
  id: 'schedule-1',
  scooter_id: 'scooter-1',
  item_id: 'item-1',
  interval_km: 6000,
  interval_months: null,
  enabled: true,
  last_done_km: 1000,
  last_done_at: '2025-01-01T00:00:00.000Z',
  next_due_km: 7000,
  next_due_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const mockReminder: MaintenanceReminder = {
  id: 'reminder-1',
  scooter_id: 'scooter-1',
  schedule_id: 'schedule-1',
  severity: 'warning',
  title: 'Bougie is te laat',
  body: 'Vervang de bougie voordat je verder rijdt.',
  due_km: 7000,
  due_at: null,
  status: 'open',
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
};

const mockSetup: TuningSetup = {
  id: 'tuning-1',
  scooter_id: 'scooter-1',
  name: 'Sport',
  parts: { carburateur: 'Dellorto', hoofdsproeier: 92 },
  is_active: true,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const mockRun: PerformanceRun = {
  id: 'run-1',
  scooter_id: 'scooter-1',
  setup_id: null,
  started_at: '2026-11-20T10:00:00.000Z',
  ended_at: '2026-11-20T10:00:10.000Z',
  duration_s: 10,
  distance_m: 200,
  max_speed_kmh: 78,
  avg_speed_kmh: 40,
  t0_50_s: 4.2,
  t0_80_s: 9.8,
  t50_80_s: 5.6,
  gps_quality: 'goed',
  points: [],
  notes: null,
  created_at: '2026-11-20T10:00:00.000Z',
};

const mockRefresh = jest.fn().mockResolvedValue(undefined);

jest.mock('@/hooks/useAppData', () => ({
  useMaintenanceData: () => ({
    items: [mockItem],
    schedules: [mockSchedule],
    reminders: [mockReminder],
    km: 12100,
    kmIsEstimated: true,
    kmAnchor: '6 dagen geleden bijgewerkt',
    loading: false,
    refreshing: false,
    error: false,
    refresh: mockRefresh,
  }),
  useTuningData: () => ({
    setups: [mockSetup],
    loading: false,
    error: false,
    refresh: mockRefresh,
  }),
  usePerformanceData: () => ({
    runs: [mockRun],
    loading: false,
    error: false,
    refresh: mockRefresh,
  }),
}));

jest.mock('@/services/fuel', () => ({
  listFuelLogs: jest.fn().mockResolvedValue([]),
  computeFuelStats: jest.fn().mockReturnValue(null),
}));

jest.mock('@/services/ai-insights', () => ({
  fetchAiVerwoording: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/services/notifications', () => ({
  notifyDeterioration: jest.fn().mockResolvedValue(undefined),
  syncLocalMaintenanceReminders: jest.fn().mockResolvedValue(0),
}));

jest.mock('@/services/maintenance', () => {
  const actual = jest.requireActual('@/services/maintenance');
  return {
    ...actual,
    dismissReminder: jest.fn().mockResolvedValue(undefined),
  };
});

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderScreen(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={initialMetrics}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  mockNavigation.navigate.mockClear();
  mockRouteParams.segment = undefined;
  mockRefresh.mockClear();
});

describe('HomeScreen', () => {
  it('toont de scooter, kilometerstand en het eerstvolgende onderhoud', () => {
    renderScreen(<HomeScreen />);

    expect(screen.getByText('Kilometerstand')).toBeTruthy();
    expect(screen.getByText('Yamaha Aerox')).toBeTruthy();
    expect(screen.getByText('12.100')).toBeTruthy();
    expect(screen.getAllByText('Bougie vervangen').length).toBeGreaterThan(0);
  });
});

describe('MaintenanceScreen', () => {
  it('toont het plan, de samenvatting en de herinnering', () => {
    renderScreen(<MaintenanceScreen embedded />);

    expect(screen.getByText('Onderhoudsplan')).toBeTruthy();
    expect(screen.getByText('Aerox')).toBeTruthy();
    expect(screen.getByText('Actie nodig')).toBeTruthy();
    // De plan-hero heeft dezelfde km-actie als Home.
    expect(screen.getByLabelText('Kilometerstand bijwerken')).toBeTruthy();
    expect(screen.getAllByText('Bougie vervangen').length).toBeGreaterThan(0);
    expect(screen.getByText('Bougie is te laat')).toBeTruthy();
  });

  it('kan een herinnering afronden en ververst daarna', async () => {
    renderScreen(<MaintenanceScreen embedded />);

    fireEvent.press(screen.getByLabelText('Gedaan'));

    const maintenanceService = jest.requireMock('@/services/maintenance') as {
      dismissReminder: jest.Mock;
    };
    expect(maintenanceService.dismissReminder).toHaveBeenCalledWith('reminder-1', 'afgerond');
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledWith({ force: true }));
  });
});

describe('TuningScreen', () => {
  it('toont de setups en de gereedschappen', () => {
    renderScreen(<TuningScreen embedded />);

    expect(screen.getByText('Tuningwerkplaats')).toBeTruthy();
    expect(screen.getByText('Nieuwe setup')).toBeTruthy();
    expect(screen.getByText('Sport')).toBeTruthy();
    expect(screen.getByText('Actief')).toBeTruthy();
    expect(screen.getByText('Setup vergelijken')).toBeTruthy();
  });
});

describe('PerformanceScreen', () => {
  it('toont de meetwaarden en de startactie', () => {
    renderScreen(<PerformanceScreen embedded />);

    expect(screen.getByText('START SPRINT TEST')).toBeTruthy();
    expect(screen.getByText('Recente metingen')).toBeTruthy();
    expect(screen.getByText('goed')).toBeTruthy();
  });
});

describe('Werkplaats', () => {
  it('opent op het onderhoudssegment met de plancijfers', () => {
    mockRouteParams.segment = 'onderhoud';
    renderScreen(<WorkshopScreen />);

    expect(screen.getByText('Werkplaats')).toBeTruthy();
    expect(screen.getByText('Onderhoud')).toBeTruthy();
    expect(screen.getByText('Onderhoudsplan')).toBeTruthy();
  });
});

describe('Garage', () => {
  it('opent op het GPS-segment met de meetwaarden', () => {
    mockRouteParams.segment = 'gpstest';
    renderScreen(<GarageScreen />);

    expect(screen.getByText('Garage')).toBeTruthy();
    expect(screen.getByText('GPS-test')).toBeTruthy();
    expect(screen.getByText('START SPRINT TEST')).toBeTruthy();
  });
});
