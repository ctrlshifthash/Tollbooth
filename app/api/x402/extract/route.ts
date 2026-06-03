import { processPayable, EXTRACT_PATH, EXTRACT_ROUTE } from "@/lib/x402-server";
import { chat } from "@/lib/inference";

export const dynamic = "force-dynamic";

// /api/x402/extract — pay USDC on Base, turn unstructured text into JSON.
//   Body: { text, instructions?, model? }.

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

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // strip code fences if present
    const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

async function buildPayload(body: unknown, url: URL) {
  const text = field(body, url, ["text", "prompt", "input"]) || "Jane Doe, jane@acme.io, +1 415 555 0100, San Francisco.";
  const instructions = field(body, url, ["instructions", "fields"]) || "Extract every useful entity into clean JSON.";
  const model = field(body, url, ["model"]) || undefined;
  const r = await chat({
    system: `You are a data-extraction engine. ${instructions} Respond with ONLY minified valid JSON, no prose, no code fences.`,
    user: text,
    model,
    temperature: 0,
  });
  const parsed = tryParse(r.content);
  return {
    service: "agent402-extract",
    model: r.model,
    data: parsed ?? null,
    raw: parsed ? undefined : r.content,
    ...(r.ok ? {} : { error: r.error }),
  };
}

export async function GET(req: Request) {
  return processPayable(req, {}, { path: EXTRACT_PATH, routePattern: EXTRACT_ROUTE, buildPayload });
}

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return processPayable(req, body, { path: EXTRACT_PATH, routePattern: EXTRACT_ROUTE, buildPayload });
}
