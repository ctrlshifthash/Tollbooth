import { NextResponse } from "next/server";
import { syncBazaar, getBazaarError } from "@/lib/bazaar";

export const dynamic = "force-dynamic";

// POST /api/bazaar/sync  { limit? }
// Imports real Base-mainnet x402 services from the Coinbase x402 Bazaar.
export async function POST(req: Request) {
  const err = getBazaarError();
  if (err) return NextResponse.json({ error: err }, { status: 503 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const limit = typeof body.limit === "number" ? body.limit : 100;

  try {
    const result = await syncBazaar(limit);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bazaar sync failed" }, { status: 502 });
  }
}
