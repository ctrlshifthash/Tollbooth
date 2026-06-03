import { NextResponse } from "next/server";
import { getAgentById, getServices } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/agents/:id  (accepts agent id or handle)
// Returns the agent profile plus the services it operates.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const agent = getAgentById(params.id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  const services = getServices().filter((s) => agent.serviceIds.includes(s.id));
  return NextResponse.json({ agent, services });
}
