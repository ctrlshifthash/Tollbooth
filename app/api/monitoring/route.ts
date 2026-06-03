import { NextResponse } from "next/server";
import { getServices, getServiceById } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/monitoring               -> uptime summary for every service
// GET /api/monitoring?serviceId=... -> full health-check history for one service
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");

  if (serviceId) {
    const svc = await getServiceById(serviceId);
    if (!svc) return NextResponse.json({ error: "Service not found" }, { status: 404 });
    return NextResponse.json({
      service: {
        id: svc.id,
        slug: svc.slug,
        name: svc.name,
        chain: svc.chain,
        endpoint: svc.endpoint,
        healthCheckUrl: svc.healthCheckUrl ?? null,
        demo: !!svc.demo,
        status: svc.verificationStatus,
        uptimePct: svc.metrics.uptimePct,
        avgLatencyMs: svc.metrics.avgLatencyMs,
        lastCheckedAt: svc.lastCheckedAt ?? null,
        checks: svc.healthChecks,
      },
    });
  }

  const services = (await getServices()).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    chain: s.chain,
    demo: !!s.demo,
    status: s.verificationStatus,
    uptimePct: s.metrics.uptimePct,
    avgLatencyMs: s.metrics.avgLatencyMs,
    lastCheckedAt: s.lastCheckedAt ?? null,
    checkCount: (s.healthChecks ?? []).length,
    failedChecks: (s.healthChecks ?? []).filter((c) => !c.ok).length,
  }));

  const monitored = services.filter((s) => s.checkCount > 0);
  return NextResponse.json({
    services,
    summary: {
      total: services.length,
      monitored: monitored.length,
      avgUptime: monitored.length ? monitored.reduce((a, s) => a + s.uptimePct, 0) / monitored.length : null,
      totalFailedChecks: services.reduce((a, s) => a + s.failedChecks, 0),
    },
  });
}
