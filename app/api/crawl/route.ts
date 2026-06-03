import { NextResponse } from "next/server";
import { runCrawl, type CrawlInput } from "@/lib/crawler";
import { getServices, saveService } from "@/lib/store";

export const dynamic = "force-dynamic";

// POST /api/crawl
// Body: { manual?: string[], github?: {query?,limit?}|true, farcaster?: true, virtuals?: true }
// Runs the discovery adapters, probes candidates, and saves NEW endpoints as
// unclaimed + unverified listings. Existing endpoints (by URL) are skipped.
export async function POST(req: Request) {
  let body: CrawlInput = {};
  try {
    body = (await req.json()) as CrawlInput;
  } catch {
    body = {};
  }

  // Default to a GitHub sweep if nothing specified.
  if (!body.manual && !body.github && !body.farcaster && !body.virtuals) {
    body.github = true;
  }

  const { discovered, reports } = await runCrawl(body);

  // Dedupe against existing endpoints and persist new ones.
  const existing = new Set(getServices().map((s) => s.endpoint));
  const seen = new Set<string>();
  const saved: { id: string; name: string; endpoint: string; wallet: string }[] = [];
  for (const svc of discovered) {
    if (existing.has(svc.endpoint) || seen.has(svc.endpoint)) continue;
    seen.add(svc.endpoint);
    saveService(svc);
    saved.push({ id: svc.id, name: svc.name, endpoint: svc.endpoint, wallet: svc.wallet });
  }

  return NextResponse.json({
    discovered: discovered.length,
    saved: saved.length,
    skippedExisting: discovered.length - saved.length,
    services: saved,
    reports,
  });
}
