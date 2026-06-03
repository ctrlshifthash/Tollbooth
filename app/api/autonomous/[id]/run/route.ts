import { NextResponse } from "next/server";
import { runAgentOnce } from "@/lib/autonomous";

export const dynamic = "force-dynamic";

// POST /api/autonomous/:id/run  -> execute one paid call right now (if due/eligible).
// Real USDC settles on Base; the agent's budget bounds total spend.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const agent = await runAgentOnce(params.id);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent, lastRun: agent.runs[0] ?? null });
}
