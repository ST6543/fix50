/**
 * AI-adapter voor Edge Functions. De API-key komt uitsluitend uit Deno.env
 * (supabase secrets set AI_API_KEY=...) en verlaat de server nooit.
 * OpenAI-compatibel zodat provider later wisselbaar is via AI_API_BASE/AI_MODEL.
 */
export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiResult {
  ok: boolean;
  content: string | null;
  error?: string;
}

export async function callAi(
  turns: ChatTurn[],
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<AiResult> {
  const apiKey = Deno.env.get('AI_API_KEY');
  if (!apiKey) {
    return { ok: false, content: null, error: 'AI_API_KEY ontbreekt (server secret)' };
  }
  const base = Deno.env.get('AI_API_BASE') ?? 'https://api.openai.com/v1';
  const model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: turns,
        temperature: 0.3,
        // 1200 i.p.v. 700: reasoning-modellen (bijv. gpt-oss-120b) verbruiken redeneertokens binnen max_tokens.
        max_tokens: opts.maxTokens ?? 1200,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Log zonder secrets of gebruikersdata.
      console.error(`AI provider error: status=${res.status}`);
      return { ok: false, content: null, error: `provider_status_${res.status}` };
    }
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      return { ok: false, content: null, error: 'leeg_antwoord' };
    }
    return { ok: true, content };
  } catch (err) {
    const msg = err instanceof Error ? err.name : 'onbekend';
    console.error(`AI call mislukt: ${msg}`);
    return { ok: false, content: null, error: msg === 'AbortError' ? 'timeout' : 'netwerk' };
  } finally {
    clearTimeout(timer);
  }
}
