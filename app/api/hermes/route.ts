import { NextResponse } from "next/server";
import { runHermesAgent } from "@/lib/hermes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/hermes  { goal, model?, maxSteps?, budgetUsdc? }
// Runs the Hermes orchestrator: the model reasons and calls paid x402 tools,
// each settled in USDC on Base, then returns the full trace + final answer.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const goal = String(body.goal ?? "").trim();
  if (!goal) return NextResponse.json({ error: "A goal is required" }, { status: 422 });

  const result = await runHermesAgent({
    goal,
    model: body.model ? String(body.model) : undefined,
    maxSteps: body.maxSteps ? Number(body.maxSteps) : undefined,
    budgetUsdc: body.budgetUsdc ? Number(body.budgetUsdc) : undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
