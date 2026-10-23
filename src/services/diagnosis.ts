/** Diagnose-service — server-side search, laad nooit de hele database naar de telefoon. */
import { query } from './api';
import { supabase } from '@/lib/supabase';
import type { DiagnosisEntry } from '@/types';

export interface DiagnosisSearchResult extends DiagnosisEntry {
  score: number;
}

export async function searchDiagnosis(
  text: string,
  engineType: string | null,
  limit = 8,
): Promise<DiagnosisSearchResult[]> {
  return query<DiagnosisSearchResult[]>(() =>
    supabase.rpc('search_diagnosis', {
      p_query: text,
      p_engine_type: engineType,
      p_limit: limit,
    }),
  );
}

/** Fallback voor offline/slecht netwerk: lokale search op eerder gecachete entries. */
export async function searchLocalCache(
  cached: DiagnosisEntry[],
  text: string,
  engineType: string | null,
  limit = 6,
): Promise<DiagnosisSearchResult[]> {
  const q = text.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  const scored = cached
    .filter((e) => !engineType || e.engine_type === engineType || e.engine_type === 'Universeel')
    .map((e) => {
      let score = 0;
      for (const w of words) {
        if (e.problem.toLowerCase().includes(w)) score += 4;
        if (e.symptoms.toLowerCase().includes(w)) score += 3;
        if (e.causes.toLowerCase().includes(w)) score += 2;
        if (e.search_text.includes(w)) score += 1;
      }
      if (engineType && e.engine_type === engineType) score += 1;
      return { ...e, score };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}
