import type { Service, ServiceManifest, ServiceCategory, DiscoverySource, Chain } from "./types";
import { CATEGORIES } from "./types";
import { isValidEthAddress, isValidUrl, slugify } from "./utils";

// ---------------------------------------------------------------------------
// Service manifest validation + ingestion.
//
// A manifest is the portable `agent402/manifest@1` descriptor. We validate it
// strictly before creating a Service. One agent can publish many services by
// posting multiple manifests (or an array) under the same wallet.
// ---------------------------------------------------------------------------

export interface ManifestValidation {
  ok: boolean;
  errors: string[];
  manifest?: ServiceManifest;
}

const VALID_NETWORKS: Chain[] = ["base", "base-sepolia"];

export function validateManifest(input: unknown): ManifestValidation {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Manifest must be a JSON object"] };
  }
  const m = input as Record<string, unknown>;

  if (m.schema !== "agent402/manifest@1") {
    errors.push('Field "schema" must be "agent402/manifest@1"');
  }
  if (typeof m.name !== "string" || !m.name.trim()) errors.push('Field "name" is required');
  if (typeof m.endpoint !== "string" || !isValidUrl(m.endpoint)) {
    errors.push('Field "endpoint" must be a valid http(s) URL');
  }
  const category = m.category as ServiceCategory;
  if (!CATEGORIES.some((c) => c.value === category)) {
    errors.push(`Field "category" must be one of: ${CATEGORIES.map((c) => c.value).join(", ")}`);
  }

  const x = m.x402 as Record<string, unknown> | undefined;
  if (!x || typeof x !== "object") {
    errors.push('Field "x402" object is required');
  } else {
    if (x.scheme !== "exact") errors.push('x402.scheme must be "exact"');
    if (!VALID_NETWORKS.includes(x.network as Chain)) {
      errors.push(`x402.network must be one of: ${VALID_NETWORKS.join(", ")}`);
    }
    if (typeof x.payTo !== "string" || !isValidEthAddress(x.payTo)) {
      errors.push("x402.payTo must be a valid 0x wallet address");
    }
    if (typeof x.asset !== "string" || !isValidEthAddress(x.asset)) {
      errors.push("x402.asset must be a valid token contract address");
    }
    if (typeof x.maxAmountRequired !== "string" || !/^\d+$/.test(String(x.maxAmountRequired))) {
      errors.push("x402.maxAmountRequired must be an atomic-unit integer string");
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], manifest: input as ServiceManifest };
}

// USDC has 6 decimals — convert atomic units to a display price.
function atomicToUsdc(atomic: string): number {
  const n = Number(atomic);
  return Number.isFinite(n) ? n / 1_000_000 : 0;
}

// Build a Service from a validated manifest. `source` lets the crawler reuse this.
export function serviceFromManifest(
  manifest: ServiceManifest,
  opts: { ownerAgentId: string; source?: DiscoverySource; discoveryUrl?: string; existingId?: string }
): Service {
  const now = new Date().toISOString();
  const slug = slugify(manifest.name) || `svc-${Date.parse(now).toString(36)}`;
  return {
    id: opts.existingId ?? `svc_${slug}_${Date.parse(now).toString(36)}`,
    slug,
    name: manifest.name,
    description: manifest.description || `${manifest.name} — an x402 paid service.`,
    category: manifest.category,
    endpoint: manifest.endpoint,
    wallet: manifest.x402.payTo,
    chain: manifest.x402.network,
    priceUsdc: atomicToUsdc(manifest.x402.maxAmountRequired),
    asset: manifest.x402.asset,
    inputSchema: JSON.stringify(manifest.input ?? {}, null, 2),
    outputSchema: JSON.stringify(manifest.output ?? {}, null, 2),
    ownerAgentId: opts.ownerAgentId,
    verificationStatus: "pending",
    metrics: { uptimePct: 0, totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0, reputationScore: 0 },
    settlements: [],
    verificationHistory: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    demo: false,
    source: opts.source ?? "manifest",
    discoveryUrl: opts.discoveryUrl,
    ownership: { claimed: false, walletVerified: false },
    healthChecks: [],
    callLog: [],
  };
}
