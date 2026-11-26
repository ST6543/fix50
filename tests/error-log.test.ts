/** Centrale foutenlog: schermnaam, context, begrensd geheugen en console-uitgang. */
import {
  clearAppErrors,
  ERROR_LOG_LIMIT,
  logAppError,
  recentAppErrors,
} from '@/lib/error-log';

let spy: jest.SpyInstance;

beforeEach(() => {
  clearAppErrors();
  spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  spy.mockRestore();
});

describe('logAppError', () => {
  it('legt schermnaam, melding, context en stack vast', () => {
    const entry = logAppError(new Error('PDF mislukt'), 'Onderhoudsgeschiedenis', 'factuur');

    expect(entry.screen).toBe('Onderhoudsgeschiedenis');
    expect(entry.message).toBe('PDF mislukt');
    expect(entry.context).toBe('factuur');
    expect(entry.stack).toContain('PDF mislukt');
    expect(Number.isNaN(Date.parse(entry.at))).toBe(false);
  });

  it('schrijft één regel met schermnaam naar de console', () => {
    logAppError(new Error('kapot'), 'Home', 'render');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBe('[FIX50] Home (render): kapot');
  });

  it('kan zonder context en met een niet-Error omgaan', () => {
    const entry = logAppError('iets raars', '');

    expect(entry.screen).toBe('onbekend');
    expect(entry.message).toBe('iets raars');
    expect(entry.context).toBeUndefined();
    expect(entry.stack).toBeUndefined();
  });

  it('bewaart de nieuwste eerst en houdt het geheugen begrensd', () => {
    for (let i = 0; i < ERROR_LOG_LIMIT + 5; i += 1) {
      logAppError(new Error(`fout ${i}`), 'Home');
    }

    const recent = recentAppErrors();
    expect(recent).toHaveLength(ERROR_LOG_LIMIT);
    expect(recent[0]!.message).toBe(`fout ${ERROR_LOG_LIMIT + 4}`);
    expect(recent[recent.length - 1]!.message).toBe('fout 5');
  });

  it('maakt het geheugen leeg met clearAppErrors', () => {
    logAppError(new Error('een'), 'Home');
    clearAppErrors();

    expect(recentAppErrors()).toHaveLength(0);
  });
});
