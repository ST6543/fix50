/** Generieke Supabase-call wrapper met nette foutafhandeling (NL) en timeout. */
import { supabase } from '@/lib/supabase';

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

const NETWORK_HINTS = ['fetch failed', 'network request failed', 'internet', 'offline', 'load failed'];

export function friendlyError(err: unknown): string {
  if (err instanceof AppError) return err.message;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (NETWORK_HINTS.some((h) => msg.includes(h))) {
    return 'Er is momenteel geen internetverbinding. Je gegevens worden lokaal bewaard en later gesynchroniseerd.';
  }
  if (msg.includes('jose')) return 'Je sessie is verlopen. Log opnieuw in.';
  if (msg.includes('duplicate key')) return 'Dit bestaat al in je lijst.';
  if (msg.includes('row-level security')) return 'Je hebt geen toegang tot deze gegevens.';
  return 'Er ging iets mis. Probeer het opnieuw.';
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 15000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new AppError('De server reageert niet. Probeer het opnieuw.')), ms),
    ),
  ]) as Promise<T>;
}

/** Voert een Supabase-query uit met timeout en vriendelijke foutmelding. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T>(fn: () => any): Promise<T> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await withTimeout(fn())) as any;
    const { data, error } = result as { data: unknown; error: { message: string } | null };
    if (error) throw new AppError(friendlyError(error));
    return data as T;
  } catch (err) {
    throw new AppError(friendlyError(err));
  }
}

export { supabase };
