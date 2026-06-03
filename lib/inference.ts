import "server-only";

// ---------------------------------------------------------------------------
// AI model gateway client.
//
// Powers the in-app x402 AI services (chat, summarize, translate, extract).
// The user pays in USDC on Base via x402; once settled, the route calls the
// model gateway here to actually fulfil the task. Key is server-side only.
// ---------------------------------------------------------------------------

export const DEFAULT_MODEL = "google/gemini-2.5-flash";

// Curated frontier fallback models — every slug was live-tested against this
// account and confirmed to return completions. The UI loads the full live
// catalog dynamically; this list is only the fallback if that fetch fails.
export const MODELS: { id: string; label: string }[] = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (fast, cheap)" },
  { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8 (frontier)" },
  { id: "anthropic/claude-opus-4.8-fast", label: "Claude Opus 4.8 (fast)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "x-ai/grok-4.20", label: "Grok 4.20" },
  { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
];

const GATEWAY_URL = "https://openrouter.ai/api/v1";

export function hasModelKey(): boolean {
  return Boolean(process.env.AI_GATEWAY_KEY?.trim());
}

export function getModelKeyError(): string | null {
  return hasModelKey() ? null : "AI services are not configured.";
}

// Accept any well-formed model slug ("provider/model[:variant]"), not just the
// curated fallback list — the UI loads the full live catalog (225+ models).
function sanitizeModel(model: string | undefined): string {
  const m = (model ?? "").trim();
  return /^[\w.-]+\/[\w.:-]+$/.test(m) ? m : DEFAULT_MODEL;
}

export interface ChatResult {
  ok: boolean;
  model: string;
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: string;
}

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

// Multi-turn completion — used by the Hermes orchestrator loop.
export async function chatMessages(opts: {
  messages: ChatMsg[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatResult> {
  const key = process.env.AI_GATEWAY_KEY?.trim();
  const model = sanitizeModel(opts.model);
  if (!key) return { ok: false, model, content: "", error: "AI gateway key not set" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Tollbooth",
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.5,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: ChatResult["usage"];
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, model, content: "", error: data.error?.message ?? `AI gateway HTTP ${res.status}` };
    return { ok: true, model, content: data.choices?.[0]?.message?.content ?? "", usage: data.usage };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, model, content: "", error: e instanceof Error ? e.message : "AI request failed" };
  }
}

// Single-turn chat completion. Returns text content (or an error string).
export async function chat(opts: {
  system?: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatResult> {
  const key = process.env.AI_GATEWAY_KEY?.trim();
  const model = sanitizeModel(opts.model);
  if (!key) return { ok: false, model, content: "", error: "AI gateway key not set" };

  const messages: { role: "system" | "user"; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.user });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Tollbooth",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.7,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: ChatResult["usage"];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, model, content: "", error: data.error?.message ?? `AI gateway HTTP ${res.status}` };
    }
    const content = data.choices?.[0]?.message?.content ?? "";
    return { ok: true, model, content, usage: data.usage };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, model, content: "", error: e instanceof Error ? e.message : "AI request failed" };
  }
}
