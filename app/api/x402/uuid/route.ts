import { randomUUID } from "node:crypto";
import { processPayable, UUID_PATH, UUID_ROUTE } from "@/lib/x402-server";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /api/x402/uuid — a REAL, payable x402 endpoint hosted by Tollbooth.
//
//   GET  -> unpaid: 402 with live x402 payment requirements.
//   POST -> pay in USDC on Base, get a batch of cryptographically-random UUIDv4s.
//           Input: { count: number } body, or ?count= query (1–100, default 1).
//
// Settlement runs through the same CDP facilitator as /api/x402/echo.
// ---------------------------------------------------------------------------

function requestedCount(body: unknown, url: URL): number {
  const raw =
    body && typeof body === "object" && "count" in body
      ? (body as Record<string, unknown>).count
      : url.searchParams.get("count");
  const n = Math.floor(Number(raw ?? 1));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 100);
}

function buildPayload(body: unknown, url: URL) {
  const count = requestedCount(body, url);
  return {
    service: "agent402-uuid",
    count,
    uuids: Array.from({ length: count }, () => randomUUID()),
  };
}

export async function GET(req: Request) {
  return processPayable(req, {}, { path: UUID_PATH, routePattern: UUID_ROUTE, buildPayload });
}

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return processPayable(req, body, { path: UUID_PATH, routePattern: UUID_ROUTE, buildPayload });
}
