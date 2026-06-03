import { NextResponse } from "next/server";
import { getAutonomousAgent, setStatus, deleteAutonomousAgent } from "@/lib/autonomous";
import type { AutonomousStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/autonomous/:id  -> a single runner
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const agent = await getAutonomousAgent(params.id);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

// POST /api/autonomous/:id  { action: "pause" | "resume" | "stop" }
const ACTION_TO_STATUS: Record<string, AutonomousStatus> = {
  pause: "paused",
  resume: "running",
  stop: "stopped",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const status = ACTION_TO_STATUS[String(body.action ?? "")];
  if (!status) return NextResponse.json({ error: "action must be pause | resume | stop" }, { status: 422 });
  const agent = setStatus(params.id, status);
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

// DELETE /api/autonomous/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await deleteAutonomousAgent(params.id);
  return NextResponse.json({ ok: true });
}
