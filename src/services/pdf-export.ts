/**
 * PDF-export van het FIX50 ServicePass-dossier.
 * Native (iOS/Android): expo-print rendert de HTML naar een PDF-bestand,
 * daarna deel je die via de systeem-share-sheet (WhatsApp, mail, Drive…).
 * Web: opent een print-venster met het document — "Opslaan als PDF" levert
 * hetzelfde dossier. De HTML-zelf is zuiver en unit-getest (src/lib/pdf.ts).
 */
import { Platform } from 'react-native';

import {
  buildMaintenancePassHtml,
  buildTuningPassHtml,
  nlDate,
  type MaintenancePdfPlanningItem,
  type MaintenancePdfRecord,
  type TuningPdfRun,
} from '@/lib/pdf';
import { computeFuelStats } from '@/services/fuel';
import { listFuelLogs } from '@/services/fuel';
import {
  buildWeekForecast,
  listMaintenanceItems,
  listRecords,
  listSchedules,
} from '@/services/maintenance';
import { listRuns } from '@/services/performance';
import { listChanges, listSetups } from '@/services/tuning';
import { supabase } from '@/lib/supabase';
import { base64ToBytes, bytesToBase64, detectImageMime } from '@/lib/base64';
import type { MaintenanceRecord, PerformanceRun, Scooter, TuningChange, TuningSetup, UUID } from '@/types';

/**
 * Fotofetch → data-URI voor de PDF. Alleen successen worden gecachet: een
 * eerder mislukte fetch (offline) mag nooit permanent "geen foto" betekenen,
 * anders verdwijnt de brommer voor altijd uit het dossier.
 */
const photoCache = new Map<string, string>();

async function fetchPhotoDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[pdf-export] Fotofetch ${res.status} voor ${url}`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    return `data:${detectImageMime(bytes)};base64,${bytesToBase64(bytes)}`;
  } catch (err) {
    console.warn(`[pdf-export] Fotofetch mislukt voor ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Scooterfoto → data-URI voor de PDF. Lukt de scooterfoto niet of bestaat
 * hij niet, dan valt het document terug op de profielfoto (die bij elke
 * scooterfoto-upload óók wordt gezet). Lukt ook dat niet: dossier zonder
 * foto, netjes weggevallen.
 */
async function photoDataUri(
  url: string | null | undefined,
  fallbackUrl?: string | null,
): Promise<string | null> {
  if (url) {
    const cached = photoCache.get(url);
    const direct = cached ?? (await fetchPhotoDataUri(url));
    if (direct) {
      if (!cached) photoCache.set(url, direct);
      return direct;
    }
  }
  if (fallbackUrl) {
    const cachedFallback = photoCache.get(fallbackUrl);
    const fallback = cachedFallback ?? (await fetchPhotoDataUri(fallbackUrl));
    if (fallback) {
      if (!cachedFallback) photoCache.set(fallbackUrl, fallback);
      console.log('[pdf-export] Scooterfoto niet beschikbaar — profielfoto als fallback gebruikt.');
      return fallback;
    }
  }
  return null;
}

/** URL van de eigen profielfoto (profiles.avatar_url), of null. */
async function profileAvatarUrl(): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    const url = (data as { avatar_url?: string | null } | null)?.avatar_url;
    return typeof url === 'string' && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

/** Weergavenaam van de eigenaar (profielnaam of e-maillokje). */
async function ownerName(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const meta = (data.user?.user_metadata ?? {}) as { display_name?: string; name?: string };
  return meta.display_name ?? meta.name ?? data.user?.email?.split('@')[0] ?? null;
}

/** Recordnaam: eigen omschrijving, anders de onderdeelnaam. */
function nameResolver(items: { id: UUID; name: string }[]) {
  return (r: MaintenanceRecord): string =>
    r.custom_name ?? items.find((i) => i.id === r.item_id)?.name ?? 'Onderhoud';
}

/** PerformanceRun → PDF-vorm (alleen de velden die het document nodig heeft). */
function toPdfRun(r: PerformanceRun): TuningPdfRun {
  return {
    id: r.id,
    setup_id: r.setup_id,
    started_at: r.started_at,
    t0_50_s: r.t0_50_s,
    t0_80_s: r.t0_80_s,
    t50_80_s: r.t50_80_s,
    max_speed_kmh: r.max_speed_kmh,
    distance_m: r.distance_m,
    gps_quality: r.gps_quality,
    points: r.points.map((p) => ({ t_ms: p.t_ms, speed_kmh: p.speed_kmh })),
  };
}

