/**
 * ai-probe — tijdelijke debug-functie: doet exact dezelfde vision-call als
 * scan-invoice en geeft terug welke status/fout de provider geeft,
 * plus welke env-variabelen zichtbaar zijn (namen + goed/fout).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: ud } = await admin.auth.getUser(token);
  if (!ud.user) return new Response('401', { status: 401 });

  let body: { image_base64?: string; mime?: string } = {};
  try { body = await req.json(); } catch { /* leeg is ok */ }
  const imageBase64 = body.image_base64 ?? '';
  const mime = body.mime ?? 'image/jpeg';

  const report: Record<string, unknown> = {
    env: {
      AI_API_KEY: Deno.env.get('AI_API_KEY') ? 'gezet(len=' + (Deno.env.get('AI_API_KEY') ?? '').length + ')' : 'LEEG',
      AI_API_BASE: Deno.env.get('AI_API_BASE') ?? null,
      AI_MODEL: Deno.env.get('AI_MODEL') ?? null,
      AI_VISION_MODEL: Deno.env.get('AI_VISION_MODEL') ?? null,
    },
    img_len: imageBase64.length,
  };

  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) return new Response(JSON.stringify(report, null, 1), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  const base = (Deno.env.get('AI_API_BASE') ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = Deno.env.get('AI_VISION_MODEL') ?? Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';
  report.call = { base, model, hasImage: imageBase64.length > 0 };

  // beschikbare modellen opvragen (voor modelkeuze debug)
  try {
    const mres = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    report.models = mres.status === 200
      ? ((await mres.json())?.data ?? []).map((m: { id: string }) => m.id).filter((id: string) => /vision|scout|maverick|llama-4|pixtral|llava|vl|vlm|4o|gemini|qwen.*vl/i.test(id)).slice(0, 30)
      : `status_${mres.status}`;
  } catch (e) { report.models = 'fout: ' + (e instanceof Error ? e.message : String(e)); }

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Antwoord in minified JSON: {"descr":"..."}' },
          { role: 'user', content: [
            { type: 'text', text: 'Wat zie je? Kort.' },
            ...(imageBase64.length > 0 ? [{ type: 'image_url', image_url: { url: `data:${mime};base64,${imageBase64}` } }] : []),
          ] },
        ],
      }),
    });
    report.provider = { status: res.status };
    const txt = await res.text();
    report.provider.body = txt.slice(0, 800);
  } catch (err) {
    report.provider = { exception: err instanceof Error ? err.message : String(err) };
  }
  return new Response(JSON.stringify(report, null, 1), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
});
