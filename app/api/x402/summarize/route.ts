import { processPayable, SUMMARIZE_PATH, SUMMARIZE_ROUTE } from "@/lib/x402-server";
import { chat } from "@/lib/inference";

export const dynamic = "force-dynamic";

// /api/x402/summarize — pay USDC on Base, get a tight summary of any text.
//   Body: { text, model? }.

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
  const text = field(body, url, ["text", "prompt", "input"]) || "Tollbooth turns any text into a crisp summary.";
  const model = field(body, url, ["model"]) || undefined;
  const r = await chat({
    system: "You are a precise summarizer. Return a concise summary (3-5 sentences or tight bullets). No preamble.",
    user: text,
    model,
    temperature: 0.3,
  });
  return { service: "agent402-summarize", model: r.model, summary: r.content, ...(r.ok ? {} : { error: r.error }) };
}

export async function GET(req: Request) {
  return processPayable(req, {}, { path: SUMMARIZE_PATH, routePattern: SUMMARIZE_ROUTE, buildPayload });
}

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return processPayable(req, body, { path: SUMMARIZE_PATH, routePattern: SUMMARIZE_ROUTE, buildPayload });
}
