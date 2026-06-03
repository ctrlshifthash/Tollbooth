import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Service, ServiceManifest, Chain } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 0x + 40 hex chars.
export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function truncateAddress(addr: string, lead = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= lead + tail) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function formatUsdc(amount: number): string {
  if (amount === 0) return "$0";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

// Reputation score (0-100). Pure function so the formula is transparent and
// can be recomputed deterministically from raw metrics.
export function computeReputation(input: {
  uptimePct: number;
  successfulCalls: number;
  failedCalls: number;
  totalCalls: number;
  verified: boolean;
}): number {
  const { uptimePct, successfulCalls, failedCalls, totalCalls, verified } = input;
  const successRate = totalCalls > 0 ? successfulCalls / (successfulCalls + failedCalls) : 0;
  // Volume confidence — saturates around ~100k calls.
  const volume = Math.min(1, Math.log10(totalCalls + 1) / 5);
  const verifiedBonus = verified ? 1 : 0.4;
  const raw = (uptimePct / 100) * 0.4 + successRate * 0.4 + volume * 0.2;
  return Math.round(raw * 100 * verifiedBonus);
}

export function reputationTier(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Elite", color: "text-emerald-400" };
  if (score >= 75) return { label: "Trusted", color: "text-blue-400" };
  if (score >= 50) return { label: "Established", color: "text-amber-400" };
  if (score > 0) return { label: "Emerging", color: "text-orange-400" };
  return { label: "Unrated", color: "text-muted-foreground" };
}

// Build a portable service manifest from a stored service.
export function toManifest(service: Service): ServiceManifest {
  const parse = (s: string): unknown => {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  };
  // USDC has 6 decimals — convert the display price to atomic units.
  const atomic = Math.round(service.priceUsdc * 1_000_000).toString();
  return {
    schema: "agent402/manifest@1",
    name: service.name,
    description: service.description,
    category: service.category,
    endpoint: service.endpoint,
    x402: {
      network: service.chain as Chain,
      scheme: "exact",
      asset: service.asset,
      payTo: service.wallet,
      maxAmountRequired: atomic,
    },
    input: parse(service.inputSchema),
    output: parse(service.outputSchema),
  };
}

// Pull a real on-chain tx hash out of a decoded x402 payment response.
// Returns null unless it finds a 0x-prefixed 32-byte hash — we never invent one.
export function extractSettlementTxHash(paymentResponse: unknown): string | null {
  if (!paymentResponse || typeof paymentResponse !== "object") return null;
  const o = paymentResponse as Record<string, unknown>;
  const candidates = [o.transaction, o.txHash, o.transactionHash, o.hash, o.tx];
  for (const c of candidates) {
    if (typeof c === "string" && /^0x[0-9a-fA-F]{64}$/.test(c)) return c;
  }
  return null;
}

export function explorerTxUrl(chain: "base" | "base-sepolia", hash: string): string {
  const base = chain === "base" ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";
  return base + hash;
}

export function explorerAddressUrl(chain: "base" | "base-sepolia", address: string): string {
  const base = chain === "base" ? "https://basescan.org/address/" : "https://sepolia.basescan.org/address/";
  return base + address;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
