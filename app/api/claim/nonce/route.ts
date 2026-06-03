import { NextResponse } from "next/server";
import { issueNonce } from "@/lib/claim";

export const dynamic = "force-dynamic";

// POST /api/claim/nonce  { serviceId, wallet }
// Issues a single-use, time-boxed nonce + message for the owner to sign.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const serviceId = String(body.serviceId ?? "");
  const wallet = String(body.wallet ?? "");
  const result = await issueNonce(serviceId, wallet);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  const { nonce, message, expiresAt } = result.challenge!;
  return NextResponse.json({ nonce, message, expiresAt });
}
