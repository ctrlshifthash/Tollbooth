import { NextResponse } from "next/server";
import { decodePaymentResponseHeader } from "@x402/fetch";
import { buildPaidServerFor, adapterFromRequest, notConfigured } from "@/lib/x402-server";
import { getEchoServerError } from "@/lib/x402-config";
import { getListing, recordPurchase } from "@/lib/marketplace";
import { extractSettlementTxHash } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// /api/marketplace/buy/:id — a REAL, payable x402 endpoint per listing.
//   GET  -> unpaid: 402 with payment requirements (payTo = the SELLER's wallet).
//   POST -> the buyer's signed payment settles USDC on Base to the seller, then
//           the purchase is recorded and the deliverable is returned.
async function handle(req: Request, id: string, body: Record<string, unknown>) {
  const listing = await getListing(id);
  if (!listing || !listing.active) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.demo) return NextResponse.json({ error: "This is a sample listing and can't be purchased." }, { status: 400 });

  const cfgError = getEchoServerError();
  if (cfgError) return notConfigured(cfgError);

  const routePattern = `POST /api/marketplace/buy/${id}`;
  const path = `/api/marketplace/buy/${id}`;
  const server = await buildPaidServerFor({
    payTo: listing.sellerWallet,
    priceUsdc: listing.priceUsdc,
    routePattern,
    description: `Buy: ${listing.title}`,
  });

  const context = {
    adapter: adapterFromRequest(req, body),
    path,
    method: "POST",
    paymentHeader: req.headers.get("payment-signature") ?? req.headers.get("x-payment") ?? undefined,
    routePattern,
  };

  const result = await server.processHTTPRequest(context);

  // Unpaid / invalid payment → the 402 challenge (payTo = seller).
  if (result.type === "payment-error") {
    const r = result.response;
    return new NextResponse(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json", ...r.headers },
    });
  }

  if (result.type === "payment-verified") {
    const settle = await server.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions);
    if (!("success" in settle) || !settle.success) {
      const fr = (settle as { response?: { status: number; headers: Record<string, string>; body?: unknown } }).response;
      return new NextResponse(JSON.stringify(fr?.body ?? { error: "settlement failed" }), {
        status: fr?.status ?? 402,
        headers: { "content-type": "application/json", ...(fr?.headers ?? {}) },
      });
    }

    // Extract the on-chain tx hash + payer from any settlement response header.
    let txHash: string | undefined;
    let payer: string | undefined;
    for (const [k, v] of Object.entries(settle.headers ?? {})) {
      if (typeof v !== "string" || !/payment/i.test(k)) continue;
      try {
        const decoded = decodePaymentResponseHeader(v) as Record<string, unknown>;
        const tx = extractSettlementTxHash(decoded);
        if (tx) {
          txHash = tx;
          if (typeof decoded.payer === "string") payer = decoded.payer;
          break;
        }
      } catch {
        /* not a decodable payment header */
      }
    }

    const buyerWallet = (typeof body.buyer === "string" && body.buyer) || payer || "unknown";
    const purchase = await recordPurchase({
      listingId: listing.id,
      title: listing.title,
      type: listing.type,
      buyerWallet,
      sellerWallet: listing.sellerWallet,
      amountUsdc: listing.priceUsdc,
      txHash,
      deliverable: listing.deliverable,
    });

    return NextResponse.json(
      { ok: true, purchase, deliverable: listing.deliverable, txHash: txHash ?? null },
      { status: 200, headers: settle.headers }
    );
  }

  // Shouldn't happen for a priced listing.
  return NextResponse.json({ error: "Unexpected payment state" }, { status: 500 });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return handle(req, params.id, {});
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return handle(req, params.id, body);
}
