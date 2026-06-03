import { NextResponse } from "next/server";
import { getServices, saveService, getAgentByWallet, saveAgent, getAgentById } from "@/lib/store";
import { validateManifest, serviceFromManifest } from "@/lib/manifest";
import { runVerification } from "@/lib/verification";
import { recomputeServiceMetrics } from "@/lib/metrics";
import type { Agent, Service } from "@/lib/types";
import { slugify, truncateAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

// POST /api/manifests
// Body: a single manifest, an array of manifests, or
//   { manifests: Manifest[] | Manifest, agent?: { handle, displayName, bio } }
// Validates each manifest, upserts the owning agent (keyed by payTo wallet),
// creates/updates the service, and runs the real verification pipeline.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const root = (body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {}) as Record<string, unknown>;
  const agentMeta = (root.agent as { handle?: string; displayName?: string; bio?: string } | undefined) ?? undefined;

  // Normalise input into a list of candidate manifests.
  let candidates: unknown[];
  if (Array.isArray(body)) candidates = body;
  else if (Array.isArray(root.manifests)) candidates = root.manifests as unknown[];
  else if (root.manifest) candidates = [root.manifest];
  else candidates = [body];

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No manifests provided" }, { status: 422 });
  }

  // Preview mode — validate + show detected agent/services WITHOUT saving or
  // running network verification. Used by the /manifest import page.
  if (root.validateOnly === true || root.preview === true) {
    const previews = candidates.map((candidate) => {
      const v = validateManifest(candidate);
      if (!v.ok || !v.manifest) return { ok: false as const, errors: v.errors };
      const m = v.manifest;
      return {
        ok: true as const,
        name: m.name,
        description: m.description,
        category: m.category,
        endpoint: m.endpoint,
        wallet: m.x402.payTo,
        network: m.x402.network,
        priceUsdc: Number(m.x402.maxAmountRequired) / 1_000_000,
      };
    });
    const wallets = Array.from(new Set(previews.filter((p) => p.ok).map((p) => (p as { wallet: string }).wallet)));
    const agentsExisting = await Promise.all(
      wallets.map(async (w) => ({ wallet: w, existing: !!(await getAgentByWallet(w)) }))
    );
    return NextResponse.json({
      validateOnly: true,
      valid: previews.every((p) => p.ok),
      services: previews,
      agents: agentsExisting,
    });
  }

  const results: Array<{
    ok: boolean;
    name?: string;
    serviceId?: string;
    slug?: string;
    status?: string;
    errors?: string[];
  }> = [];

  for (const candidate of candidates) {
    const v = validateManifest(candidate);
    if (!v.ok || !v.manifest) {
      results.push({ ok: false, errors: v.errors });
      continue;
    }
    const manifest = v.manifest;

    // Upsert the owning agent, keyed by the payTo wallet.
    const agent = await upsertAgent(manifest.x402.payTo, agentMeta);

    // Update an existing service for this endpoint, or create a new one.
    const existing = (await getServices()).find((s) => s.endpoint === manifest.endpoint);
    const service: Service = serviceFromManifest(manifest, {
      ownerAgentId: agent.id,
      source: existing?.source && existing.source !== "seed" ? existing.source : "manifest",
      existingId: existing?.id,
    });
    // Preserve any real history if updating.
    if (existing) {
      service.slug = existing.slug;
      service.healthChecks = existing.healthChecks;
      service.callLog = existing.callLog;
      service.settlements = existing.settlements;
      service.ownership = existing.ownership;
      service.createdAt = existing.createdAt;
      service.metrics = recomputeServiceMetrics(service);
    }

    // Real verification pass — result decides the stored status.
    const run = await runVerification({ serviceId: service.id, endpoint: service.endpoint, wallet: service.wallet });
    service.verificationHistory = [run, ...(existing?.verificationHistory ?? [])].slice(0, 20);
    service.verificationStatus = run.status;
    if (run.latencyMs) service.metrics.avgLatencyMs = service.metrics.avgLatencyMs || run.latencyMs;
    await saveService(service);

    // Link to the agent.
    if (!agent.serviceIds.includes(service.id)) {
      agent.serviceIds.unshift(service.id);
      agent.activity.unshift({
        id: `act_${Date.parse(service.updatedAt).toString(36)}_${results.length}`,
        type: "listed",
        message: `Published ${service.name} via manifest`,
        timestamp: service.updatedAt,
        serviceId: service.id,
      });
      await saveAgent(agent);
    }

    results.push({ ok: true, name: service.name, serviceId: service.id, slug: service.slug, status: run.status });
  }

  const ingested = results.filter((r) => r.ok).length;
  return NextResponse.json(
    { ingested, failed: results.length - ingested, results },
    { status: ingested > 0 ? 201 : 422 }
  );
}

async function upsertAgent(wallet: string, meta?: { handle?: string; displayName?: string; bio?: string }): Promise<Agent> {
  const existing = await getAgentByWallet(wallet);
  if (existing) {
    // Optionally refresh provided profile fields.
    if (meta?.displayName || meta?.bio) {
      return await saveAgent({
        ...existing,
        displayName: meta.displayName ?? existing.displayName,
        bio: meta.bio ?? existing.bio,
      });
    }
    return existing;
  }
  const now = new Date().toISOString();
  const handle = (meta?.handle && slugify(meta.handle)) || `agent-${wallet.slice(2, 8).toLowerCase()}`;
  // Avoid handle collisions.
  const uniqueHandle = await getAgentById(handle) ? `${handle}-${Date.parse(now).toString(36).slice(-4)}` : handle;
  const agent: Agent = {
    id: `agent_${uniqueHandle}`,
    handle: uniqueHandle,
    displayName: meta?.displayName || `Agent ${truncateAddress(wallet)}`,
    bio: meta?.bio || "Publishes x402 services on Base via the Tollbooth manifest API.",
    wallet,
    avatarColor: "from-indigo-500 to-blue-400",
    trustScore: 0,
    totalRevenueUsdc: 0,
    callsServed: 0,
    avgRating: 0,
    serviceIds: [],
    joinedAt: now,
    activity: [],
    walletVerified: false,
    demo: false,
    source: "manifest",
  };
  return await saveAgent(agent);
}
