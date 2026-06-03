import { NextResponse } from "next/server";
import { getListings, createListing } from "@/lib/marketplace";
import { getServiceById, getAgentById } from "@/lib/store";
import { toManifest } from "@/lib/utils";
import type { Deliverable, ListingType, ServiceCategory } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/marketplace?type=&category=&seller=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listings = await getListings({
    type: searchParams.get("type") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    seller: searchParams.get("seller") ?? undefined,
  });
  return NextResponse.json({ listings, count: listings.length });
}

// POST /api/marketplace — create a listing. The deliverable (what the buyer
// receives) is built server-side from the listing type so it's always valid.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = (["service", "agent", "automation", "other"].includes(String(body.type)) ? body.type : "other") as ListingType;
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const category = (CATEGORIES.some((c) => c.value === body.category) ? body.category : "tools") as ServiceCategory;
  const priceUsdc = Number(body.priceUsdc ?? 0);
  const sellerWallet = String(body.sellerWallet ?? "").trim();
  const sellerAgentId = body.sellerAgentId ? String(body.sellerAgentId) : undefined;

  let deliverable: Deliverable;
  let serviceId: string | undefined;

  if (type === "service") {
    const svc = await getServiceById(String(body.serviceId ?? ""));
    if (!svc) return NextResponse.json({ error: "Service not found for this listing" }, { status: 422 });
    serviceId = svc.id;
    deliverable = {
      kind: "service-access",
      data: { serviceId: svc.id, slug: svc.slug, name: svc.name, endpoint: svc.endpoint, chain: svc.chain, manifest: toManifest(svc) },
      note: "Pay-per-call x402 service. Use the endpoint with the included manifest.",
    };
  } else if (type === "automation") {
    deliverable = {
      kind: "automation-template",
      data: {
        targetServiceId: String(body.targetServiceId ?? ""),
        prompt: String(body.prompt ?? ""),
        model: String(body.model ?? ""),
        intervalSec: Number(body.intervalSec ?? 60),
        budgetUsdc: Number(body.budgetUsdc ?? 0.1),
      },
      note: "Deploy as your own autonomous agent from your dashboard.",
    };
  } else if (type === "agent") {
    const ag = sellerAgentId ? await getAgentById(sellerAgentId) : undefined;
    deliverable = {
      kind: "agent-template",
      data: { displayName: ag?.displayName ?? title, bio: ag?.bio ?? description, sourceAgentId: ag?.id ?? null },
      note: "Clone this agent into your own profile.",
    };
  } else {
    deliverable = { kind: "content", data: { content: String(body.content ?? description) }, note: "Delivered on purchase." };
  }

  const result = await createListing({ type, title, description, category, priceUsdc, sellerWallet, sellerAgentId, serviceId, deliverable });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ listing: result.listing }, { status: 201 });
}
