import { NextResponse } from "next/server";
import { getServices, saveService, getAgentById, saveAgent, upsertAgentByWallet } from "@/lib/store";
import { runVerification } from "@/lib/verification";
import type { Service, ServiceCategory } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { computeReputation, isValidEthAddress, isValidUrl, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/services
// Optional query filters: ?category=&verified=true&chain=&q=&minUptime=&maxPrice=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let services = await getServices();

  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const chain = searchParams.get("chain");
  const verified = searchParams.get("verified");
  const q = searchParams.get("q")?.toLowerCase();
  const minUptime = Number(searchParams.get("minUptime") ?? "0");
  const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
  const sort = searchParams.get("sort") ?? "reputation";

  if (category && category !== "all") services = services.filter((s) => s.category === category);
  if (status && status !== "all") services = services.filter((s) => s.verificationStatus === status);
  if (chain && chain !== "all") services = services.filter((s) => s.chain === chain);
  if (verified === "true") services = services.filter((s) => s.verificationStatus === "verified");
  if (minUptime > 0) services = services.filter((s) => s.metrics.uptimePct >= minUptime);
  if (maxPrice !== undefined) services = services.filter((s) => s.priceUsdc <= maxPrice);
  if (q) {
    services = services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  services = [...services].sort((a, b) => {
    switch (sort) {
      case "price":
        return a.priceUsdc - b.priceUsdc;
      case "uptime":
        return b.metrics.uptimePct - a.metrics.uptimePct;
      case "calls":
        return b.metrics.totalCalls - a.metrics.totalCalls;
      case "newest":
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      default:
        return b.metrics.reputationScore - a.metrics.reputationScore;
    }
  });

  return NextResponse.json({ services, count: services.length });
}

// POST /api/services
// Registers a new x402 service, then runs the verification pipeline immediately.
// The verification RESULT determines the stored status — never the input.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const endpoint = String(body.endpoint ?? "").trim();
  const wallet = String(body.wallet ?? "").trim();
  const category = String(body.category ?? "tools") as ServiceCategory;
  const priceUsdc = Number(body.priceUsdc ?? 0);
  const description = String(body.description ?? "").trim();
  const chain = (body.chain === "base-sepolia" ? "base-sepolia" : "base") as Service["chain"];

  // ---- Validation ----
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Service name is required";
  if (!isValidUrl(endpoint)) errors.endpoint = "A valid http(s) endpoint URL is required";
  if (!isValidEthAddress(wallet)) errors.wallet = "A valid 0x wallet address is required";
  if (!CATEGORIES.some((c) => c.value === category)) errors.category = "Unknown category";
  if (!(priceUsdc >= 0)) errors.priceUsdc = "Price must be a non-negative number";
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "Validation failed", errors }, { status: 422 });
  }

  // The wallet (payTo) IS the owner. Find or create that wallet's agent profile
  // so the new service is owned by the lister and shows in their dashboard.
  const agentMeta =
    body.agent && typeof body.agent === "object"
      ? (body.agent as { handle?: string; displayName?: string; bio?: string })
      : undefined;
  const ownerAgent = await upsertAgentByWallet(wallet, agentMeta);

  const now = new Date().toISOString();
  const id = `svc_${slugify(name)}_${Date.parse(now).toString(36)}`;
  const usdcBase = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const usdcSepolia = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  const service: Service = {
    id,
    slug: slugify(name) || id,
    name,
    description: description || `${name} — an x402 paid service.`,
    category,
    endpoint,
    wallet,
    chain,
    priceUsdc,
    asset: chain === "base-sepolia" ? usdcSepolia : usdcBase,
    inputSchema: typeof body.inputSchema === "string" ? body.inputSchema : JSON.stringify(body.inputSchema ?? {}, null, 2),
    outputSchema: typeof body.outputSchema === "string" ? body.outputSchema : JSON.stringify(body.outputSchema ?? {}, null, 2),
    ownerAgentId: ownerAgent.id,
    // Start unverified; the run below decides the real status.
    verificationStatus: "pending",
    metrics: { uptimePct: 0, totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0, reputationScore: 0 },
    settlements: [],
    verificationHistory: [],
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
    createdAt: now,
    updatedAt: now,
    // Real submission (not demo). Provenance + empty live history + unclaimed.
    demo: false,
    source: "submission",
    healthCheckUrl: typeof body.healthCheckUrl === "string" && body.healthCheckUrl ? body.healthCheckUrl : undefined,
    ownership: { claimed: true, walletVerified: false, wallet },
    healthChecks: [],
    callLog: [],
  };

  // ---- Real verification pass ----
  const run = await runVerification({ serviceId: service.id, endpoint, wallet });
  service.verificationHistory = [run];
  service.verificationStatus = run.status;
  if (run.latencyMs) service.metrics.avgLatencyMs = run.latencyMs;
  service.metrics.reputationScore = computeReputation({
    uptimePct: service.metrics.uptimePct,
    successfulCalls: 0,
    failedCalls: 0,
    totalCalls: 0,
    verified: run.status === "verified",
  });

  await saveService(service);

  // Link the service to its owner agent (default agent for browser submissions).
  const owner = await getAgentById(service.ownerAgentId);
  if (owner && !owner.serviceIds.includes(service.id)) {
    owner.serviceIds.unshift(service.id);
    owner.activity.unshift({
      id: `act_${Date.parse(now).toString(36)}`,
      type: "listed",
      message: `Listed ${service.name}`,
      timestamp: now,
      serviceId: service.id,
    });
    await saveAgent(owner);
  }

  return NextResponse.json({ service, verification: run }, { status: 201 });
}
