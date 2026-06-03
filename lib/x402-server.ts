import "server-only";
import { NextResponse } from "next/server";
import {
  x402ResourceServer,
  x402HTTPResourceServer,
  HTTPFacilitatorClient,
  type HTTPAdapter,
  type RoutesConfig,
} from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { facilitator } from "@coinbase/x402";
import { X402_NETWORK, X402_CHAIN_LABEL, getEchoPrice, getRoutePrice, getPayTo, getEchoServerError } from "./x402-config";

// ---------------------------------------------------------------------------
// In-app payable x402 endpoint (the "Tollbooth Echo" service).
//
// This builds a REAL x402 resource server backed by Coinbase's CDP facilitator
// on Base mainnet. An unpaid request receives a genuine 402 with payment
// requirements; a request carrying a valid X-PAYMENT header is verified and
// settled in USDC on Base, then the handler runs.
//
// It is only constructed when X402_PAY_TO + CDP credentials are present
// (see getEchoServerError). Otherwise /api/x402/echo returns a clear 503.
// ---------------------------------------------------------------------------

export const ECHO_ROUTE = "POST /api/x402/echo";
export const ECHO_PATH = "/api/x402/echo";
export const ROUTE_ROUTE = "POST /api/x402/route";
export const ROUTE_PATH = "/api/x402/route";
export const HASH_ROUTE = "POST /api/x402/hash";
export const HASH_PATH = "/api/x402/hash";
export const UUID_ROUTE = "POST /api/x402/uuid";
export const UUID_PATH = "/api/x402/uuid";

// AI services (model-gateway-backed). One route each so they show as distinct,
// genuinely useful paid services in the directory.
export const LLM_ROUTE = "POST /api/x402/llm";
export const LLM_PATH = "/api/x402/llm";
export const SUMMARIZE_ROUTE = "POST /api/x402/summarize";
export const SUMMARIZE_PATH = "/api/x402/summarize";
export const TRANSLATE_ROUTE = "POST /api/x402/translate";
export const TRANSLATE_PATH = "/api/x402/translate";
export const EXTRACT_ROUTE = "POST /api/x402/extract";
export const EXTRACT_PATH = "/api/x402/extract";

// Per-call price for the simple compute endpoints (hash, uuid). Kept low so the
// pay-and-call loop is cheap to exercise on mainnet.
const COMPUTE_PRICE = "$0.01";

function getLlmPrice(): string {
  return process.env.X402_LLM_PRICE?.trim() || "$0.02";
}

function buildRoutes(): RoutesConfig {
  const payTo = getPayTo() as string;
  return {
    [ECHO_ROUTE]: {
      accepts: { scheme: "exact", network: X402_NETWORK, payTo, price: getEchoPrice() },
      description: "Tollbooth Echo — a real x402 endpoint. Pay in USDC on Base to echo your JSON payload.",
      mimeType: "application/json",
    },
    // The x402 Router: pay Tollbooth per routed task. Tollbooth selects the best
    // live service, calls it, and returns the result.
    [ROUTE_ROUTE]: {
      accepts: { scheme: "exact", network: X402_NETWORK, payTo, price: getRoutePrice() },
      description: "Tollbooth Router — pay per task; we pick the best live x402 service and return the result.",
      mimeType: "application/json",
    },
    [HASH_ROUTE]: {
      accepts: { scheme: "exact", network: X402_NETWORK, payTo, price: COMPUTE_PRICE },
      description: "Tollbooth Hash — pay in USDC on Base to get SHA-256 + Keccak-256 digests of your input.",
      mimeType: "application/json",
    },
    [UUID_ROUTE]: {
      accepts: { scheme: "exact", network: X402_NETWORK, payTo, price: COMPUTE_PRICE },
      description: "Tollbooth UUID — pay in USDC on Base for a batch of cryptographically-random UUIDv4s.",
      mimeType: "application/json",
    },
    [LLM_ROUTE]: {
      accepts: { scheme: "exact", network: X402_NETWORK, payTo, price: getLlmPrice() },
      description: "Tollbooth AI Chat — pay per prompt in USDC on Base. Any frontier model.",
      mimeType: "application/json",
    },
    [SUMMARIZE_ROUTE]: {
      accepts: { scheme: "exact", network: X402_NETWORK, payTo, price: getLlmPrice() },
      description: "Tollbooth Summarize — pay in USDC on Base to condense any text into a tight summary.",
      mimeType: "application/json",
    },
    [TRANSLATE_ROUTE]: {
      accepts: { scheme: "exact", network: X402_NETWORK, payTo, price: getLlmPrice() },
      description: "Tollbooth Translate — pay in USDC on Base to translate text into any language.",
      mimeType: "application/json",
    },
    [EXTRACT_ROUTE]: {
      accepts: { scheme: "exact", network: X402_NETWORK, payTo, price: getLlmPrice() },
      description: "Tollbooth Extract — pay in USDC on Base to turn unstructured text into structured JSON.",
      mimeType: "application/json",
    },
  };
}