function scooterBlock(scooter: Scooter) {
  return {
    id: scooter.id,
    name: scooter.name,
    brand: scooter.brand,
    model: scooter.model,
    year: scooter.year,
    license_plate: scooter.license_plate,
    fuel_system: scooter.fuel_system,
    engine_code: scooter.engine_code,
    current_km: scooter.current_km,
  };
}

/**
 * Proactieve planning voor het onderhoudsboekje: de eerstvolgende taken uit
 * de FIX50-voorspelling, met km/datum-detail in gewone taal.
 */
function buildPlanning(
  schedules: Awaited<ReturnType<typeof listSchedules>>,
  items: Awaited<ReturnType<typeof listMaintenanceItems>>,
  currentKm: number,
  avgKmPerWeek: number | null,
): MaintenancePdfPlanningItem[] {
  const forecast = buildWeekForecast(schedules, items, currentKm, avgKmPerWeek);
  return forecast.slice(0, 4).map((f) => {
    const s = f.schedule;
    let detail: string;
    if (s.next_due_km !== null) {
      const remaining = s.next_due_km - currentKm;
      detail =
        remaining > 0
          ? `verwacht rond ${s.next_due_km.toLocaleString('nl-NL')} km (over ~${remaining.toLocaleString('nl-NL')} km)`
          : 'nu aan de beurt';
    } else if (s.next_due_at !== null) {
      detail = `gepland voor ${nlDate(s.next_due_at)}`;
    } else {
      detail = f.dueLabel;
    }
    return { item: f.item.name, detail };
  });
}

/**
 * Onderhoudspaspoort genereren en delen/printen.
 * Native: rendert PDF en opent de share-sheet. Web: opent print-venster.
 */
export async function exportMaintenancePdf(scooter: Scooter): Promise<void> {
  const [records, items, schedules, fuelLogs, owner] = await Promise.all([
    listRecords(scooter.id, 200),
    listMaintenanceItems().catch(() => []),
    listSchedules(scooter.id).catch(() => []),
    listFuelLogs(scooter.id, 200).catch(() => []),
    ownerName(),
  ]);

  const resolveName = nameResolver(items);
  const pdfRecords: MaintenancePdfRecord[] = records.map((r) => ({
    name: resolveName(r),
    doneAtIso: r.done_at,
    km: r.km_at_service,
    costCents: r.cost_cents,
    parts: r.parts,
    notes: r.notes,
  }));

  const stats = fuelLogs.length > 0 ? computeFuelStats(fuelLogs) : null;
  const planning = buildPlanning(schedules, items, scooter.current_km, scooter.avg_km_per_week);
  const photo = await photoDataUri(scooter.image_url, await profileAvatarUrl());

  const html = buildMaintenancePassHtml({
    scooter: scooterBlock(scooter),
    ownerName: owner,
    records: pdfRecords,
    fuel: stats
      ? {
          avgLPer100km: stats.avgLPer100km,
          totalLiters: Math.round(stats.totalLiters * 10) / 10,
          totalCents: stats.totalCents,
        }
      : null,
    planning,
    photoSrc: photo,
  });

  await renderAndShare(html, sanitizeFileName(`FIX50-Onderhoudspaspoort-${scooter.name}`));
}

/**
 * Tuningpaspoort genereren: setups met hun gekoppelde metingen
 * (scooter-gebonden) plus het wijzigingenregister.
 */
