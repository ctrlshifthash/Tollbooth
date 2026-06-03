import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getServiceById, appendCallRecord } from "@/lib/store";
import { parsePaymentRequirements } from "@/lib/verification";
import { isValidUrl, extractSettlementTxHash } from "@/lib/utils";
import { getPaymentKeyError, paidX402Fetch } from "@/lib/x402-payment";
import type { CallRecord, Service } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/test-call
// Body: { serviceId? , endpoint? , pay? }
// Sends an unpaid probe first, then (only when pay:true) a real x402 paid replay
// when X402_EVM_PRIVATE_KEY is configured. Every attempt is recorded as a real
// CallRecord against the service, updating live metrics + settlement history.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let endpoint = body.endpoint ? String(body.endpoint) : "";
  let service: Service | undefined;
  if (body.serviceId) {
    service = getServiceById(String(body.serviceId));
    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });
    if (!endpoint) endpoint = service.endpoint;
  }
  if (!isValidUrl(endpoint)) {
    return NextResponse.json({ error: "A valid endpoint URL is required" }, { status: 422 });
  }

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "Tollbooth-TestCall/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - started;

    const paymentRequirement = res.status === 402 ? await parsePaymentRequirements(res) : null;

    // Capture a small, safe preview of the response body.
    let preview = "";
    try {
      preview = (await res.clone().text()).slice(0, 800);
    } catch {
      preview = "";
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));

    // A real, on-chain USDC payment is only attempted when the caller explicitly
    // opts in with `pay: true` (the "Pay & Call" action). "Test Endpoint" stays
    // an unpaid probe so it never moves funds.
    const wantsPayment = body.pay === true;
    let paid: Awaited<ReturnType<typeof paidX402Fetch>> | null = null;
    let paymentError: string | null = null;
    if (wantsPayment) {
      paymentError = getPaymentKeyError();
      if (!paymentError && res.status === 402 && paymentRequirement) {
        try {
          paid = await paidX402Fetch(endpoint);
        } catch (e) {
          paymentError = e instanceof Error ? e.message : "x402 paid request failed";
        }
      } else if (!paymentError && res.status !== 402) {
        paymentError = `Endpoint returned HTTP ${res.status}, not a 402 challenge — nothing to pay.`;
      }
    }

    // Record a real CallRecord against the service (drives live metrics).
    let txHash: string | null = null;
    if (service) {
      txHash = paid ? extractSettlementTxHash(paid.paymentResponse) : null;
      const record: CallRecord = {
        id: `call_${service.id}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
        serviceId: service.id,
        type: paid ? "payment" : "test",
        timestamp: new Date().toISOString(),
        paid: !!paid,
        ok: paid ? paid.ok : res.status === 402,
        status: paid ? paid.status : res.status,
        latencyMs: paid ? paid.latencyMs : latencyMs,
        amountUsdc: paid && paid.ok ? service.priceUsdc : undefined,
        txHash: txHash ?? undefined,
        error: paymentError ?? undefined,
      };
      appendCallRecord(service.id, record);
    }

    return NextResponse.json({
      ok: res.status === 402,
      probe: {
        endpoint,
        status: res.status,
        latencyMs,
        is402: res.status === 402,
        paymentRequirement,
        headers,
        bodyPreview: preview,
      },
      paid,
      paymentError,
      txHash,
      recorded: !!service,
    });
  } catch (e) {
    // Record the failed attempt too, so reliability reflects reality.
    if (service) {
      appendCallRecord(service.id, {
        id: `call_${service.id}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
        serviceId: service.id,
        type: body.pay === true ? "payment" : "test",
        timestamp: new Date().toISOString(),
        paid: false,
        ok: false,
        status: 0,
        latencyMs: Date.now() - started,
        error: e instanceof Error ? e.message : "Network error",
      });
    }
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
        probe: { endpoint, status: 0, latencyMs: Date.now() - started },
      },
      { status: 502 }
    );
  }
}
