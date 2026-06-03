import { NextResponse } from "next/server";
import { checkService, checkAllServices } from "@/lib/health";

export const dynamic = "force-dynamic";

// POST /api/monitoring/check  { serviceId? , includeDemo? }
// Runs a real uptime probe now (one service, or all non-demo services).
// Same engine as POST /api/health; exposed here for the monitoring UI.
export async function POST(req: Request) {
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
