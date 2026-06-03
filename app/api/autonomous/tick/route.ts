import { NextResponse } from "next/server";
import { tickDueAgents } from "@/lib/autonomous";

export const dynamic = "force-dynamic";

// POST /api/autonomous/tick
// Runs every agent whose next call is due. Driven by the /autonomous page poll,
// the scripts/agent-runner.mjs worker, or a real cron. If CRON_SECRET is set,
// require `Authorization: Bearer <secret>` (so a public deploy can't be poked).
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const { ran, agents } = await tickDueAgents();
  return NextResponse.json({ ran, agents });
}
