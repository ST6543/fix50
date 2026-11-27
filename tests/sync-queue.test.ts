/**
 * Offline-wachtrij: de nieuwe tabellen gaan mee, mislukte rijen blijven staan
 * en worden als openstaand gemeld in plaats van stil te verdwijnen.
 */
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

interface StoredRow {
  id: number;
  table_name: string;
  row_id: string;
  payload: string;
  created_at: number;
}

let mockRows: StoredRow[] = [];
let mockNextId = 1;

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('insert into sync_queue')) {
        mockRows.push({
          id: mockNextId++,
          table_name: String(params[0]),
          row_id: String(params[1]),
          payload: String(params[2]),
          created_at: Number(params[3]),
        });
      } else if (sql.startsWith('delete from sync_queue')) {
        mockRows = mockRows.filter((row) => row.id !== params[0]);
      }
    }),
    getAllAsync: jest.fn(async () => mockRows.map((row) => ({ ...row }))),
    getFirstAsync: jest.fn(async () => null),
  })),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getSession: jest.fn() },
  },
}));

import {
  flushSyncQueue,
  pendingSyncCount,
  queueSync,
  syncQueueSummary,
} from '@/services/offline-cache';

const supabaseMock = (jest.requireMock('@/lib/supabase') as {
  supabase: { from: jest.Mock; auth: { getSession: jest.Mock } };
}).supabase;

function tableStub(insertError: { message: string } | null = null) {
  const insert = jest.fn().mockResolvedValue({ error: insertError });
  const eq = jest.fn().mockResolvedValue({ error: insertError });
  return {
    insert,
    upsert: jest.fn().mockResolvedValue({ error: insertError }),
    update: jest.fn(() => ({ eq })),
    eq,
  };
}

beforeEach(() => {
  mockRows = [];
  mockNextId = 1;
  supabaseMock.from.mockReset();
  supabaseMock.from.mockImplementation(() => tableStub());
  supabaseMock.auth.getSession.mockReset();
});

describe('queueSync', () => {
  it('bewaart een rij en telt hem als openstaand', async () => {
    await queueSync('fuel_logs', 'log-1', { id: 'log-1', liters: 4.2 });

    expect(await pendingSyncCount()).toBe(1);
    const summary = await syncQueueSummary();
    expect(summary.pending).toBe(1);
    expect(summary.oldestAt).toEqual(expect.any(Number));
    expect(JSON.parse(mockRows[0]!.payload)).toEqual({ id: 'log-1', liters: 4.2 });
  });
});

describe('flushSyncQueue', () => {
  it('verstuurt tankbeurten, tuning en metingen en haalt ze uit de wachtrij', async () => {
    await queueSync('fuel_logs', 'log-1', { id: 'log-1' });
    await queueSync('tuning_changes', 'group-1', [{ id: 'c1' }, { id: 'c2' }]);
    await queueSync('performance_runs', 'run-1', { id: 'run-1' });

    const result = await flushSyncQueue();

    expect(result).toEqual({ synced: 3, failed: 0, pending: 0 });
    expect(supabaseMock.from).toHaveBeenCalledWith('fuel_logs');
    expect(supabaseMock.from).toHaveBeenCalledWith('tuning_changes');
    expect(supabaseMock.from).toHaveBeenCalledWith('performance_runs');
    // Een sproeierwissel gaat als geheel (array) in één insert.
    const tuningStub = supabaseMock.from.mock.results[1]!.value as ReturnType<typeof tableStub>;
    expect(tuningStub.insert).toHaveBeenCalledWith([{ id: 'c1' }, { id: 'c2' }]);
    expect(mockRows).toEqual([]);
  });

  it('houdt een rij die de server weigert vast en meldt hem als openstaand', async () => {
    await queueSync('fuel_logs', 'log-1', { id: 'log-1' });
    supabaseMock.from.mockImplementationOnce(() =>
      tableStub({ message: 'new row violates row-level security policy' }),
    );

    const result = await flushSyncQueue();

    expect(result).toEqual({ synced: 0, failed: 1, pending: 1 });
    expect(mockRows).toHaveLength(1);
  });

  it('legt geen verzending stil vast bij een onbekende tabel', async () => {
    await queueSync('fuel_logs', 'log-1', { id: 'log-1' });
    // Simuleer een rij van een oudere app-versie.
    mockRows[0]!.table_name = 'onbekend';

    const result = await flushSyncQueue();

    expect(result).toEqual({ synced: 0, failed: 1, pending: 1 });
    expect(mockRows).toHaveLength(1);
  });

  it('werkt een scooter-update bij op id', async () => {
    await queueSync('scooters', 'scooter-1', { current_km: 13100 });

    const result = await flushSyncQueue();

    expect(result.synced).toBe(1);
    const stub = supabaseMock.from.mock.results[0]!.value as ReturnType<typeof tableStub>;
    expect(stub.update).toHaveBeenCalledWith({ current_km: 13100 });
    expect(stub.eq).toHaveBeenCalledWith('id', 'scooter-1');
  });

  it('doet niets bij een lege wachtrij', async () => {
    expect(await flushSyncQueue()).toEqual({ synced: 0, failed: 0, pending: 0 });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
