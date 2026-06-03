import { NextResponse } from "next/server";
import { getAutonomousAgents, createAutonomousAgent } from "@/lib/autonomous";

export const dynamic = "force-dynamic";

// GET /api/autonomous?owner=0x...   -> list runners (optionally for one wallet)
export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner") ?? undefined;
  const agents = await getAutonomousAgents(owner ?? undefined);
  return NextResponse.json({ agents, count: agents.length });
}

// POST /api/autonomous
// Body: { name, ownerWallet, targetServiceId, intervalSec, maxCalls, budgetUsdc }
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const result = await createAutonomousAgent({
    name: String(body.name ?? ""),
    ownerWallet: String(body.ownerWallet ?? ""),
    targetServiceId: String(body.targetServiceId ?? ""),
    intervalSec: Number(body.intervalSec ?? 60),
    maxCalls: Number(body.maxCalls ?? 0),
    budgetUsdc: Number(body.budgetUsdc ?? 0),
    prompt: body.prompt ? String(body.prompt) : undefined,
    model: body.model ? String(body.model) : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ agent: result.agent }, { status: 201 });
}
