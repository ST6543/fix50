/** Factuurregister: nummers uitgeven en opgeslagen snapshots teruglezen. */
import { query } from './api';
import { supabase } from '@/lib/supabase';
import type { InvoiceSelection } from '@/lib/invoice-selection';
import type { InvoiceRegisterEntry, InvoiceSnapshot } from '@/lib/invoice-snapshot';
import type { UUID } from '@/types';

/**
 * Registreert de factuur en krijgt het nummer terug. De database deelt het
 * nummer atomair uit (eigen reeks per gebruiker per jaar) en bewaart het
 * snapshot in dezelfde transactie.
 */
export async function registerInvoice(args: {
  scooterId: UUID;
  selection: InvoiceSelection;
  snapshot: InvoiceSnapshot;
  issuedAtIso: string;
}): Promise<InvoiceRegisterEntry> {
  return query<InvoiceRegisterEntry>(() =>
    supabase.rpc('register_invoice', {
      p_scooter_id: args.scooterId,
      p_selection: args.selection,
      p_snapshot: args.snapshot,
      p_issued_at: args.issuedAtIso,
    }),
  );
}

/** Eerder uitgegeven facturen van deze scooter, nieuwste eerst. */
export async function listInvoices(scooterId: UUID, limit = 50): Promise<InvoiceRegisterEntry[]> {
  return query<InvoiceRegisterEntry[]>(() =>
    supabase
      .from('invoices')
      .select('*')
      .eq('scooter_id', scooterId)
      .order('issued_at', { ascending: false })
      .limit(limit),
  );
}
