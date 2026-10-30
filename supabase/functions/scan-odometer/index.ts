/**
 * scan-odometer — fase D van docs/AI-SLIMMER-PLAN.md.
 *
 * Een foto van de kilometerstand (teller van een brommer/scooter) wordt door
 * het vision-model uitgelezen en verdergegeven als voorstel — het formulier
 * vult de km zelf in, de gebruiker houdt altijd de controle ("check je cijfers").
 *
 * Flow: auth → invoervalidatie → scooter-eigenaarscheck → vision-AI (AI_VISION_MODEL)
 * → Zod-validatie → plausibiliteits-check → JSON-antwoord. Er wordt niets
 * wegschreven; de app gebruikt het resultaat alleen als prefill.
 *
 * Request:  { image_base64: string, mime?: 'image/jpeg'|'image/png'|'image/webp', scooter_id?: uuid, current_km?: int }
 * Response: { found: boolean, km: number|null, confidence: 'hoog'|'gemiddeld'|'laag',
 *             raw_text?: string|null, warning?: string }
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

// Inline CORS (zelfde als scan-invoice — de deployer bundelt per functie).
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

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB raw
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const readResultSchema = z.object({
  found: z.boolean(),
  km: z.number().int().min(0).max(2_000_000).nullable().optional(),
  confidence: z.enum(['hoog', 'gemiddeld', 'laag']).optional(),
  raw_text: z.string().max(400).optional().nullable(),
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return errorJson('Alleen POST toegestaan', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return errorJson('Niet ingelogd', 401, 'unauthenticated');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return errorJson('Ongeldige sessie', 401, 'unauthenticated');
  const userId = userData.user.id;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return errorJson('Ongeldige JSON', 400, 'bad_json');
  }
  const body = payload as Record<string, unknown>;
  const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64.replace(/\s/g, '') : '';
  const mime = typeof body.mime === 'string' ? body.mime : 'image/jpeg';
  const currentKm =
    typeof body.current_km === 'number' && Number.isFinite(body.current_km) && body.current_km >= 0
      ? Math.trunc(body.current_km)
      : null;

  if (imageBase64.length < 500) return errorJson('Afbeelding ontbreekt of is te klein', 400, 'bad_image');
  if (imageBase64.length > (MAX_IMAGE_BYTES / 3) * 4) return errorJson('Afbeelding is te groot (max 8 MB)', 413, 'image_too_large');
  if (!ALLOWED_MIME.has(mime)) return errorJson('Alleen JPEG, PNG of WebP toegestaan', 415, 'bad_mime');

  // Eigentumsvcheck: de scooter moet van degene die het verzoek doet zijn.
  if (typeof body.scooter_id === 'string' && body.scooter_id.length > 0) {
    const { data: scooter } = await admin
      .from('scooters')
      .select('id')
      .eq('id', body.scooter_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!scooter) return errorJson('Scooter niet gevonden', 403, 'forbidden');
  }

  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) {
    return errorJson('Tellerherkenning is niet geconfigureerd op de server.', 503, 'ai_not_configured');
  }
  const base = Deno.env.get('AI_API_BASE') ?? 'https://api.openai.com/v1';
  const model = Deno.env.get('AI_VISION_MODEL') ?? Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let aiContent: string | null = null;
  let aiError: string | null = null;
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Je leest de kilometerstand af van een foto van een brommer-/scooterteller of een kilometersregel in een logboek. ' +
              'Antwoord ALTIJD in minified JSON: {"found": boolean, "km": number|null, "confidence": "hoog"|"gemiddeld"|"laag", "raw_text": string|null}. ' +
              'Regels: km is het getal dat de teller/r-rel toont — niet een reisteller, statistiek-scherm of snelheid. ' +
              'found=false als de foto geen leesbare kilometerstand toont of niet om een teller gaat (persoon, gezicht, willekeurig beeld). ' +
              'Twijfel je tussen cijfers (bv. over de laatste digit): confidence "laag"; found=true alleen als je redelijk zeker bent. ' +
              'raw_text = korte uitlezing, bv. "17 542". Verzin nooit een afgeronde getal.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Lees deze foto van de kilometerstand uit volgens het schema.',
              },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`scan-odometer: provider status ${res.status}`);
      return errorJson('De tellerherkenning is tijdelijk niet beschikbaar.', 502, 'ai_error');
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
        ? 'Het uitlezen duurde te lang — maak een scherpere foto.'
        : 'Teller uitlezen mislukt. Probeer het opnieuw.',
      502,
      `ai_${aiError ?? 'fout'}`,
    );
  }

  let parsed: unknown;
  try {
    const jsonText = aiContent.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(jsonText);
  } catch {
    return errorJson('Kon het antwoord van de herkenning niet verwerken.', 502, 'ai_bad_json');
  }

  const valid = readResultSchema.safeParse(parsed);
  if (!valid.success) {
    return errorJson('De herkenning gaf ongeldige gegevens terug.', 502, 'ai_bad_output');
  }
  const out = valid.data;

  // Plausibiliteit: veel te ver onder de bekende km = waarschijnlijk een
  // andere brommer of een oudere foto. De app toont dit als waarschuwing
  // maar vult de tekst alsnog niet automatisch: de check is nuttig.
  let warning: string | null = null;
  if (out.found && out.km !== null && out.km !== undefined && currentKm !== null && currentKm > out.km + 100) {
    warning =
      `De foto leest ${out.km} km af — dat is lager dan de laatst bekende stand (${currentKm} km). ` +
      'Waarschijnlijk is dit een oudere foto of een andere brommer; controleer het goed.';
  }

  const km =
    out.found && out.km !== null && out.km !== undefined
      ? { km: out.km, confidence: out.confidence ?? 'gemiddeld' }
      : null;

  if (!km) {
    return json({
      found: false,
      km: null,
      confidence: 'laag',
      raw_text: out.raw_text ?? null,
      warning:
        'Waarschijnlijk geen leesbare kilometerstand gevonden. Zorg dat de hele teller scherp in beeld is (rechtshoekig, geen reflectie) en probeer opnieuw.',
    });
  }

  return json({
    found: true,
    km: km.km,
    confidence: km.confidence,
    raw_text: out.raw_text ?? null,
    warning: warning ?? null,
  });
});
