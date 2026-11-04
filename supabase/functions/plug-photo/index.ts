/**
 * plug-photo — Edge Function die een foto van een uitgedraaide bougie
 * analyseert volgens de NGK-kennis uit de FIX50-kennisbank (docs/AFSTEL-KENNISBANK.md sectie 7).
 *
 * Flow: auth → scooter-eigenaarscheck → base64-afbeelding → vision-AI →
 * Zod-validatie → JSON-advies (richtlijn, geen zekerheid).
 *
 * Request:  { image_base64: string, mime?: 'image/jpeg'|'image/png'|'image/webp', scooter_id?: uuid }
 * Response: { found, confidence, condition, code_detected, heat_estimate,
 *             jet_direction, plug_grade_direction, explanation, warning? }
 *
 * Belangrijke grens: de kleur-diagnose is een RICHTLIJN. De prompt laat het
 * model alleen het uiterlijk beschrijven; welke maat-aanpassing volgt uit
 * de vaste mapping hieronder (sproeier/hittegraad), niet uit het model zelf.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { PLUG_CONDITIONS, PLUG_CONDITION_KEYS, type PlugConditionKey } from '../_shared/plugConditions.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function errorJson(message: string, status = 400, code?: string): Response {
  return json({ error: message, code: code ?? null }, status);
}
function preflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}

const resultSchema = z.object({
  is_plug: z.boolean(),
  confidence: z.enum(['hoog', 'gemiddeld', 'laag']),
  condition: z.enum(
    PLUG_CONDITION_KEYS as [PlugConditionKey, ...PlugConditionKey[]],
  ),
  code_detected: z.string().max(16).nullable(),
  heat_estimate: z.number().int().min(6).max(12).nullable(),
  description: z.string().max(500).nullable(),
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return errorJson('Alleen POST toegestaan', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return errorJson('Niet ingelogd', 401, 'unauthenticated');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1) Authenticatie
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return errorJson('Ongeldige sessie', 401, 'unauthenticated');
  const userId = userData.user.id;

  // 2) Input validatie
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return errorJson('Ongeldige JSON', 400, 'bad_json');
  }
  const body = payload as { image_base64?: unknown; mime?: unknown; scooter_id?: unknown };
  const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64.replace(/\s/g, '') : '';
  const mime = typeof body.mime === 'string' ? body.mime : 'image/jpeg';
  if (imageBase64.length < 500) return errorJson('Afbeelding ontbreekt of is te klein', 400, 'bad_image');
  if (imageBase64.length > (MAX_IMAGE_BYTES / 3) * 4) return errorJson('Afbeelding is te groot (max 8 MB)', 413, 'image_too_large');
  if (!ALLOWED_MIME.has(mime)) return errorJson('Alleen JPEG, PNG of WebP toegestaan', 415, 'bad_mime');

  // 3) Scooter-eigenaarscheck
  if (typeof body.scooter_id === 'string' && body.scooter_id.length > 0) {
    const { data: scooter } = await admin
      .from('scooters')
      .select('id')
      .eq('id', body.scooter_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!scooter) return errorJson('Scooter niet gevonden', 403, 'forbidden');
  }

  // 4) Vision-AI — beschrijft ALLEEN het uiterlijk; advies komt uit de vaste mapping.
  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) {
    return errorJson('Bougie-analyse is niet geconfigureerd op de server.', 503, 'ai_not_configured');
  }
  const base = Deno.env.get('AI_API_BASE') ?? 'https://api.openai.com/v1';
  const model = Deno.env.get('AI_VISION_MODEL') ?? Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let aiContent: string | null = null;
  let aiError: string | null = null;
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Je beoordeelt een foto van een uitgedraaide 2-takt bougie (brommer/scooter 50cc). ' +
              'Antwoord ALTIJD in minified JSON volgens dit schema: ' +
              '{"is_plug": boolean, "confidence": "hoog"|"gemiddeld"|"laag", ' +
              '"condition": "koffiebruin-gezond"|"lichtgrijs-as"|"te-rijk"|"te-veel-olie"|"te-arm-te-heet"|"oververhitting"|"onduidelijk", ' +
              '"code_detected": string|null (de wentelcode zichtbaar op de bougie, bv "BR8ES"), ' +
              '"heat_estimate": number|null (hittegraad zichtbaar in de code, bv 8), ' +
              '"description": string|null (korte waarneming: kleur, droog/nat, metaalglans, blaasjes)}. ' +
              'Regels: baseer condition ALLEEN op de isolatorneus (kleur + droog/nat + blaasjes/gebliste/gesmolten lijn); ' +
              'is de foto wazig of niet leesbaar: dan confidence "laag" EN condition "onduidelijk". ' +
              'als het helemaal geen bougie is: is_plug=false, confidence="laag", condition="onduidelijk", de rest null. ' +
              'NOOIT zelf een afstel-advies geven (sproeier of hittegraad); je beschrijft alleen wat je ziet.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Beoordeel deze bougie-foto volgens het schema. Alleen de ISOLATORNEUS (middelste keramische neus rond de elektrode) bepaalt de condition.',
              },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`plug-photo: provider status ${res.status}`);
      // Bijv. Groq verwijderde de vision-modellen (llama-4) — configuratie nodig:
      // zet AI_API_BASE/AI_API_KEY op een provider mét vision en AI_VISION_MODEL op
      // een bestaand vision-model. Tot die tijd keert de functie netjes 502 terug.
      const visionMissing = res.status === 404;
      return errorJson(
        visionMissing
          ? 'Bougie-foto-analyse is niet ingesteld bij de provider (vision-model ontbreekt). Run de andere functies in de app; de foto-analyse volgt zodra een vision-model is ingesteld.'
          : 'De bougie-analyse is tijdelijk niet beschikbaar. Probeer het later opnieuw.',
        502,
        visionMissing ? 'vision_model_missing' : 'ai_error',
      );
    }
    const data = await res.json();
    aiContent = data?.choices?.[0]?.message?.content ?? null;
    if (!aiContent) aiError = 'leeg_antwoord';
  } catch (err) {
    aiError = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'netwerk';
  } finally {
    clearTimeout(timer);
  }

  if (!aiContent) {
    return errorJson(
      aiError === 'timeout'
        ? 'De analyse duurde te lang — probeer een scherpere foto van de neus.'
        : 'Bougie-analyse mislukt. Probeer het opnieuw.',
      502,
      `ai_${aiError ?? 'fout'}`,
    );
  }

  // 5) Output valideren
  let parsed: unknown;
  try {
    const jsonText = aiContent.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(jsonText);
  } catch {
    return errorJson('Kon het antwoord van de analyse niet verwerken.', 502, 'ai_bad_json');
  }
  const parsedResult = resultSchema.safeParse(parsed);
  if (!parsedResult.success) {
    return errorJson('Onverwacht antwoord van de analyse.', 502, 'ai_bad_schema');
  }
  const r = parsedResult.data;

  if (!r.is_plug || r.condition === 'onduidelijk') {
    return json({
      found: false,
      confidence: r.confidence,
      condition: null,
      code_detected: r.code_detected,
      heat_estimate: r.heat_estimate,
      explanation: null,
      jet_direction: null,
      plug_grade_direction: null,
      warning:
        r.is_plug
          ? 'De bougie is zichtbaar, maar de neus is niet voldoende te beoordelen. Tip: nieuwe bougie, 30-60 s rijden onder belasting, contact af terwijl je nog rijd, afkoelen, en dan fotograferen met daglicht.'
          : 'Dit lijkt geen bougie. Fotografeer de uitgedraaide bougie van dichtbij met daglicht.',
    });
  }

  const meta = PLUG_CONDITIONS[r.condition];
  return json({
    found: true,
    confidence: r.confidence,
    condition: r.condition,
    condition_label: meta.label,
    code_detected: r.code_detected,
    heat_estimate: r.heat_estimate,
    jet_direction: meta.jet_direction,
    plug_grade_direction: meta.plug_grade_direction,
    explanation: meta.explanation,
    description: r.description,
  });
});
