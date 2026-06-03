import { processPayable, TRANSLATE_PATH, TRANSLATE_ROUTE } from "@/lib/x402-server";
import { chat } from "@/lib/inference";

export const dynamic = "force-dynamic";

// /api/x402/translate — pay USDC on Base, translate text into any language.
//   Body: { text, to?, model? }.  Defaults to English.

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
  const text = field(body, url, ["text", "prompt", "input"]) || "Hola, ¿cómo estás?";
  const to = field(body, url, ["to", "target", "lang"]) || "English";
  const model = field(body, url, ["model"]) || undefined;
  const r = await chat({
    system: `You are a translation engine. Translate the user's text into ${to}. Return ONLY the translation, no notes.`,
    user: text,
    model,
    temperature: 0.2,
  });
  return { service: "agent402-translate", model: r.model, to, translation: r.content, ...(r.ok ? {} : { error: r.error }) };
}

export async function GET(req: Request) {
  return processPayable(req, {}, { path: TRANSLATE_PATH, routePattern: TRANSLATE_ROUTE, buildPayload });
}

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return processPayable(req, body, { path: TRANSLATE_PATH, routePattern: TRANSLATE_ROUTE, buildPayload });
}
