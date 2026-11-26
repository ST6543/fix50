/**
 * Factuurselectie: welke onderhoudsbeurten komen op de factuur?
 * Bewust zuiver (geen React/Supabase), zodat de regels testbaar blijven:
 * een periode met begin- en einddatum, of precies één geregistreerde beurt.
 */
import type { MaintenanceRecord } from '@/types';

export type InvoiceSelection =
  | { kind: 'period'; fromIso: string; toIso: string }
  | { kind: 'record'; recordId: string };

/** 'DD-MM-JJJJ' → 'JJJJ-MM-DD', of null bij een ongeldige datum. */
export function parseDateInput(value: string): string | null {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // 31-02 of 31-04 bestaat niet: de rollover verraadt dat.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Date → 'DD-MM-JJJJ' voor een invulveld. */
export function formatDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

/** 'JJJJ-MM-DD' → 'DD-MM-JJJJ'; onbekend formaat blijft leeg. */
export function isoDateToInput(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

/** Standaardperiode: de eerste van deze maand tot en met vandaag. */
export function defaultPeriod(now: Date): { fromIso: string; toIso: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fromIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const toIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { fromIso, toIso };
}

/** Beurten waarvan de registratiedatum binnen [van, tot en met] valt. */
export function filterRecordsByPeriod(
  records: MaintenanceRecord[],
  fromIso: string,
  toIso: string,
): MaintenanceRecord[] {
  const start = new Date(`${fromIso}T00:00:00`).getTime();
  const end = new Date(`${toIso}T23:59:59.999`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];

  return records.filter((record) => {
    const doneAt = new Date(record.done_at).getTime();
    return Number.isFinite(doneAt) && doneAt >= start && doneAt <= end;
  });
}

/** De gekozen beurten voor de factuur; leeg als de keuze niets oplevert. */
export function selectRecordsForInvoice(
  records: MaintenanceRecord[],
  selection: InvoiceSelection,
): MaintenanceRecord[] {
  if (selection.kind === 'record') {
    return records.filter((record) => record.id === selection.recordId);
  }
  return filterRecordsByPeriod(records, selection.fromIso, selection.toIso);
}
