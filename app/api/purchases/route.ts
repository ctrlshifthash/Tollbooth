import { NextResponse } from "next/server";
import { getPurchases } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

// GET /api/purchases?buyer=0x...  -> a wallet's purchases (deliverables).
export async function GET(req: Request) {
  const buyer = new URL(req.url).searchParams.get("buyer") ?? undefined;
  const purchases = await getPurchases(buyer ?? undefined);
  return NextResponse.json({ purchases, count: purchases.length });
}
