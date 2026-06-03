import type { DiscoverySource, Service, Chain } from "./types";
import { parsePaymentRequirements } from "./verification";
import { isValidEthAddress, isValidUrl, slugify } from "./utils";

// ---------------------------------------------------------------------------
// Discovery crawler.
//
// Source adapters surface candidate x402 endpoints. Every candidate URL is
// PROBED for real — only endpoints that actually return a 402 with parseable
// x402 payment requirements become discovered listings. Discovered services
// start unclaimed + unverified; an owner later proves the wallet via signature.
//
// Adapters:
//   - manual:    a caller-supplied URL list (fully real)
//   - github:    GitHub repo search for x402 projects (real API; probes homepages)
//   - farcaster: Farcaster / Base ecosystem import (PLACEHOLDER — returns none)
//   - virtuals:  Virtuals agent profile import (PLACEHOLDER — returns none)
// ---------------------------------------------------------------------------

export interface CrawlInput {
  manual?: string[];
  github?: { query?: string; limit?: number } | boolean;
  farcaster?: boolean;
  virtuals?: boolean;
}

export interface AdapterReport {
  source: DiscoverySource;
  scanned: number;
  discovered: number;
  placeholder?: boolean;
  note?: string;
}

export interface CrawlResult {
  discovered: Service[];
  reports: AdapterReport[];
}

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Probe a single URL; return a discovered Service draft only if it's a real
// x402 endpoint (402 + parseable requirements). Otherwise null. Never fabricated.
async function discoverFromUrl(url: string, source: DiscoverySource, discoveryUrl?: string): Promise<Service | null> {
  if (!isValidUrl(url)) return null;
  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "Tollbooth-Crawler/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
  } catch {
    return null;
  }
  if (res.status !== 402) return null;
  const req = await parsePaymentRequirements(res);
  if (!req) return null;

  const network = (req.network === "base-sepolia" || req.network === "base" ? req.network : "base") as Chain;
  const wallet = req.payTo && isValidEthAddress(req.payTo) ? req.payTo : "";
  const priceUsdc = req.maxAmountRequired ? Number(req.maxAmountRequired) / 1_000_000 : 0;
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  const name = req.description?.slice(0, 60) || host;
  const now = new Date().toISOString();
  const slug = slugify(name) || `disc-${Date.parse(now).toString(36)}`;

  return {
    id: `svc_${slug}_${Date.parse(now).toString(36)}`,
    slug,
    name,
    description: req.description || `Discovered x402 endpoint at ${host}. Unclaimed — owner can verify the wallet.`,
    category: "tools",
    endpoint: url,
    wallet,
    chain: network,
    priceUsdc,
    asset: req.asset || (network === "base" ? USDC_BASE : USDC_BASE_SEPOLIA),
    inputSchema: "{}",
    outputSchema: "{}",
    ownerAgentId: "", // unclaimed — no owner until a wallet signature proves it
    verificationStatus: "unverified",
    metrics: { uptimePct: 0, totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0, reputationScore: 0 },
    settlements: [],
    verificationHistory: [],
    tags: ["discovered", source],
    createdAt: now,
    updatedAt: now,
    demo: false,
    source,
    discoveryUrl: discoveryUrl ?? url,
    ownership: { claimed: false, walletVerified: false },
    healthChecks: [],
    callLog: [],
  };
}

async function manualAdapter(urls: string[]): Promise<{ services: Service[]; report: AdapterReport }> {
  const services: Service[] = [];
  for (const url of urls) {
    const svc = await discoverFromUrl(url.trim(), "manual");
    if (svc) services.push(svc);
  }
  return { services, report: { source: "manual", scanned: urls.length, discovered: services.length } };
}

// Real GitHub repo search. Finds repos mentioning x402 and probes their
// `homepage` URL for a live 402. Uses the public API (unauthenticated unless
// GITHUB_TOKEN is set, which raises rate limits).
async function githubAdapter(query: string, limit: number): Promise<{ services: Service[]; report: AdapterReport }> {
  const services: Service[] = [];
  let scanned = 0;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Tollbooth-Crawler/1.0",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const q = encodeURIComponent(query || "x402 base agent");
    const res = await fetch(`https://api.github.com/search/repositories?q=${q}&per_page=${Math.min(limit, 20)}`, {
      headers,
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { items?: Array<{ homepage?: string; html_url?: string }> };
      const items = data.items ?? [];
      for (const item of items) {
        scanned++;
        if (item.homepage && isValidUrl(item.homepage)) {
          const svc = await discoverFromUrl(item.homepage, "github", item.html_url);
          if (svc) services.push(svc);
        }
      }
    }
  } catch {
    // network/rate-limit — report zero discoveries rather than fail the crawl
  }
  return {
    services,
    report: {
      source: "github",
      scanned,
      discovered: services.length,
      note: services.length === 0 ? "No repo homepages exposed a live x402 endpoint." : undefined,
    },
  };
}

export async function runCrawl(input: CrawlInput): Promise<CrawlResult> {
  const discovered: Service[] = [];
  const reports: AdapterReport[] = [];

  if (input.manual && input.manual.length) {
    const { services, report } = await manualAdapter(input.manual);
    discovered.push(...services);
    reports.push(report);
  }

  if (input.github) {
    const cfg = typeof input.github === "object" ? input.github : {};
    const { services, report } = await githubAdapter(cfg.query ?? "x402 base agent", cfg.limit ?? 10);
    discovered.push(...services);
    reports.push(report);
  }

  // Placeholders — clearly reported as not-yet-implemented, never faked.
  if (input.farcaster) {
    reports.push({
      source: "farcaster",
      scanned: 0,
      discovered: 0,
      placeholder: true,
      note: "Farcaster / Base ecosystem import is a placeholder. Wire a Farcaster API key + frame/cast scanner here.",
    });
  }
  if (input.virtuals) {
    reports.push({
      source: "virtuals",
      scanned: 0,
      discovered: 0,
      placeholder: true,
      note: "Virtuals profile import is a placeholder. Wire the Virtuals agent registry API here.",
    });
  }

  return { discovered, reports };
}
