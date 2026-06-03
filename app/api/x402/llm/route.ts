import { processPayable, LLM_PATH, LLM_ROUTE } from "@/lib/x402-server";
import { chat } from "@/lib/inference";

export const dynamic = "force-dynamic";

// /api/x402/llm — a REAL, payable x402 AI chat endpoint.
//   GET  -> unpaid: 402 with payment requirements.
//   POST -> pay USDC on Base, then get an LLM completion via the model gateway.
//           Body: { prompt, model?, system? }.

function field(body: unknown, url: URL, keys: string[]): string {
  if (body && typeof body === "object") {
    for (const k of keys) {
      const v = (body as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  for (const k of keys) {
    const v = url.searchParams.get(k);
    if (v) return v;
  }
  return "";
}

async function buildPayload(body: unknown, url: URL) {
  const prompt = field(body, url, ["prompt", "text", "input"]) || "Say hello in 5 words.";
  const model = field(body, url, ["model"]) || undefined;
  const system = field(body, url, ["system"]) || undefined;
  const r = await chat({ user: prompt, system, model });
  return {
    service: "agent402-llm",
    model: r.model,
    prompt,
    completion: r.content,
    usage: r.usage,
    ...(r.ok ? {} : { error: r.error }),
  };
}

export async function GET(req: Request) {
  return processPayable(req, {}, { path: LLM_PATH, routePattern: LLM_ROUTE, buildPayload });
}

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return processPayable(req, body, { path: LLM_PATH, routePattern: LLM_ROUTE, buildPayload });
}
