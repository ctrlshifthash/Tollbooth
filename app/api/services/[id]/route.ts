import { NextResponse } from "next/server";
import { getServiceById } from "@/lib/store";
import { toManifest } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/services/:id  (accepts id or slug)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const service = getServiceById(params.id);
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }
  return NextResponse.json({ service, manifest: toManifest(service) });
}
