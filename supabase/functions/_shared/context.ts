/**
 * Context-retrieval voor de diagnose-chat.
 * Database eerst: alleen relevante FIX50-records gaan naar het AI-model.
 */
import type { DiagnosisContext } from './schemas.ts';

export interface SearchedDiagnosis {
  id: string;
  category: string;
  engine_type: string;
  problem: string;
  symptoms: string;
  causes: string;
  visual_test: string | null;
  measurement_test: string | null;
  road_test: string | null;
  solution: string | null;
  severity: string;
  score: number;
}

export interface ScooterContext {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  engine_type: string | null;
  fuel_system: string | null;
  current_km: number;
  setup: Record<string, unknown> | null;
}

export async function searchDiagnosis(
  serviceClient: { rpc: Function },
  query: string,
  engineType: string | null,
  limit = 8,
): Promise<SearchedDiagnosis[]> {
  const { data, error } = await serviceClient.rpc('search_diagnosis', {
    p_query: query,
    p_engine_type: engineType,
    p_limit: limit,
  });
  if (error) {
    console.error('search_diagnosis RPC fout:', error.message);
    return [];
  }
  return (data ?? []) as SearchedDiagnosis[];
}

/** Zoekt ook met losse termen als de volledige vraag weinig oplevert. */
export async function searchWithFallback(
  serviceClient: { rpc: Function },
  message: string,
  engineType: string | null,
): Promise<SearchedDiagnosis[]> {
  const primary = await searchDiagnosis(serviceClient, message, engineType, 8);
  if (primary.length > 0 && primary[0]!.score >= 1.5) return primary;

  // Val terug op de langste woorden uit de vraag (typo's blijven via trigram matchen).
  const words = message
    .toLowerCase()
    .split(/[^a-zà-ÿ0-9]+/)
    .filter((w) => w.length >= 4)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
  const seen = new Set(primary.map((p) => p.id));
  const extra: SearchedDiagnosis[] = [];
  for (const w of words) {
    const hits = await searchDiagnosis(serviceClient, w, engineType, 4);
    for (const h of hits) {
      if (!seen.has(h.id)) {
        seen.add(h.id);
        extra.push(h);
      }
    }
    if (primary.length + extra.length >= 10) break;
  }
  return [...primary, ...extra].slice(0, 10);
}

export async function getScooterContext(
  serviceClient: { from: Function },
  userId: string,
  scooterId: string,
): Promise<ScooterContext | null> {
  const { data } = await serviceClient
    .from('scooters')
    .select('id, user_id, name, brand, model, year, engine_type, fuel_system, current_km, scooter_setups(*)')
    .eq('id', scooterId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  const { scooter_setups, ...scooter } = data as Record<string, unknown> & { scooter_setups: unknown[] };
  return {
    ...(scooter as unknown as ScooterContext),
    setup: ((scooter_setups as Record<string, unknown>[] | null)?.[0]) ?? null,
  };
}

/** Onderhoudscontext: laatste 5 records + open reminders (voor onderhoudsvragen in chat). */
export async function getMaintenanceContext(
  serviceClient: { from: Function },
  scooterId: string,
): Promise<{ recent: string[]; openReminders: string[] }> {
  const { data: records } = await serviceClient
    .from('maintenance_records')
    .select('done_at, km_at_service, custom_name, maintenance_items(name)')
    .eq('scooter_id', scooterId)
    .order('done_at', { ascending: false })
    .limit(5);

  const { data: reminders } = await serviceClient
    .from('maintenance_reminders')
    .select('title, severity, due_km')
    .eq('scooter_id', scooterId)
    .eq('status', 'open')
    .limit(6);

  return {
    recent: (records ?? []).map((r: Record<string, unknown>) => {
      const item = r.maintenance_items as { name?: string } | null;
      const name = item?.name ?? r.custom_name ?? 'onderhoud';
      const km = r.km_at_service ? ` op ${r.km_at_service} km` : '';
      return `${name}${km}`;
    }),
    openReminders: (reminders ?? []).map(
      (r: Record<string, unknown>) => `${r.title}${r.due_km ? ` (rond ${r.due_km} km)` : ''}`,
    ),
  };
}

export async function getTuningContext(serviceClient: { from: Function }, scooterId: string): Promise<string[]> {
  const { data, error } = await serviceClient
    .from('tuning_changes')
    .select('created_at, part, old_value, new_value, result')
    .eq('scooter_id', scooterId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return [];
  return formatTuningContext((data ?? []) as TuningRecord[]);
}

export interface TuningRecord {
  created_at?: string | null;
  part?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  result?: string | null;
}

/** Pure formatter: "part old_value → new_value, gevolg" — testbaar in jest. */
export function formatTuningContext(recs: TuningRecord[]): string[] {
  return recs.map((r) => {
    const datum = r.created_at ? `${r.created_at.slice(0, 10)}` : '';
    const verandering = r.old_value
      ? `${r.part ?? 'tuning'}: ${r.old_value} → ${r.new_value ?? '?'}`
      : `${r.part ?? 'tuning'}: ${r.new_value || 'toegepast'}`;
    const gevolg = r.result ? `, gevolg: ${r.result}` : '';
    return `${datum} ${verandering}${gevolg}`.trim();
  });
}

export function formatDiagnosisForPrompt(rows: SearchedDiagnosis[]): string {
  if (rows.length === 0) return '(geen relevante FIX50-diagnoserecords gevonden)';
  return rows
    .map((r, i) => {
      const parts = [
        `#${i + 1} [relevantie ${Number(r.score).toFixed(1)}]`,
        `Categorie: ${r.category} | Bloktype: ${r.engine_type}`,
        `Probleem: ${r.problem}`,
        r.symptoms ? `Symptomen: ${r.symptoms}` : null,
        r.causes ? `Oorzaken: ${r.causes}` : null,
        r.visual_test ? `Visuele test: ${r.visual_test}` : null,
        r.measurement_test ? `Meettest: ${r.measurement_test}` : null,
        r.road_test ? `Rijtest: ${r.road_test}` : null,
        r.solution ? `Oplossing: ${r.solution}` : null,
      ].filter(Boolean);
      return parts.join('\n');
    })
    .join('\n---\n');
}

/** Maximaal de laatste N berichten als gesprekscontext (kostenbeheersing). */
export async function getRecentMessages(
  serviceClient: { from: Function },
  sessionId: string,
  limit = 8,
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const { data } = await serviceClient
    .from('chat_messages')
    .select('role, message')
    .eq('chat_session_id', sessionId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? [])
    .reverse()
    .map((m: { role: 'user' | 'assistant'; message: string }) => ({
      role: m.role,
      content: m.message,
    }));
}
