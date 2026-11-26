/**
 * Tests voor de gedeelde datalaag: cache binnen de TTL, geforceerd verversen,
 * dedupe van gelijktijdige aanvragen en het eenmalig aanmaken van een lege
 * planning. De services zijn gemockt; dit test de laag zelf, niet Supabase.
 */
import {
  APP_DATA_RUNS_LIMIT,
  APP_DATA_TTL_MS,
  clearAppDataCache,
  loadAppData,
} from '@/hooks/useAppData';
import {
  ensureSchedulesForScooter,
  listMaintenanceItems,
  listOpenReminders,
  listSchedules,
} from '@/services/maintenance';
import { listRuns } from '@/services/performance';
import { listSetups } from '@/services/tuning';
import type {
  MaintenanceItem,
  MaintenanceSchedule,
  PerformanceRun,
  Scooter,
  TuningSetup,
} from '@/types';

jest.mock('@/hooks/useScooters', () => ({ useScooters: jest.fn() }));

jest.mock('@/services/maintenance', () => ({
  listMaintenanceItems: jest.fn(),
  listSchedules: jest.fn(),
  listOpenReminders: jest.fn(),
  ensureSchedulesForScooter: jest.fn(),
}));

jest.mock('@/services/performance', () => ({ listRuns: jest.fn() }));

jest.mock('@/services/tuning', () => ({ listSetups: jest.fn() }));

const scooter: Scooter = {
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

const item: MaintenanceItem = {
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

const schedule: MaintenanceSchedule = {
  id: 'schedule-1',
  scooter_id: 'scooter-1',
  item_id: 'item-1',
  interval_km: 6000,
  interval_months: null,
  enabled: true,
  last_done_km: 8000,
  last_done_at: '2025-12-01T00:00:00.000Z',
  next_due_km: 14000,
  next_due_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const setup: TuningSetup = {
  id: 'setup-1',
  scooter_id: 'scooter-1',
  name: 'Sport',
  parts: { hoofdsproeier: 92 },
  is_active: true,
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const run: PerformanceRun = {
  id: 'run-1',
  scooter_id: 'scooter-1',
  setup_id: null,
  started_at: '2026-11-20T10:00:00.000Z',
  ended_at: null,
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

/** Standaardantwoorden: gevulde planning, setups en één meting. */
function mockHappyServices() {
  jest.mocked(listMaintenanceItems).mockResolvedValue([item]);
  jest.mocked(listOpenReminders).mockResolvedValue([]);
  jest.mocked(listSchedules).mockResolvedValue([schedule]);
  jest.mocked(listSetups).mockResolvedValue([setup]);
  jest.mocked(listRuns).mockResolvedValue([run]);
  jest.mocked(ensureSchedulesForScooter).mockResolvedValue(undefined);
}

beforeEach(() => {
  clearAppDataCache();
  jest.clearAllMocks();
  mockHappyServices();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('loadAppData — cache binnen de TTL', () => {
  it('gebruikt de snapshot opnieuw zonder de services te bevragen', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    const first = await loadAppData(scooter);
    now.mockReturnValue(1_000_000 + APP_DATA_TTL_MS - 1);
    const second = await loadAppData(scooter);

    expect(second).toBe(first);
    expect(listMaintenanceItems).toHaveBeenCalledTimes(1);
    expect(listSchedules).toHaveBeenCalledTimes(1);
    expect(listSetups).toHaveBeenCalledTimes(1);
    expect(listRuns).toHaveBeenCalledTimes(1);
  });

  it('ververst zodra de TTL verstreken is', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(2_000_000);

    await loadAppData(scooter);
    now.mockReturnValue(2_000_000 + APP_DATA_TTL_MS);
    const refreshed = await loadAppData(scooter);

    expect(refreshed).not.toBe(undefined);
    expect(listMaintenanceItems).toHaveBeenCalledTimes(2);
    expect(refreshed.fetchedAt).toBe(2_000_000 + APP_DATA_TTL_MS);
  });
});

describe('loadAppData — geforceerd verversen', () => {
  it('haalt nieuwe data op en negeert de cache', async () => {
    const first = await loadAppData(scooter);
    jest.mocked(listMaintenanceItems).mockResolvedValue([{ ...item, name: 'Nieuwe bougie' }]);

    const forced = await loadAppData(scooter, true);

    expect(listMaintenanceItems).toHaveBeenCalledTimes(2);
    expect(forced).not.toBe(first);
    expect(forced.maintenance.items[0]?.name).toBe('Nieuwe bougie');
    expect(first.maintenance.items[0]?.name).toBe('Bougie vervangen');
  });
});

describe('loadAppData — dedupe van gelijktijdige aanvragen', () => {
  it('deelt één fetch tussen schermen die tegelijk laden', async () => {
    let resolveItems: (items: MaintenanceItem[]) => void = () => undefined;
    jest.mocked(listMaintenanceItems).mockReturnValue(
      new Promise<MaintenanceItem[]>((resolve) => {
        resolveItems = resolve;
      }),
    );

    const first = loadAppData(scooter);
    const second = loadAppData(scooter);

    expect(second).toBe(first);
    expect(listMaintenanceItems).toHaveBeenCalledTimes(1);
    expect(listSchedules).not.toHaveBeenCalled();

    resolveItems([item]);
    const [a, b] = await Promise.all([first, second]);

    expect(a).toBe(b);
    expect(listMaintenanceItems).toHaveBeenCalledTimes(1);
    expect(listSchedules).toHaveBeenCalledTimes(1);
    expect(listSetups).toHaveBeenCalledTimes(1);
    expect(listRuns).toHaveBeenCalledWith(APP_DATA_RUNS_LIMIT, scooter.id);
  });
});

describe('loadAppData — lege planning', () => {
  it('maakt de planning één keer aan en leest daarna de nieuwe planning', async () => {
    jest
      .mocked(listSchedules)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([schedule]);

    const snapshot = await loadAppData(scooter);

    expect(ensureSchedulesForScooter).toHaveBeenCalledTimes(1);
    expect(ensureSchedulesForScooter).toHaveBeenCalledWith({
      id: scooter.id,
      fuel_system: scooter.fuel_system,
    });
    expect(snapshot.maintenance.schedules).toEqual([schedule]);
  });

  it('maakt de planning niet opnieuw aan bij een cache-treffer', async () => {
    jest.mocked(listSchedules).mockResolvedValueOnce([]).mockResolvedValueOnce([schedule]);

    await loadAppData(scooter);
    await loadAppData(scooter);

    expect(ensureSchedulesForScooter).toHaveBeenCalledTimes(1);
    expect(listSchedules).toHaveBeenCalledTimes(2);
  });

  it('raakt een bestaande planning niet aan', async () => {
    await loadAppData(scooter, true);

    expect(ensureSchedulesForScooter).not.toHaveBeenCalled();
    expect(listSchedules).toHaveBeenCalledTimes(1);
  });

  it('probeert het niet zonder brandstofsysteem', async () => {
    jest.mocked(listSchedules).mockResolvedValue([]);

    const snapshot = await loadAppData({ ...scooter, fuel_system: null });

    expect(ensureSchedulesForScooter).not.toHaveBeenCalled();
    expect(snapshot.maintenance.schedules).toEqual([]);
  });
});
