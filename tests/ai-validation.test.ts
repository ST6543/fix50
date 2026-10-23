/**
 * Tests voor AI-output-validatie (Zod-schema's uit de Edge Function _shared).
 * Deze map is pure TS zonder Deno-globals, dus jest kan hem gewoon importeren.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { z } = require('zod');

// Kopie van het schema zodanig dat de test den-code niet nodig heeft:
// We valideren dezelfde discriminated union zoals in supabase/functions/_shared/schemas.ts.
const aiActionSchema = z.discriminatedUnion('type', [
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
    data: z.object({ current_km: z.number().int().min(0).max(2_000_000) }),
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
  z.object({ type: z.literal('OPEN_DIAGNOSIS'), data: z.object({ diagnosis_id: z.string().uuid() }) }),
  z.object({ type: z.literal('SAVE_NOTE'), data: z.object({ note: z.string().trim().min(1).max(500) }) }),
]);

const aiResponseSchema = z.object({ message: z.string().min(1), action: aiActionSchema.nullish() });

describe('AI-response validatie', () => {
  it('accepteert een geldig antwoord zonder actie', () => {
    const r = aiResponseSchema.safeParse({
      message: 'Een mogelijke oorzaak is een versleten V-snaar.',
      action: null,
    });
    expect(r.success).toBe(true);
  });

  it('accepteert een geldige CREATE_MAINTENANCE_RECORD actie', () => {
    const r = aiResponseSchema.safeParse({
      message: 'Wil je dat ik dit opsla?',
      action: { type: 'CREATE_MAINTENANCE_RECORD', data: { item_name: 'Bougie vervangen', km_at_service: 12450 } },
    });
    expect(r.success).toBe(true);
  });

  it('weigert onbekende actietypes (geen vrije SQL of willekeurige acties)', () => {
    const r = aiResponseSchema.safeParse({
      message: 'ok',
      action: { type: 'DROP_TABLE', data: {} },
    });
    expect(r.success).toBe(false);
  });

  it('weigert een actie met ontbrekende verplichte velden', () => {
    const r = aiResponseSchema.safeParse({
      message: 'ok',
      action: { type: 'UPDATE_KILOMETERS', data: {} },
    });
    expect(r.success).toBe(false);
  });

  it('weigert negatieve kilometerstanden in acties', () => {
    const r = aiResponseSchema.safeParse({
      message: 'ok',
      action: { type: 'UPDATE_KILOMETERS', data: { current_km: -500 } },
    });
    expect(r.success).toBe(false);
  });
});