export async function exportTuningPdf(scooter: Scooter): Promise<void> {
  const [setups, changes, runs, owner] = await Promise.all([
    listSetups(scooter.id),
    listChanges(scooter.id, 100),
    listRuns(200),
    ownerName(),
  ]);

  const scooterRuns = runs.filter((r) => r.scooter_id === scooter.id);
  const photo = await photoDataUri(scooter.image_url, await profileAvatarUrl());

  const html = buildTuningPassHtml({
    scooter: scooterBlock(scooter),
    ownerName: owner,
    setups: setups.map(
      (s: TuningSetup): { id: UUID; name: string; parts: Record<string, string | number | null>; is_active: boolean } => ({
        id: s.id,
        name: s.name,
        parts: s.parts,
        is_active: s.is_active,
      }),
    ),
    runs: scooterRuns.map(toPdfRun),
    changes: changes.map((c: TuningChange) => ({
      changed_at: c.changed_at,
      part: c.part,
      old_value: c.old_value,
      new_value: c.new_value,
      result: c.result,
      km_at_change: c.km_at_change,
    })),
    photoSrc: photo,
  });

  await renderAndShare(html, sanitizeFileName(`FIX50-Tuningpaspoort-${scooter.name}`));
}

/** Bestandsnaam zonder rare tekens (padveilig voor iOS/Android). */
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** HTML → PDF (native) of print-venster (web). Gooi bij elke stap een duidelijke fout. */
async function renderAndShare(html: string, fileName: string): Promise<void> {
  if (!html || html.length < 100) {
    throw new Error('Document was leeg — probeer het opnieuw.');
  }

  if (Platform.OS === 'web') {
    openPrintWindow(html, fileName);
    return;
  }

  // Dynamische imports: native modules blijven uit de web-bundel.
  let printModule: typeof import('expo-print');
  let Sharing: typeof import('expo-sharing');
  try {
    [printModule, Sharing] = await Promise.all([
      import('expo-print'),
      import('expo-sharing'),
    ]);
  } catch {
    throw new Error('PDF-modules konden niet geladen worden. Update de app (Expo Go) en probeer opnieuw.');
  }

  // A4 bij 72 PPI: 595 × 842 px (expo-print verwacht px, niet mm).
  // base64: true → we halen de PDF óók als data op. In Expo Go mag expo-sharing
  // NIET lezen uit cache/Print/ (waar expo-print schrijft) — met base64 kunnen
  // we zelf een deelbare kopie in een toegestane map zetten.
  // Time-out: blijft het renderen op een trage telefoon hangen, dan óók een
  // duidelijke fout i.p.v. een knop die eeuwig laadt.
  let uri: string;
  let base64: string | null = null;
  try {
    console.log('[pdf-export] PDF renderen…');
    const result = await Promise.race([
      printModule.printToFileAsync({ html, width: 595, height: 842, base64: true }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('PDF-rendering duurde te lang (60 s) — probeer het opnieuw.')),
          60_000,
        ),
      ),
    ]);
    uri = result.uri;
    base64 = result.base64 ?? null;
    console.log(
      `[pdf-export] PDF gemaakt: ${uri} (${result.numberOfPages ?? '?'} p., base64: ${base64 ? 'ja' : 'nee'})`,
    );
  } catch (err) {
    console.error('[pdf-export] printToFileAsync mislukt', err);
    throw new Error(
      `PDF-rendering mislukt${err instanceof Error ? `: ${err.message}` : ''}`,
    );
  }

  const originalUri = uri;
  // Nette, deelbare kopie in een map die we zelf mogen beheren (met de juiste
  // bestandsnaam). Lukt dat niet, dan delen we de originele print-URI.
  const shareableUri = await makeShareableCopy(uri, base64, fileName);
  uri = shareableUri ?? uri;

  let available = false;
  try {
    available = await Sharing.isAvailableAsync();
  } catch {
    available = false;
  }
  if (!available) {
    throw new Error('Delen wordt op dit apparaat niet ondersteund.');
  }

  const share = async (target: string): Promise<void> => {
    await Sharing.shareAsync(target, {
      mimeType: 'application/pdf',
      dialogTitle: 'FIX50 ServicePass delen',
      UTI: 'com.adobe.pdf',
    });
  };

  try {
    console.log(`[pdf-export] Share-sheet openen voor ${uri}`);
    await share(uri);
  } catch (err) {
    if (isShareCancel(err)) return;
    console.error('[pdf-export] shareAsync mislukt', err);
    // Fallback 1: originele print-URI (werkt in ontwikkel-/productie-builds).
    if (uri !== originalUri) {
      try {
        await share(originalUri);
        return;
      } catch (err2) {
        if (isShareCancel(err2)) return;
        console.error('[pdf-export] shareAsync (fallback) mislukt', err2);
      }
    }
    // Fallback 2: Android-afdrukvenster — daar kan de gebruiker "Opslaan als
    // PDF" kiezen. Werkt altijd, want expo-print mag zijn eigen bestand lezen.
    try {
      console.log('[pdf-export] Fallback: afdrukvenster openen');
      await printModule.printAsync({ uri: originalUri });
      return;
    } catch (err3) {
      if (isShareCancel(err3)) return;
      console.error('[pdf-export] printAsync (fallback) mislukt', err3);
      const msg = err3 instanceof Error ? err3.message : String(err3);
      throw new Error(
        `Delen mislukt${err instanceof Error ? `: ${err.message}` : ''} — en het afdrukvenster ook: ${msg}`,
      );
    }
  }
}

