import { NextResponse } from "next/server";
import { getEchoServer, adapterFromRequest, ECHO_PATH, ECHO_ROUTE } from "@/lib/x402-server";
import { getEchoServerError, getEchoPrice, getPayTo, X402_CHAIN_LABEL } from "@/lib/x402-config";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /api/x402/echo — a REAL, payable x402 endpoint hosted by Tollbooth.
//
//   GET  -> unpaid: always 402 with live x402 payment requirements.
//   POST -> the protected resource. Unpaid requests get 402; requests carrying
//           a valid X-PAYMENT header are verified + settled in USDC on Base via
//           the CDP facilitator, then the JSON payload is echoed back.
//
// Requires X402_PAY_TO + CDP_API_KEY_ID + CDP_API_KEY_SECRET. Without them the
// route returns 503 with a clear reason (never a fake 402).
// ---------------------------------------------------------------------------

function notConfigured(detail: string) {
  return NextResponse.json(
    {
      error: "x402 endpoint not configured",
      detail,
      hint: "Set X402_PAY_TO and CDP_API_KEY_ID / CDP_API_KEY_SECRET to activate this endpoint.",
    },
    { status: 503 }
  );
}

// A simple GET so humans/agents can see the 402 challenge without a body.
export async function GET(req: Request) {
  return handle(req, {});
}

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return handle(req, body);
}

async function handle(req: Request, body: unknown) {
  const cfgError = getEchoServerError();
  if (cfgError) return notConfigured(cfgError);

  const server = await getEchoServer();
  const context = {
    adapter: adapterFromRequest(req, body),
    path: ECHO_PATH,
    method: "POST", // route is registered as POST; GET is treated as an unpaid probe
    // x402 v2 sends the signed payment in the `PAYMENT-SIGNATURE` header
    // (v1 used `X-PAYMENT`). Accept both so either client works.
    paymentHeader:
      req.headers.get("payment-signature") ?? req.headers.get("x-payment") ?? undefined,
    routePattern: ECHO_ROUTE,
  };

  const result = await server.processHTTPRequest(context);

  // Unpaid (or invalid payment): return the facilitator-produced 402 challenge.
  if (result.type === "payment-error") {
    const r = result.response;
    return new NextResponse(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json", ...r.headers },
    });
  }

  // The resource itself.
  const payload = {
    service: "agent402-echo",
    network: X402_CHAIN_LABEL,
    price: getEchoPrice(),
    payTo: getPayTo(),
    echoed: body ?? null,
    settledAt: new Date().toISOString(),
  };

  if (result.type === "payment-verified") {
    // Payment verified — now settle it on-chain and attach settlement headers.
    const settle = await server.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
      result.declaredExtensions
    );
    if ("success" in settle && settle.success) {
      return NextResponse.json(payload, { status: 200, headers: settle.headers });
    }
    const failResponse = (settle as { response?: { status: number; headers: Record<string, string>; body?: unknown } }).response;
    return new NextResponse(JSON.stringify(failResponse?.body ?? { error: "settlement failed" }), {
      status: failResponse?.status ?? 402,
      headers: { "content-type": "application/json", ...(failResponse?.headers ?? {}) },
    });
  }

  // "no-payment-required" — return the resource directly.
  return NextResponse.json(payload, { status: 200 });
}
