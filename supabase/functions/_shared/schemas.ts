/**
 * Gedeelde schemas (Deno) voor Edge Functions.
 * Valideert AI-output: alleen toegestane acties met strikt getypeerde data.
 * NOOIT vrije SQL of onbeperkte velden vanuit het AI-model.
 */
import { z } from 'npm:zod@3.25.76';

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  session_id: z.string().uuid().nullish(),
  scooter_id: z.string().uuid().nullish(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Alle AI-acties die de backend kent; uitbreidbaar, maar altijd witte-lijst. */
export const aiActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('CREATE_MAINTENANCE_RECORD'),
    data: z.object({
      item_name: z.string().trim().min(1).max(80),
      km_at_service: z.number().int().min(0).max(2_000_000).nullish(),
      notes: z.string().max(500).nullish(),
    }),
  }),
  z.object({
    type: z.literal('UPDATE_KILOMETERS'),
    data: z.object({
      current_km: z.number().int().min(0).max(2_000_000),
    }),
  }),
  z.object({
    type: z.literal('ADD_TUNING_CHANGE'),
    data: z.object({
      part: z.string().trim().min(1).max(80),
      old_value: z.string().max(80).nullish(),
      new_value: z.string().max(80).nullish(),
      notes: z.string().max(500).nullish(),
    }),
  }),
  z.object({
    type: z.literal('CREATE_REMINDER'),
    data: z.object({
      title: z.string().trim().min(1).max(120),
      due_km: z.number().int().min(0).max(2_000_000).nullish(),
      due_in_days: z.number().int().min(0).max(365).nullish(),
    }),
  }),
  z.object({
    type: z.literal('OPEN_DIAGNOSIS'),
    data: z.object({
      diagnosis_id: z.string().uuid(),
    }),
  }),
  z.object({
    type: z.literal('SAVE_NOTE'),
    data: z.object({
      note: z.string().trim().min(1).max(500),
    }),
  }),
]);

export const aiResponseSchema = z.object({
  message: z.string().min(1),
  action: aiActionSchema.nullish(),
});
export type AiResponse = z.infer<typeof aiResponseSchema>;

export const pushTokenRequestSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(['ios', 'android', 'web']),
});

/** ─── AI-inzichten (fase B) ──────────────────────────────────────
 * Signaalinput: de deterministische fase-A-signalen uit de app (cijfers +
 * evidence). Het model verwoordt en prioriteert, maar bedenkt géén nieuwe
 * cijfers: alle check-limieten staan hier strikt getypeerd.
 */
export const insightSignalSchema = z.object({
  kind: z.enum(['verbruik', 'onderhoud', 'performance', 'tuning']),
  severity: z.enum(['info', 'let op', 'risico']),
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(600),
  evidence: z.string().trim().max(400),
});
export type InsightSignal = z.infer<typeof insightSignalSchema>;

export const insightsRequestSchema = z.object({
  scooter_id: z.string().uuid().nullish(),
  signals: z.array(insightSignalSchema).min(1).max(6),
});
export type InsightsRequest = z.infer<typeof insightsRequestSchema>;

/** AI-output: index verwijst naar de positie in de aangeleverde signalen. */
export const insightsResponseSchema = z.object({
  verwoording: z
    .array(
      z.object({
        index: z.number().int().min(0).max(5),
        title: z.string().trim().min(1).max(120),
        detail: z.string().trim().min(1).max(600),
      }),
    )
    .min(1)
    .max(6),
});
export type InsightsResponse = z.infer<typeof insightsResponseSchema>;

/** Gestandaardiseerde bronvermelding voor diagnose-records richting het model. */
export interface DiagnosisContext {
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
  score: number;
}
