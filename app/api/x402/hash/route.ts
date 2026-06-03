import { createHash } from "node:crypto";
import { keccak256, toHex } from "viem";
import { processPayable, HASH_PATH, HASH_ROUTE } from "@/lib/x402-server";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /api/x402/hash — a REAL, payable x402 endpoint hosted by Tollbooth.
//
//   GET  -> unpaid: 402 with live x402 payment requirements.
//   POST -> pay in USDC on Base, get SHA-256 + Keccak-256 digests of your input.
//           Input: { text: string } body, or ?text= query. Defaults to "".
//
// Settlement runs through the same CDP facilitator as /api/x402/echo.
// ---------------------------------------------------------------------------

function inputText(body: unknown, url: URL): string {
  if (body && typeof body === "object" && "text" in body) {
    const t = (body as Record<string, unknown>).text;
    if (typeof t === "string") return t;
  }
  return url.searchParams.get("text") ?? "";
}

function buildPayload(body: unknown, url: URL) {
  const text = inputText(body, url);
  return {
    service: "agent402-hash",
    input: text,
    sha256: createHash("sha256").update(text).digest("hex"),
    keccak256: keccak256(toHex(text)),
  };
}

export async function GET(req: Request) {
  return processPayable(req, {}, { path: HASH_PATH, routePattern: HASH_ROUTE, buildPayload });
}

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return processPayable(req, body, { path: HASH_PATH, routePattern: HASH_ROUTE, buildPayload });
}
