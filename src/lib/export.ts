/**
 * Export/delen van het onderhoudslogboek.
 * Web: CSV-download via Blob. Native: Share-API met een leesbare samenvatting
 * (tekst werkt overal: WhatsApp, e-mail, notities).
 * CSV- en samenvattingsbouw zijn zuivere functies en unit-getest.
 */
import { Platform, Share } from 'react-native';

import { computeFuelStats, formatKmPerLiter } from '@/services/fuel';

import type { FuelLog, MaintenanceRecord } from '@/types';

function csvCell(value: string | number | null): string {
  const s = value === null ? '' : String(value);
  // Quote velden die het scheidingsteken (;), quotes of newlines bevatten.
  // Komma's blijven ongequote — dat is hier het decimaalteken.
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Naam van een registratie; item-namen lost de caller op via een resolver. */
export type NameResolver = (record: MaintenanceRecord) => string;
const defaultName: NameResolver = (record) => record.custom_name ?? 'Onderhoud';

/**
 * Bouw de CSV van het onderhoudslogboek.
 * Kolommen: datum; naam; km; kosten_eur; onderdelen; notities.
 */
export function buildMaintenanceCsv(
  records: MaintenanceRecord[],
  resolveName: NameResolver = defaultName,
): string {
  const header = 'datum;naam;km;kosten_eur;onderdelen;notities';
  const rows = [...records]
    .sort((a, b) => a.done_at.localeCompare(b.done_at))
    .map((r) =>
      [
        r.done_at.slice(0, 10),
        resolveName(r),
        r.km_at_service ?? '',
        r.cost_cents !== null ? (r.cost_cents / 100).toFixed(2).replace('.', ',') : '',
        r.parts ?? '',
        r.notes ?? '',
      ]
        .map(csvCell)
        .join(';'),
    );
  return [header, ...rows].join('\n');
}

/**
 * Bouw de CSV van het tankbeurten-log.
 * Kolommen: datum; km; liters; l_per_100km; km_per_liter; prijs_per_liter_eur; station.
 * Verbruikskolommen blijven leeg voor beurten zonder bruikbare tussenstand.
 */
export function buildFuelCsv(logs: FuelLog[]): string {
  const header = 'datum;km;liters;l_per_100km;km_per_liter;prijs_per_liter_eur;station';
  const sorted = [...logs].sort((a, b) => a.filled_at.localeCompare(b.filled_at));
  const rows = sorted.map((log, i) => {
    const prev = i > 0 ? sorted[i - 1]! : null;
    let lPer100 = '';
    let kmPerLiter = '';
    if (prev && log.odometer_km > prev.odometer_km) {
      const l100 = (log.liters / (log.odometer_km - prev.odometer_km)) * 100;
      lPer100 = l100.toFixed(1).replace('.', ',');
      kmPerLiter = l100 > 0 ? (100 / l100).toFixed(1).replace('.', ',') : '';
    }
    return [
      log.filled_at.slice(0, 10),
      log.odometer_km,
      log.liters.toFixed(1).replace('.', ','),
      lPer100,
      kmPerLiter,
      log.price_per_liter_cents !== null ? (log.price_per_liter_cents / 100).toFixed(2).replace('.', ',') : '',
      log.station ?? '',
    ]
      .map(csvCell)
      .join(';');
  });
  return [header, ...rows].join('\n');
}

/** Leesbare tekstsamenvatting voor de Share-API (totaal + meest recente onderhoud). */
export function buildMaintenanceSummary(
  records: MaintenanceRecord[],
  scooterName: string,
  resolveName: NameResolver = defaultName,
): string {
  const sorted = [...records].sort((a, b) => b.done_at.localeCompare(a.done_at));
  const totalCents = records.reduce((sum, r) => sum + (r.cost_cents ?? 0), 0);
  const lines: string[] = [`Onderhoudslogboek ${scooterName} — FIX50`, ''];
  if (records.length === 0) {
    lines.push('Nog geen onderhoud geregistreerd.');
    return lines.join('\n');
  }
  lines.push(`Aantal registraties: ${records.length}`);
  lines.push(
    `Totale kosten: €${(totalCents / 100).toLocaleString('nl-NL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  );
  lines.push('');
  lines.push('Laatste 10 beurten:');
  for (const r of sorted.slice(0, 10)) {
    const km = r.km_at_service !== null ? ` bij ${r.km_at_service.toLocaleString('nl-NL')} km` : '';
    const cost = r.cost_cents !== null ? ` · €${(r.cost_cents / 100).toFixed(2).replace('.', ',')}` : '';
    lines.push(`- ${r.done_at.slice(0, 10)}: ${resolveName(r)}${km}${cost}`);
  }
  lines.push('');
  lines.push('Gemaakt met FIX50 — onderhouds-assistent voor brommer en scooter.');
  return lines.join('\n');
}

/** Open de share-sheet (native) of download de CSV (web). */
async function shareOrDownloadCsv(csv: string, fileName: string, shareTitle: string, message: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: shareTitle, message });
}

/** Deel/download het onderhoudslogboek. */
export async function shareMaintenanceLog(
  records: MaintenanceRecord[],
  scooterName: string,
  resolveName: NameResolver = defaultName,
): Promise<void> {
  const fileName = `onderhoud-${scooterName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  await shareOrDownloadCsv(
    buildMaintenanceCsv(records, resolveName),
    fileName,
    'Onderhoudslogboek',
    buildMaintenanceSummary(records, scooterName, resolveName),
  );
}

/** Deel/download het tankbeurten-log (met verbruik per beurt). */
export async function shareFuelLog(logs: FuelLog[], scooterName: string): Promise<void> {
  const stats = computeFuelStats(logs);
  const lines: string[] = [`Tankbeurten ${scooterName} — FIX50`, ''];
  if (logs.length === 0) {
    lines.push('Nog geen tankbeurten geregistreerd.');
  } else {
    lines.push(`Aantal beurten: ${logs.length}`);
    lines.push(`Totaal getankt: ${stats.totalLiters.toFixed(1).replace('.', ',')} L`);
    if (stats.avgKmPerLiter !== null) lines.push(`Gemiddeld verbruik: ${formatKmPerLiter(stats.avgKmPerLiter)}`);
    lines.push('');
    lines.push('Laatste beurten (nieuwste eerst):');
    for (const p of [...stats.points].reverse().slice(0, 10)) {
      lines.push(
        `- ${p.filledAtIso.slice(0, 10)}: ${formatKmPerLiter(p.kmPerLiter)} (${p.distanceKm.toLocaleString('nl-NL')} km)`,
      );
    }
  }
  lines.push('', 'Gemaakt met FIX50 — onderhouds-assistent voor brommer en scooter.');
  await shareOrDownloadCsv(
    buildFuelCsv(logs),
    `tankbeurten-${scooterName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
    'Tankbeurten',
    lines.join('\n'),
  );
}
