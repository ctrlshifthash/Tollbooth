import "server-only";
import { createAuthHeader } from "@coinbase/x402";
import type { Agent, Service, ServiceCategory } from "./types";
import { getServices, saveService, getAgentByWallet, saveAgent, getAgentById } from "./store";
import { isValidEthAddress, slugify, truncateAddress } from "./utils";

// ---------------------------------------------------------------------------
// x402 Bazaar import.
//
// Pulls the REAL list of registered x402 resources from Coinbase's CDP
// discovery network (GET /platform/v2/x402/discovery/resources) and lists the
// Base-mainnet ones. These are genuine live endpoints — not demo data. They are
// imported as `unverified` + `unclaimed`; verification and health checks run
// against them for real afterwards.
// ---------------------------------------------------------------------------

const HOST = "api.cdp.coinbase.com";
const PATH = "/platform/v2/x402/discovery/resources";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

interface BazaarAccept {
  amount?: string;
  asset?: string;
  network?: string;
  payTo?: string;
  scheme?: string;
}
interface BazaarItem {
  resource?: string;
  description?: string;
  type?: string;
  lastUpdated?: string | number;
  accepts?: BazaarAccept[];
}

export function getBazaarError(): string | null {
  if (!process.env.CDP_API_KEY_ID?.trim() || !process.env.CDP_API_KEY_SECRET?.trim()) {
    return "Set CDP_API_KEY_ID and CDP_API_KEY_SECRET to import from the x402 Bazaar.";
  }
  return null;
}

async function fetchBazaar(): Promise<BazaarItem[]> {
  const jwt = await createAuthHeader(
    process.env.CDP_API_KEY_ID!.trim(),
    process.env.CDP_API_KEY_SECRET!.trim(),
    "GET",
    HOST,
    PATH
  );
  const res = await fetch(`https://${HOST}${PATH}`, {
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bazaar discovery returned ${res.status}`);
  const data = (await res.json()) as { items?: BazaarItem[] };
  return data.items ?? [];
}

function categorize(url: string, description: string): ServiceCategory {
  const s = `${url} ${description}`.toLowerCase();
  if (/(news|data|chain|block|balance|price|market|feed|weather)/.test(s)) return "data";
  if (/(search|query|grounding)/.test(s)) return "search";
  if (/(image|vision|ocr|video|media|audio|tts|stt)/.test(s)) return "media";
  if (/(llm|ai|infer|gpt|model|prompt|chat|embedding|completion)/.test(s)) return "ai-inference";
  if (/(swap|trade|defi|finance|usd|token|wallet|pay)/.test(s)) return "finance";
  if (/(compute|render|gpu|exec)/.test(s)) return "compute";
  if (/(storage|file|upload|ipfs)/.test(s)) return "storage";
  return "tools";
}

function nameFrom(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const pretty = last
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    const host = u.host.replace(/^www\./, "");
    return pretty ? `${pretty} · ${host}` : host;
  } catch {
    return url.slice(0, 60);
  }
}

function serviceFromBazaar(item: BazaarItem, existingId?: string): Service | null {
  const url = item.resource;
  if (!url) return null;
  const base = (item.accepts ?? []).find((a) => a.network === "eip155:8453" && a.scheme === "exact");
  if (!base || !base.payTo || !isValidEthAddress(base.payTo)) return null;

  const now = new Date().toISOString();
  const name = nameFrom(url);
  const slug = `${slugify(name)}-${Date.parse(now).toString(36).slice(-4)}`;
  const priceUsdc = base.amount ? Number(base.amount) / 1_000_000 : 0;

  return {
    id: existingId ?? `svc_${slug}`,
    slug,
    name,
    description: item.description?.slice(0, 240) || `Live x402 endpoint discovered via the Coinbase x402 Bazaar.`,
    category: categorize(url, item.description ?? ""),
    endpoint: url,
    wallet: base.payTo,
    chain: "base",
    priceUsdc,
    asset: base.asset && isValidEthAddress(base.asset) ? base.asset : USDC_BASE,
    inputSchema: "{}",
    outputSchema: "{}",
    ownerAgentId: "", // set by upsertAgent below
    verificationStatus: "unverified",
    metrics: { uptimePct: 0, totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0, reputationScore: 0 },
    settlements: [],
    verificationHistory: [],
    tags: ["bazaar", "x402"],
    createdAt: now,
    updatedAt: now,
    demo: false,
    source: "bazaar",
    discoveryUrl: `https://${HOST}${PATH}`,
    ownership: { claimed: false, walletVerified: false },
    healthChecks: [],
    callLog: [],
  };
}

async function upsertAgent(wallet: string): Promise<Agent> {
  const existing = await getAgentByWallet(wallet);
  if (existing) return existing;
  const now = new Date().toISOString();
  const handle = `agent-${wallet.slice(2, 8).toLowerCase()}`;
  const uniqueHandle = (await getAgentById(handle)) ? `${handle}-${Date.parse(now).toString(36).slice(-4)}` : handle;
  return saveAgent({
    id: `agent_${uniqueHandle}`,
    handle: uniqueHandle,
    displayName: `Operator ${truncateAddress(wallet)}`,
    bio: "x402 service operator discovered via the Coinbase x402 Bazaar.",
    wallet,
    avatarColor: "from-blue-600 to-blue-400",
    trustScore: 0,
    totalRevenueUsdc: 0,
    callsServed: 0,
    avgRating: 0,
    serviceIds: [],
    joinedAt: now,
    activity: [],
    walletVerified: false,
    demo: false,
    source: "bazaar",
  });
}

export interface BazaarSyncResult {
  fetched: number;
  baseServices: number;
  imported: number;
  skippedExisting: number;
  agents: number;
}

// Fetch the Bazaar and persist new Base services + their owner agents.
export async function syncBazaar(limit = 100): Promise<BazaarSyncResult> {
  const err = getBazaarError();
  if (err) throw new Error(err);

  const items = await fetchBazaar();
  const existingByEndpoint = new Map((await getServices()).map((s) => [s.endpoint, s.id]));
  const baseItems = items.filter((it) => (it.accepts ?? []).some((a) => a.network === "eip155:8453"));

  let imported = 0;
  let skipped = 0;
  const touchedAgents = new Set<string>();
  const seen = new Set<string>();

  for (const item of baseItems.slice(0, limit)) {
    const url = item.resource;
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const existingId = existingByEndpoint.get(url);
    if (existingId) {
      skipped++;
      continue;
    }

    const svc = serviceFromBazaar(item);
    if (!svc) continue;

    const agent = await upsertAgent(svc.wallet);
    svc.ownerAgentId = agent.id;
    await saveService(svc);

    if (!agent.serviceIds.includes(svc.id)) {
      agent.serviceIds.unshift(svc.id);
      await saveAgent(agent);
    }
    touchedAgents.add(agent.id);
    imported++;
  }

  return {
    fetched: items.length,
    baseServices: baseItems.length,
    imported,
    skippedExisting: skipped,
    agents: touchedAgents.size,
  };
}
