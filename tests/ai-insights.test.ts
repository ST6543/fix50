/**
 * Tests voor fase B (AI-verwoording van de slimme signalen):
 * - applyAiVerwoording: merge-guardrails op Home (deterministische tekst blijft bron van waarheid)
 * - kopie van de zod-schema's uit supabase/functions/_shared/schemas.ts
 *   (deze testmap is pure TS zonder Deno-imports, dus jest importeert direct —
 *   zelfde aanpak als tests/ai-validation.test.ts)
 */
import { applyAiVerwoording, AI_DETAIL_MAX, type Insight } from '../src/lib/insights';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { z } = require('zod');

// Kopie van insightsRequestSchema / insightsResponseSchema (schema's in _shared/schemas.ts).
const insightSignalSchema = z.object({
  kind: z.enum(['verbruik', 'onderhoud', 'performance', 'tuning']),
  severity: z.enum(['info', 'let op', 'risico']),
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(600),
  evidence: z.string().trim().max(400),
});
const insightsRequestSchema = z.object({
  scooter_id: z.string().uuid().nullish(),
  signals: z.array(insightSignalSchema).min(1).max(6),
});
const insightsResponseSchema = z.object({
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

function makeInsight(partial: Partial<Insight> = {}): Insight {
  return {
    kind: 'verbruik',
    severity: 'let op',
    title: 'Verbruik verslechterd',
    detail: 'Je rijdt nu 1 op 21 i.p.v. 1 op 25 (16% onzuiniger, 2 beurten op rij).',
    evidence: 'laatste beurt 1 op 21 over 95 km · eerder gemiddeld 1 op 25',
    ...partial,
  };
}

describe('applyAiVerwoording (merge op Home)', () => {
  const base = [makeInsight(), makeInsight({ kind: 'onderhoud', title: 'Onderhoud te laat', detail: '2 taken zijn over het interval heen.' })];

  it('overschrijft alleen de indexen die de AI teruggeeft', () => {
    const out = applyAiVerwoording(base, [
      { index: 1, title: 'Twee taken staan stil', detail: 'Olie en bougie zijn te laat. Plan ze deze week in.' },
    ]);
    expect(out[0]).toBe(base[0]); // index 0 niet aangeraakt → zelfde object
    expect(out[1]!.title).toBe('Twee taken staan stil'); // index 1 verwoord
    expect(out[1]!.evidence).toBe(base[1]!.evidence); // evidence blijft DB-first
    expect(out[1]!.kind).toBe('onderhoud'); // metadata blijft ongewijzigd
  });

  it('negeert AI-items met een onbestaande index', () => {
    const out = applyAiVerwoording(base, [{ index: 9, title: 'Buiten bereik', detail: 'Deze tekst mag nooit zichtbaar worden.' }]);
    expect(out).toEqual(base);
  });

  it('valt terug op de vaste tekst als AI-tekst te leeg is', () => {
    const out = applyAiVerwoording(base, [
      { index: 0, title: 'x', detail: 'kort' }, // titel < 3, detail < 10 → ongeldig
      { index: 1, title: 'Wat meer woorden', detail: 'Ok, wat langer.' },
    ]);
    expect(out[0]!.title).toBe('Verbruik verslechterd');
    expect(out[1]!.title).toBe('Wat meer woorden');
  });

  it('kapt overdreven lange AI-details op het prompt-limiet af', () => {
    const lang = 'w'.repeat(500);
    const out = applyAiVerwoording(base, [{ index: 0, title: 'Legitieme titel', detail: lang }]);
    expect(out[0]!.detail.length).toBe(AI_DETAIL_MAX);
  });

  it('doet niets met null of een lege lijst', () => {
    expect(applyAiVerwoording(base, null)).toEqual(base);
    expect(applyAiVerwoording(base, [])).toEqual(base);
  });
});

describe('insights schema-validatie (Edge Function-guardrails)', () => {
  const goodSignal = {
    kind: 'verbruik',
    severity: 'let op',
    title: 'Verbruik verslechterd',
    detail: '1 op 21 i.p.v. 1 op 25.',
    evidence: 'laatste beurt 1 op 21',
  };

  it('accepteert een geldig verzoek', () => {
    const r = insightsRequestSchema.safeParse({ scooter_id: null, signals: [goodSignal] });
    expect(r.success).toBe(true);
  });

  it('weigert een onbekend signaal-kind', () => {
    const r = insightsRequestSchema.safeParse({
      scooter_id: null,
      signals: [{ ...goodSignal, kind: 'magie' }],
    });
    expect(r.success).toBe(false);
  });

  it('weigert meer dan 6 signalen (kostenbeheersing)', () => {
    const r = insightsRequestSchema.safeParse({
      scooter_id: null,
      signals: Array.from({ length: 7 }, () => goodSignal),
    });
    expect(r.success).toBe(false);
  });

  it('accepteert een valide AI-antwoord binnen de indexgrens', () => {
    const r = insightsResponseSchema.safeParse({
      verwoording: [
        { index: 0, title: 'Verbruik omhoog', detail: 'Je verbruik is 2 beurten achter elkaar slechter.' },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('weigert AI-antwoorden met een index buiten het toegestane bereik', () => {
    const r = insightsResponseSchema.safeParse({
      verwoording: [{ index: 7, title: 'Te ver', detail: 'Deze index bestaat niet in de signalen.' }],
    });
    expect(r.success).toBe(false);
  });

  it('weigert een leeg verwoording-veld', () => {
    const r = insightsResponseSchema.safeParse({ verwoording: [] });
    expect(r.success).toBe(false);
  });
});
