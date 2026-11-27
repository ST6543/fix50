/**
 * Schrijven met offline-val: netwerkstoringen gaan de wachtrij in, echte
 * fouten (RLS, validatie) niet.
 */
jest.mock('@/services/offline-cache', () => ({
  queueSync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));

import { AppError, OFFLINE_MESSAGE, isOfflineError } from '@/services/api';
import { currentUserId, sendOrQueue } from '@/services/offline-queue';

const queueSyncMock = (jest.requireMock('@/services/offline-cache') as {
  queueSync: jest.Mock;
}).queueSync;
const supabaseMock = (jest.requireMock('@/lib/supabase') as {
  supabase: { auth: { getSession: jest.Mock } };
}).supabase;

beforeEach(() => {
  queueSyncMock.mockClear();
  supabaseMock.auth.getSession.mockReset();
});

describe('isOfflineError', () => {
  it('herkent de netwerkmelding en de ruwe fetch-fout', () => {
    expect(isOfflineError(new AppError(OFFLINE_MESSAGE))).toBe(true);
    expect(isOfflineError(new Error('Network request failed'))).toBe(true);
    expect(isOfflineError(new Error('fetch failed'))).toBe(true);
  });

  it('ziet een RLS-fout niet als offline', () => {
    expect(isOfflineError(new Error('new row violates row-level security policy'))).toBe(false);
  });
});

describe('sendOrQueue', () => {
  it('verstuurt direct als de server bereikbaar is', async () => {
    const send = jest.fn().mockResolvedValue(undefined);

    await expect(sendOrQueue('fuel_logs', 'log-1', { id: 'log-1' }, send)).resolves.toBe('sent');
    expect(queueSyncMock).not.toHaveBeenCalled();
  });

  it('bewaart de rij als het netwerk ontbreekt', async () => {
    const send = jest.fn().mockRejectedValue(new AppError(OFFLINE_MESSAGE));

    await expect(
      sendOrQueue('performance_runs', 'run-1', { id: 'run-1' }, send),
    ).resolves.toBe('queued');
    expect(queueSyncMock).toHaveBeenCalledWith('performance_runs', 'run-1', { id: 'run-1' });
  });

  it('gooit een echte fout door zonder te bewaren', async () => {
    const send = jest.fn().mockRejectedValue(new Error('new row violates row-level security policy'));

    await expect(sendOrQueue('fuel_logs', 'log-1', { id: 'log-1' }, send)).rejects.toThrow(
      'row-level security',
    );
    expect(queueSyncMock).not.toHaveBeenCalled();
  });
});

describe('currentUserId', () => {
  it('leest de lokale sessie, zodat offline bewaren lukt', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    await expect(currentUserId()).resolves.toBe('user-1');
  });

  it('weigert zonder sessie', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(currentUserId()).rejects.toThrow('Niet ingelogd');
  });
});
