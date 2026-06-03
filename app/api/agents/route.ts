import { NextResponse } from "next/server";
import { getAgents, getServices, getAgentsByWallet, createAgent } from "@/lib/store";
import { isValidEthAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/agents?withServices=true
// Lists agent/developer profiles, sorted by trust score.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const withServices = searchParams.get("withServices") === "true";

  const agents = (await getAgents()).sort((a, b) => b.trustScore - a.trustScore);
  if (!withServices) {
    return NextResponse.json({ agents, count: agents.length });
  }

  const services = await getServices();
  const enriched = agents.map((a) => ({
    ...a,
    services: services.filter((s) => a.serviceIds.includes(s.id)),
  }));
  return NextResponse.json({ agents: enriched, count: enriched.length });
}

// POST /api/agents  { wallet, handle?, displayName?, bio? }
// Creates a NEW agent owned by the wallet. A wallet can create unlimited agents.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const wallet = String(body.wallet ?? "").trim();
  if (!isValidEthAddress(wallet)) return NextResponse.json({ error: "A valid wallet is required" }, { status: 422 });

  const agent = await createAgent({
    wallet,
    handle: body.handle ? String(body.handle) : undefined,
    displayName: body.displayName ? String(body.displayName) : undefined,
    bio: body.bio ? String(body.bio) : undefined,
  });
  return NextResponse.json({ agent, owned: (await getAgentsByWallet(wallet)).length }, { status: 201 });
}
