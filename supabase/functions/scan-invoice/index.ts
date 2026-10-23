/**
 * scan-invoice — Edge Function die een foto van een factuur/werkplaatsbon
 * analyseert en gestructureerde onderhoudsinfo teruggeeft.
 *
 * Flow: auth → scooter-eigenaarscheck → base64-afbeelding → vision-AI →
 * Zod-validatie → JSON-antwoord met voorstel dat de app toont voor controle.
 *
 * Request:  { image_base64: string, mime?: 'image/jpeg'|'image/png'|'image/webp', scooter_id?: uuid }
 * Response: { found: boolean, confidence: 'hoog'|'gemiddeld'|'laag', suggestion: {...}|null,
 *             missing_fields: string[], raw_text?: string, warning?: string }
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

// Inline CORS (zelfde als _shared/cors.ts — de deployer bundelt per functie).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function errorJson(message: string, status = 400, code?: string): Response {
  return json({ error: message, code: code ?? null }, status);
}
function preflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}

/** Gestructureerd voorstel zoals de app het toont. */
const suggestionSchema = z.object({
  item_name: z.string().min(1).max(120).nullable(),
  custom_name: z.string().max(120).nullable(),
  km_at_service: z.number().int().min(0).max(2_000_000).nullable(),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  cost_cents: z.number().int().min(0).max(100_000_00).nullable(),
  parts: z.string().max(500).nullable(),
  notes: z.string().max(2000).nullable(),
  workshop_name: z.string().max(120).nullable(),
});

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB raw
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

  // 2) Input
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
  // base64-lengte ≈ 4/3 × bytes
  if (imageBase64.length > (MAX_IMAGE_BYTES / 3) * 4) return errorJson('Afbeelding is te groot (max 8 MB)', 413, 'image_too_large');
  if (!ALLOWED_MIME.has(mime)) return errorJson('Alleen JPEG, PNG of WebP toegestaan', 415, 'bad_mime');

  // 3) Scooter-eigenaarscheck (alleen ter verificatie dat de scooter van de gebruiker is)
  if (typeof body.scooter_id === 'string' && body.scooter_id.length > 0) {
    const { data: scooter } = await admin
      .from('scooters')
      .select('id')
      .eq('id', body.scooter_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!scooter) return errorJson('Scooter niet gevonden', 403, 'forbidden');
  }

  // 4) Vision-AI
  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) {
    return errorJson('Factuurherkenning is niet geconfigureerd op de server.', 503, 'ai_not_configured');
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
        max_tokens: 1200,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Je leest Nederlandse facturen/werkplaatsbonnen van scooter- of brommerzaken uit. ' +
              'Antwoord ALTIJD in minified JSON volgens dit schema (null voor ontbrekende velden): ' +
              '{"is_invoice": boolean, "confidence": "hoog"|"gemiddeld"|"laag", ' +
              '"item_name": string|null, "custom_name": string|null, "km_at_service": number|null, ' +
              '"service_date": "jjjj-mm-dd"|null, "cost_cents": number|null (centen!), ' +
              '"parts": string|null (onderdelen op de factuur, kommagetrenkt), ' +
              '"notes": string|null (korte samenvatting van de werkzaamheden), ' +
              '"workshop_name": string|null, "raw_text": string|null (belangrijkste tekst op de factuur), ' +
              '"missing_fields": string[] (welke belangrijke velden niet op de factuur staan)}. ' +
              'Regels: item_name = kort onderhoudstype ("Oliebeurt", "APK", "Remservice") OF null; ' +
              'custom_name = specifieke omschrijving als item_name te specifiek is; ' +
              'kosten = het TOTAALBEDRAG incl. btw, in CENTEN (€45,20 → 4520); ' +
              'datum = factuurdatum of datum werkzaamheden; km = kilometerstand die op de factuur staat. ' +
              'Als het duidelijk géén factuur/bon is: is_invoice=false, confidence="laag", alles null.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Lees deze factuur/werkplaatsbon uit volgens het schema.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mime};base64,${imageBase64}` },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`scan-invoice: provider status ${res.status}`);
      return errorJson('De factuurherkenning is tijdelijk niet beschikbaar.', 502, 'ai_error');
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
        ? 'Het uitlezen duurde te lang — probeer een scherpere foto.'
        : 'Factuur uitlezen mislukt. Probeer het opnieuw.',
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
    return errorJson('Kon het antwoord van de herkenning niet verwerken.', 502, 'ai_bad_json');
  }

  const outer = parsed as Record<string, unknown>;
  if (outer.is_invoice === false) {
    return json({
      found: false,
      confidence: 'laag',
      suggestion: null,
      missing_fields: [],
      warning:
        'Dit lijkt geen factuur of werkplaatsbon. Maak een scherpe foto van de hele factuur en probeer het opnieuw.',
    });
  }

  const validated = suggestionSchema.safeParse({
    item_name: outer.item_name ?? null,
    custom_name: outer.custom_name ?? null,
    km_at_service: outer.km_at_service ?? null,
    service_date: outer.service_date ?? null,
    cost_cents: outer.cost_cents ?? null,
    parts: outer.parts ?? null,
    notes: outer.notes ?? null,
    workshop_name: outer.workshop_name ?? null,
  });
  if (!validated.success) {
    return errorJson('De herkenning gaf ongeldige gegevens terug.', 502, 'ai_bad_output');
  }

  const missing = Array.isArray(outer.missing_fields)
    ? (outer.missing_fields as unknown[]).filter((f): f is string => typeof f === 'string').slice(0, 8)
    : [];

  return json({
    found: true,
    confidence: outer.confidence === 'hoog' ? 'hoog' : outer.confidence === 'gemiddeld' ? 'gemiddeld' : 'laag',
    suggestion: validated.data,
    missing_fields: missing,
    raw_text: typeof outer.raw_text === 'string' ? outer.raw_text.slice(0, 2000) : null,
  });
});
