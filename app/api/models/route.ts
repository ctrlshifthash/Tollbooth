import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/models
// Returns the full live model catalog (text-capable models only), grouped
// client-side by provider. Always current — no hardcoded list to go stale.
export async function GET() {
  const key = process.env.AI_GATEWAY_KEY?.trim();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { // model gateway host
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ models: [], error: `Model gateway HTTP ${res.status}` });
    const data = (await res.json()) as {
      data?: { id: string; name?: string; architecture?: { modality?: string } }[];
    };
    const models = (data.data ?? [])
      .filter((m) => {
        const mod = m.architecture?.modality ?? "";
        return mod.includes("text->text") || mod.includes("text+image->text");
      })
      .map((m) => ({ id: m.id, name: m.name ?? m.id, provider: m.id.split("/")[0] }))
      .sort((a, b) => (a.provider === b.provider ? a.name.localeCompare(b.name) : a.provider.localeCompare(b.provider)));
    return NextResponse.json({ models, count: models.length });
  } catch {
    return NextResponse.json({ models: [], error: "Failed to reach the model gateway" });
  }
}
