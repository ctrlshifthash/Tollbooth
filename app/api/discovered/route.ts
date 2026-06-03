import { NextResponse } from "next/server";
import { getServices } from "@/lib/store";

export const dynamic = "force-dynamic";

const DISCOVERY_SOURCES = ["manual", "github", "farcaster", "virtuals", "bazaar"];

// GET /api/discovered?source=&status=&category=&chain=
// Returns services surfaced by the discovery crawler (unclaimed by default).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const chain = searchParams.get("chain");

  let services = getServices().filter((s) => DISCOVERY_SOURCES.includes(s.source));

  if (source && source !== "all") services = services.filter((s) => s.source === source);
  if (status && status !== "all") services = services.filter((s) => s.verificationStatus === status);
  if (category && category !== "all") services = services.filter((s) => s.category === category);
  if (chain && chain !== "all") services = services.filter((s) => s.chain === chain);

  services.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return NextResponse.json({ services, count: services.length });
}
