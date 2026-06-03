import { NextResponse } from "next/server";
import { verifyClaim } from "@/lib/claim";

export const dynamic = "force-dynamic";

// POST /api/claim/verify  { serviceId, wallet, signature }
// Verifies the signed nonce. Only on a valid signature is ownership stored.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const serviceId = String(body.serviceId ?? "");
  const wallet = String(body.wallet ?? "");
  const signature = String(body.signature ?? "");
  const result = await verifyClaim(serviceId, wallet, signature);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true, ownership: result.ownership });
}
