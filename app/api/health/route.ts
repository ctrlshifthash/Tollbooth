import { NextResponse } from "next/server";
import { checkService, checkAllServices } from "@/lib/health";
import { getServiceById } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/health?serviceId=...  -> health history + derived uptime for a service.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  if (!serviceId) return NextResponse.json({ error: "serviceId query param required" }, { status: 422 });
  const svc = getServiceById(serviceId);
  if (!svc) return NextResponse.json({ error: "Service not found" }, { status: 404 });
  return NextResponse.json({
    serviceId: svc.id,
    uptimePct: svc.metrics.uptimePct,
    avgLatencyMs: svc.metrics.avgLatencyMs,
    lastCheckedAt: svc.lastCheckedAt ?? null,
    checks: svc.healthChecks,
  });
}

// POST /api/health  { serviceId? , includeDemo? }
// Runs a real probe now: one service, or all non-demo services if no id given.
// If CRON_SECRET is set, require it via `Authorization: Bearer <secret>`.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.serviceId) {
    const check = await checkService(String(body.serviceId));
    if (!check) return NextResponse.json({ error: "Service not found" }, { status: 404 });
    return NextResponse.json({ checked: 1, checks: [check] });
  }

  const checks = await checkAllServices({ includeDemo: body.includeDemo === true });
  return NextResponse.json({
    checked: checks.length,
    up: checks.filter((c) => c.ok).length,
    down: checks.filter((c) => !c.ok).length,
    checks,
  });
}
