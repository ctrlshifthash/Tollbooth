import { NextResponse } from "next/server";
import { routeAndRun, type RouteRequest } from "@/lib/router";

export const dynamic = "force-dynamic";

// POST /api/router/run
// Body: { query?, category?, serviceId?, maxPriceUsdc?, input?, dryRun? }
// The core product endpoint: select the best live x402 service for the request,
// execute a real paid call, and return the real result + tx hash. An agent
// integrates THIS instead of 96 individual services.
export async function POST(req: Request) {
  let body: RouteRequest = {};
  try {
    body = (await req.json()) as RouteRequest;
  } catch {
    body = {};
  }
  const result = await routeAndRun(body);
  return NextResponse.json(result, { status: result.ok ? 200 : result.error ? 422 : 200 });
}