let serverPromise: Promise<x402HTTPResourceServer> | null = null;

// Single resource server hosting all Tollbooth paid endpoints (echo + router).
export async function getResourceServer(): Promise<x402HTTPResourceServer> {
  if (getEchoServerError()) {
    throw new Error(getEchoServerError() as string);
  }
  if (!serverPromise) {
    serverPromise = (async () => {
      // CDP facilitator config reads CDP_API_KEY_ID / CDP_API_KEY_SECRET from env.
      const facilitatorClient = new HTTPFacilitatorClient(facilitator);
      const resourceServer = new x402ResourceServer(facilitatorClient).register(
        X402_NETWORK,
        new ExactEvmScheme()
      );
      const httpServer = new x402HTTPResourceServer(resourceServer, buildRoutes());
      await httpServer.initialize();
      return httpServer;
    })();
  }
  return serverPromise;
}

// Back-compat alias used by the echo route.
export const getEchoServer = getResourceServer;

// Build a one-off x402 resource server that settles to an ARBITRARY payTo.
// Used by the marketplace so a buy settles straight to the seller's wallet
// (instead of the platform wallet). Uses the same CDP facilitator.
export async function buildPaidServerFor(opts: {
  payTo: string;
  priceUsdc: number;
  routePattern: string;
  description?: string;
}): Promise<x402HTTPResourceServer> {
  const facilitatorClient = new HTTPFacilitatorClient(facilitator);
  const resourceServer = new x402ResourceServer(facilitatorClient).register(X402_NETWORK, new ExactEvmScheme());
  const routes: RoutesConfig = {
    [opts.routePattern]: {
      accepts: { scheme: "exact", network: X402_NETWORK, payTo: opts.payTo, price: `$${opts.priceUsdc}` },
      description: opts.description ?? "Tollbooth marketplace purchase",
      mimeType: "application/json",
    },
  };
  const httpServer = new x402HTTPResourceServer(resourceServer, routes);
  await httpServer.initialize();
  return httpServer;
}

// Shared 503 for when the payable endpoints aren't configured.
export function notConfigured(detail: string) {
  return NextResponse.json(
    {
      error: "x402 endpoint not configured",
      detail,
      hint: "Set X402_PAY_TO and CDP_API_KEY_ID / CDP_API_KEY_SECRET to activate this endpoint.",
    },
    { status: 503 }
  );
}

// Drive one payable x402 request end-to-end: unpaid → 402 challenge; paid →
// verify + settle USDC on Base via the CDP facilitator, then return the payload
// produced by `buildPayload`. Used by every in-app payable route (echo, hash,
// uuid, …) so the real settlement logic lives in exactly one place.
export async function processPayable(
  req: Request,
  body: unknown,
  opts: {
    path: string;
    routePattern: string;
    buildPayload: (body: unknown, url: URL) => Record<string, unknown> | Promise<Record<string, unknown>>;
  }
): Promise<Response> {
  const cfgError = getEchoServerError();
  if (cfgError) return notConfigured(cfgError);

  const server = await getResourceServer();
  const context = {
    adapter: adapterFromRequest(req, body),
    path: opts.path,
    method: "POST", // routes are registered as POST; GET is treated as an unpaid probe
    // x402 v2 sends the signed payment in `PAYMENT-SIGNATURE`; v1 used `X-PAYMENT`.
    paymentHeader: req.headers.get("payment-signature") ?? req.headers.get("x-payment") ?? undefined,
    routePattern: opts.routePattern,
  };

  const result = await server.processHTTPRequest(context);

  // Unpaid or invalid payment → the facilitator-produced 402 challenge.
  if (result.type === "payment-error") {
    const r = result.response;
    return new NextResponse(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json", ...r.headers },
    });
  }

  const built = await opts.buildPayload(body, new URL(req.url));
  const payload = {
    network: X402_CHAIN_LABEL,
    payTo: getPayTo(),
    settledAt: new Date().toISOString(),
    ...built,
  };

  if (result.type === "payment-verified") {
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

// Build the framework-agnostic HTTPAdapter the resource server needs from a
// standard web Request (Next.js route handlers receive one of these).
export function adapterFromRequest(req: Request, body: unknown): HTTPAdapter {
  const url = new URL(req.url);
  return {
    getHeader: (name: string) => req.headers.get(name) ?? undefined,
    getMethod: () => req.method,
    getPath: () => url.pathname,
    getUrl: () => req.url,
    getAcceptHeader: () => req.headers.get("accept") ?? "",
    getUserAgent: () => req.headers.get("user-agent") ?? "",
    getQueryParams: () => Object.fromEntries(url.searchParams.entries()),
    getQueryParam: (name: string) => url.searchParams.get(name) ?? undefined,
    getBody: () => body,
  };
}
