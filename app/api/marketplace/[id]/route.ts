import { NextResponse } from "next/server";
import { getListing } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

// GET /api/marketplace/:id
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const listing = await getListing(params.id);
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  return NextResponse.json({ listing });
}
