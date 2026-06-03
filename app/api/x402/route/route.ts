import { NextResponse } from "next/server";
import { getResourceServer, adapterFromRequest, ROUTE_PATH, ROUTE_ROUTE } from "@/lib/x402-server";
import { getEchoServerError, getRoutePriceUsdc } from "@/lib/x402-config";
import { routeAndRun } from "@/lib/router";
import type { ServiceCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

// /api/x402/route — Tollbooth's paid Router service.
// The caller pays the flat Router fee (X402_ROUTE_PRICE, default $0.10) in USDC
// on Base. Once settled, Tollbooth selects the best live x402 service for the
// task, calls it, and returns the real result.
export async function POST(req: Request) {
  const cfgError = getEchoServerError();
  if (cfgError) {
    return NextResponse.json({ error: "Router not configured", detail: cfgError }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const server = await getResourceServer();
  const context = {
    adapter: adapterFromRequest(req, body),
    path: ROUTE_PATH,
    method: "POST",
    paymentHeader: req.headers.get("payment-signature") ?? req.headers.get("x-payment") ?? undefined,
    routePattern: ROUTE_ROUTE,
  };

  const result = await server.processHTTPRequest(context);

  // Unpaid → return the 402 challenge (price = the Router fee).
  if (result.type === "payment-error") {
    const r = result.response;
    return new NextResponse(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json", ...r.headers },
    });
  }

  // Settle the Router fee.
  let feeHeaders: Record<string, string> = {};
  if (result.type === "payment-verified") {
    const settle = await server.processSettlement(result.paymentPayload, result.paymentRequirements, result.declaredExtensions);
    if ("success" in settle && settle.success) {
      feeHeaders = settle.headers;
    } else {
      const fr = (settle as { response?: { status: number; headers: Record<string, string>; body?: unknown } }).response;
      return new NextResponse(JSON.stringify(fr?.body ?? { error: "fee settlement failed" }), {
        status: fr?.status ?? 402,
        headers: { "content-type": "application/json", ...(fr?.headers ?? {}) },
      });
    }
  }

  // Fee collected — now do the work: select + call the best downstream service.
  const routed = await routeAndRun({
    query: typeof body.query === "string" ? body.query : undefined,
    category: body.category as ServiceCategory | "any" | undefined,
    maxPriceUsdc: typeof body.maxPriceUsdc === "number" ? body.maxPriceUsdc : undefined,
  });

  return NextResponse.json(
    {
      ok: routed.ok,
      feeUsdc: getRoutePriceUsdc(),
      selected: routed.selected ?? null,
      reason: routed.reason ?? null,
      result: routed.result ?? null,
      downstreamTx: routed.txHash ?? null,
      downstreamStatus: routed.status ?? null,
      candidates: routed.candidates ?? [],
      viaHermes: routed.viaHermes ?? false,
      hermes: routed.hermes ?? null,
      error: routed.error ?? null,
    },
    { status: 200, headers: feeHeaders }
  );
}
