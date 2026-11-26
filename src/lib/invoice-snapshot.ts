/**
 * Factuurregister — de bevroren momentopname van één factuur.
 *
 * Een factuur wordt één keer opgebouwd uit de gekozen onderhoudsbeurten en
 * daarna als snapshot bewaard. Opnieuw delen rendert alleen nog die snapshot,
 * dus een eerder gedeelde factuur verandert nooit meer mee met het onderhoud.
 *
 * Puur en testbaar — geen Supabase, geen React Native.
 */
import { buildInvoiceHtml, nlDate, type InvoicePdfInput } from './pdf';
import type { InvoiceSelection } from './invoice-selection';
import type { MaintenanceRecord } from '@/types';

/** Vaste prefix van de FIX50-nummerreeks. */
export const INVOICE_NUMBER_PREFIX = 'F50';

export interface InvoiceSnapshotScooter {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  fuel_system: string | null;
  /** Stand op het moment van uitgeven — niet de latere stand. */
  current_km: number;
}

export interface InvoiceSnapshotLine {
  description: string;
  detail: string | null;
  doneAtIso: string;
  km: number | null;
  amountCents: number | null;
}

export interface InvoiceSnapshot {
  /** Versie van het snapshotformaat; oude rijen blijven leesbaar. */
  version: 1;
  scooter: InvoiceSnapshotScooter;
  ownerName: string | null;
  issuedAtIso: string;
  selection: InvoiceSelection;
  lines: InvoiceSnapshotLine[];
  totalCents: number;
}

/** Een rij uit het register (spiegel van public.invoices). */
export interface InvoiceRegisterEntry {
  id: string;
  user_id: string;
  scooter_id: string | null;
  sequence_year: number;
  sequence_no: number;
  invoice_number: string;
  issued_at: string;
  selection: InvoiceSelection;
  snapshot: InvoiceSnapshot;
  created_at: string;
}

/** Jaar van de nummerreeks (JJJJ), met het huidige jaar als de datum onleesbaar is. */
export function invoiceSequenceYear(isoDate: string): number {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return new Date().getFullYear();
  return new Date(parsed).getFullYear();
}

/** Nummer in de eigen reeks: F50-2026-0001 (minimaal vier cijfers). */
export function formatInvoiceNumber(year: number, sequenceNo: number): string {
  const safeYear = Number.isFinite(year) ? Math.trunc(year) : new Date().getFullYear();
  const safeNo = Number.isFinite(sequenceNo) ? Math.max(1, Math.trunc(sequenceNo)) : 1;
  return `${INVOICE_NUMBER_PREFIX}-${safeYear}-${String(safeNo).padStart(4, '0')}`;
}

/** Onderhoudsbeurten → factuurregels, oudste eerst. */
export function invoiceLinesFromRecords(
  records: MaintenanceRecord[],
  nameOf: (record: MaintenanceRecord) => string,
): InvoiceSnapshotLine[] {
  return records
    .map((record) => ({
      description: nameOf(record),
      detail: record.parts ?? null,
      doneAtIso: record.done_at,
      km: record.km_at_service,
      amountCents: record.cost_cents,
    }))
    .sort((a, b) => a.doneAtIso.localeCompare(b.doneAtIso));
}

/** Bouwt het snapshot dat vanaf nu als enige bron voor het document geldt. */
export function buildInvoiceSnapshot(input: {
  scooter: InvoiceSnapshotScooter;
  ownerName: string | null;
  issuedAtIso: string;
  selection: InvoiceSelection;
  lines: InvoiceSnapshotLine[];
}): InvoiceSnapshot {
  const lines = [...input.lines]
    .map((line) => ({
      description: line.description,
      detail: line.detail ?? null,
      doneAtIso: line.doneAtIso,
      km: line.km,
      amountCents: line.amountCents,
    }))
    .sort((a, b) => a.doneAtIso.localeCompare(b.doneAtIso));

  return {
    version: 1,
    scooter: { ...input.scooter },
    ownerName: input.ownerName,
    issuedAtIso: input.issuedAtIso,
    selection: { ...input.selection },
    lines,
    totalCents: lines.reduce((sum, line) => sum + (line.amountCents ?? 0), 0),
  };
}

/** Totaal van het snapshot; valt terug op de regels als het veld ontbreekt. */
export function invoiceSnapshotTotal(snapshot: InvoiceSnapshot): number {
  if (Number.isFinite(snapshot.totalCents)) return snapshot.totalCents;
  return (snapshot.lines ?? []).reduce((sum, line) => sum + (line.amountCents ?? 0), 0);
}

/**
 * Wat er op de factuur staat, in gewone taal: een periode of één losse beurt.
 * Gebruikt de opgeslagen selectie, niet de huidige gegevens.
 */
export function invoiceSelectionLabel(selection: InvoiceSelection): string {
  if (selection.kind === 'record') return 'Eén losse beurt';
  if (selection.fromIso === selection.toIso) return nlDate(selection.fromIso);
  return `${nlDate(selection.fromIso)} t/m ${nlDate(selection.toIso)}`;
}

/**
 * Rendert het document uitsluitend uit het opgeslagen snapshot. De
 * genereerdatum is de uitgiftedatum, zodat opnieuw delen byte-voor-byte
 * hetzelfde document oplevert.
 */
export function buildInvoiceHtmlFromSnapshot(
  snapshot: InvoiceSnapshot,
  invoiceNumber: string,
): string {
  return buildInvoiceHtml({
    scooter: snapshot.scooter as InvoicePdfInput['scooter'],
    ownerName: snapshot.ownerName,
    lines: snapshot.lines,
    invoiceNumber,
    issuedAtIso: snapshot.issuedAtIso,
    generatedAtIso: snapshot.issuedAtIso,
  });
}
