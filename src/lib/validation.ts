/** Validatie-schemas (Zod) voor gebruikersinvoer — client en hergebruik in tests. */
import { z } from 'zod';
import { ENGINE_FAMILIES, LIMITS } from '@/constants/branding';

export const engineFamilySchema = z.enum(ENGINE_FAMILIES);

export const scooterSchema = z.object({
  name: z.string().trim().min(1, 'Geef je scooter een naam').max(LIMITS.scooterName),
  brand: z.string().trim().max(LIMITS.brand).optional().nullable(),
  model: z.string().trim().max(LIMITS.model).optional().nullable(),
  year: z
    .number()
    .int()
    .min(LIMITS.yearMin, 'Onrealistisch bouwjaar')
    .max(LIMITS.yearMax, 'Onrealistisch bouwjaar')
    .optional()
    .nullable(),
  engine_type: engineFamilySchema.optional().nullable(),
  fuel_system: z.enum(['2T', '4T', 'Injectie']).optional().nullable(),
  license_plate: z.string().trim().max(12).optional().nullable(),
  current_km: z
    .number()
    .int('Kilometerstand moet een geheel getal zijn')
    .min(0, 'Kilometerstand mag niet negatief zijn')
    .max(LIMITS.km)
    .default(0),
  /** Gemiddeld km per week — voedt de automatische km-schatting op Home. */
  avg_km_per_week: z
    .number()
    .min(0, 'Km per week mag niet negatief zijn')
    .max(5000, 'Dat is meer dan 5000 km per week — controleer je invoer')
    .optional()
    .nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export type ScooterInput = z.infer<typeof scooterSchema>;

/** Losse validatie voor het km-per-week veld (alleen opslaan als gevuld). */
export const weeklyKmSchema = z
  .number()
  .min(0, 'Km per week mag niet negatief zijn')
  .max(5000, 'Dat is meer dan 5000 km per week — controleer je invoer');

/** Losse validatie voor het km-per-dag veld (×7 moet binnen het weekmaximum passen). */
export const dailyKmSchema = z
  .number()
  .min(0, 'Km per dag mag niet negatief zijn')
  .max(714, 'Dat is meer dan 714 km per dag — controleer je invoer');

export const kmUpdateSchema = z
  .number()
  .int('Kilometerstand moet een geheel getal zijn')
  .min(0, 'Kilometerstand mag niet negatief zijn')
  .max(LIMITS.km);

/** Losse kosten-invoer in euro's (bijv. "12,50" → 1250 cent). */
export const euroSchema = z
  .number()
  .min(0, 'Kosten mogen niet negatief zijn')
  .max(10_000, 'Dat is meer dan €10.000 — controleer je invoer');

/** Zet euro-invoer (komma of punt) om naar hele centen; null bij leeg/ongeldig. */
export function eurosToCents(input: string): number | null {
  const t = input.trim().replace(',', '.');
  if (!t || Number.isNaN(Number(t))) return null;
  return Math.round(Number(t) * 100);
}

/** Tankbeurt-invoer (kilometerstand + liters). */
export const fuelLogSchema = z.object({
  odometer_km: z
    .number()
    .int('Kilometerstand moet een geheel getal zijn')
    .min(0, 'Kilometerstand mag niet negatief zijn')
    .max(LIMITS.km),
  liters: z
    .number()
    .min(0.1, 'Vul minimaal 0,1 liter in')
    .max(100, 'Dat is meer dan 100 liter — controleer je invoer'),
  price_per_liter_cents: z.number().int().min(0).max(1000).optional().nullable(),
  total_cents: z.number().int().min(0).max(10_000_00).optional().nullable(),
});
export type FuelLogInput = z.infer<typeof fuelLogSchema>;

export const chatMessageSchema = z
  .string()
  .trim()
  .min(1, 'Typ eerst een bericht')
  .max(LIMITS.chatMessage, 'Bericht is te lang');

export const jetValueSchema = z
  .number()
  .int()
  .min(30, 'Orealistische sproeierwaarde')
  .max(500, 'Orealistische sproeierwaarde');

export const rollerWeightSchema = z.number().min(1).max(LIMITS.rollerWeight);

/** Fysieke plausibiliteit van performance-resultaten (bescherming tegen GPS-ruis). */
export const performanceRunSchema = z.object({
  duration_s: z.number().positive(),
  distance_m: z.number().min(0).max(100_000),
  max_speed_kmh: z.number().min(0).max(200, 'Snelheid fysiek onplausibel (>200 km/h)'),
  avg_speed_kmh: z.number().min(0).max(200),
  t0_50_s: z.number().positive().max(300).nullable().optional(),
  t0_80_s: z.number().positive().max(600).nullable().optional(),
  t50_80_s: z.number().positive().max(600).nullable().optional(),
});
export type PerformanceRunInput = z.infer<typeof performanceRunSchema>;

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Ongeldige invoer';
}
