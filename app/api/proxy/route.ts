import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getServices, appendCallRecord } from "@/lib/store";
import type { CallRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Same-origin x402 proxy.
//
// The browser pays with the user's wallet; to dodge cross-origin CORS, the
// actual HTTP call to the service is relayed here. We forward the x402 payment
// headers and relay back the challenge/settlement headers untouched.
//
// SSRF guard: only URLs that exactly match a known listed service are allowed.
// ---------------------------------------------------------------------------

// Request headers we forward to the target (x402 payment + content negotiation).
const FORWARD_REQ = ["payment-signature", "x-payment", "payment", "accept", "content-type"];
// Response headers we relay back to the browser (challenge + settlement).
const RELAY_RES = ["content-type", "payment-required", "payment-response", "x-payment-response", "retry-after"];

async function handle(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  // SSRF guard — must be a known, listed service endpoint.
  const service = (await getServices()).find((s) => s.endpoint === target);
  if (!service) {
    return NextResponse.json({ error: "Endpoint is not a listed service" }, { status: 403 });
  }

  const outHeaders: Record<string, string> = { "user-agent": "Tollbooth-Proxy/1.0" };
  for (const h of FORWARD_REQ) {
    const v = req.headers.get(h);
    if (v) outHeaders[h] = v;
  }
  const hadPayment = !!(req.headers.get("payment-signature") || req.headers.get("x-payment") || req.headers.get("payment"));

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  const started = Date.now();
  let tRes: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    tRes = await fetch(target, { method: req.method, headers: outHeaders, body, signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upstream fetch failed" }, { status: 502 });
  }
  const latencyMs = Date.now() - started;

  const buf = await tRes.arrayBuffer();
  const resHeaders = new Headers();
  for (const h of RELAY_RES) {
    const v = tRes.headers.get(h);
    if (v) resHeaders.set(h, v);
  }

  // If this was a paid request that settled, record a real CallRecord.
  const settleHeader = tRes.headers.get("x-payment-response") ?? tRes.headers.get("payment-response");
  if (hadPayment && tRes.status === 200) {
    let txHash: string | undefined;
    if (settleHeader) {
      try {
        const decoded = JSON.parse(Buffer.from(settleHeader, "base64").toString("utf8")) as Record<string, unknown>;
        const tx = (decoded.transaction ?? decoded.txHash ?? decoded.hash) as unknown;
        if (typeof tx === "string" && tx.startsWith("0x")) txHash = tx;
      } catch {
        /* leave txHash undefined */
      }
    }
    const rec: CallRecord = {
      id: `call_${service.id}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
      serviceId: service.id,
      type: "payment",
      timestamp: new Date().toISOString(),
      paid: true,
      ok: true,
      status: 200,
      latencyMs,
      amountUsdc: service.priceUsdc,
      txHash,
    };
    await appendCallRecord(service.id, rec);
  }

  return new NextResponse(buf, { status: tRes.status, headers: resHeaders });
}

export const GET = handle;
export const POST = handle;
