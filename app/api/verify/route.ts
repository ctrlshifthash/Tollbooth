import { NextResponse } from "next/server";
import { getServiceById, saveService } from "@/lib/store";
import { runVerification } from "@/lib/verification";
import { computeReputation, isValidEthAddress, isValidUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

// POST /api/verify
// Body: { endpoint, wallet, serviceId? }
// Runs the live x402 verification pipeline. If a serviceId is supplied, the run
// is appended to that service's history and its status is updated to the result.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const endpoint = String(body.endpoint ?? "").trim();
  const wallet = String(body.wallet ?? "").trim();
  const serviceId = body.serviceId ? String(body.serviceId) : undefined;

  if (!isValidUrl(endpoint)) {
    return NextResponse.json({ error: "A valid http(s) endpoint URL is required" }, { status: 422 });
  }
  if (!isValidEthAddress(wallet)) {
    return NextResponse.json({ error: "A valid 0x wallet address is required" }, { status: 422 });
  }

  const run = await runVerification({ serviceId: serviceId ?? "adhoc", endpoint, wallet });

  // Persist against an existing service if one was named.
  if (serviceId) {
    const service = getServiceById(serviceId);
    if (service) {
      service.verificationHistory = [run, ...service.verificationHistory].slice(0, 20);
      service.verificationStatus = run.status;
      service.updatedAt = new Date().toISOString();
      if (run.latencyMs) service.metrics.avgLatencyMs = run.latencyMs;
      service.metrics.reputationScore = computeReputation({
        uptimePct: service.metrics.uptimePct,
        successfulCalls: service.metrics.successfulCalls,
        failedCalls: service.metrics.failedCalls,
        totalCalls: service.metrics.totalCalls,
        verified: run.status === "verified",
      });
      saveService(service);
    }
  }

  return NextResponse.json({ verification: run });
}