/** Share-sheet netjes gesloten ("User did not share", cancel, dismiss) → geen fout. */
function isShareCancel(err: unknown): boolean {
  return err instanceof Error && /cancel|dismiss|did not share|annuleer/i.test(err.message);
}

/**
 * Schrijf de PDF als nette bestandsnaam naar een map die expo-sharing mag
 * lezen. In Expo Go staat het nieuwe FS-permissiemodel geen toegang toe tot
 * cache/Print/ (waar expo-print schrijft), dus:
 *  1. nieuwe API: base64 → writeBytes naar Paths.cache;
 *  2. legacy-API: writeAsStringAsync naar cacheDirectory;
 *  3. nieuwe API: kopieer de print-URI (werkt in builds buiten Expo Go);
 *  4. lukt niets: null → dan delen we de originele print-URI.
 */
async function makeShareableCopy(
  printUri: string,
  base64: string | null,
  fileName: string,
): Promise<string | null> {
  const targetName = `${fileName}.pdf`;

  if (base64) {
    // 1. Nieuwe File-API: binair schrijven naar de cache-root.
    try {
      const FS = await import('expo-file-system');
      const target = new FS.File(FS.Paths.cache, targetName);
      if (target.exists) await target.delete();
      target.write(base64ToBytes(base64));
      console.log(`[pdf-export] Deelbare kopie (nieuw-API): ${target.uri}`);
      return target.uri;
    } catch (err) {
      console.log(`[pdf-export] Schrijven via nieuwe API mislukt: ${err instanceof Error ? err.message : String(err)}`);
    }
    // 2. Legacy-API: writeAsStringAsync met base64-encoding.
    try {
      const legacy = await import('expo-file-system/legacy');
      const dir = legacy.cacheDirectory;
      if (!dir) throw new Error('cacheDirectory onbekend');
      const target = `${dir}${targetName}`;
      await legacy.writeAsStringAsync(target, base64, { encoding: legacy.EncodingType.Base64 });
      console.log(`[pdf-export] Deelbare kopie (legacy): ${target}`);
      return target;
    } catch (err) {
      console.log(`[pdf-export] Schrijven via legacy mislukt: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. Kopiëren van de print-URI (zonder base64) — werkt als READ is toegestaan.
  try {
    const FS = await import('expo-file-system');
    const src = new FS.File(printUri);
    const target = new FS.File(FS.Paths.cache, targetName);
    if (target.exists) await target.delete();
    await src.copy(target);
    console.log(`[pdf-export] Deelbare kopie (copy): ${target.uri}`);
    return target.uri;
  } catch (err) {
    console.log(`[pdf-export] Kopiëren mislukt: ${err instanceof Error ? err.message : String(err)}`);
  }

  return null;
}

/**
 * Web: open het document in een nieuw tabblad via een Blob-URL (omzeilt
 * popup-blokkers en React 19 iframe-problemen) met auto-print → kies
 * "Opslaan als PDF" in het afdrukvenster. Bij een geblokkeerde popup valt
 * het terug op een directe HTML-download.
 */
function openPrintWindow(html: string, fileName: string): void {
  const autoPrint =
    '<script>window.addEventListener(\'load\',function(){setTimeout(function(){window.print();},300);});</script>';
  const doc = html.replace(
    '</head>',
    `<title>${fileName}</title>${autoPrint}</head>`,
  );
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Popup geblokkeerd: val terug op een directe download van de HTML.
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
