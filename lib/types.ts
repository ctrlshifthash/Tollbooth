// Core domain types for Tollbooth.
// These shapes are the contract between the data store, API routes, and UI.
// Replacing the JSON store with a real DB only requires matching these types.

export type ServiceCategory =
  | "ai-inference"
  | "data"
  | "search"
  | "compute"
  | "media"
  | "finance"
  | "tools"
  | "storage";

export const CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: "ai-inference", label: "AI Inference" },
  { value: "data", label: "Data & APIs" },
  { value: "search", label: "Search" },
  { value: "compute", label: "Compute" },
  { value: "media", label: "Media & Vision" },
  { value: "finance", label: "Finance" },
  { value: "tools", label: "Agent Tools" },
  { value: "storage", label: "Storage" },
];

// Verification lifecycle. We never mark `verified` unless every check passes.
export type VerificationStatus = "verified" | "pending" | "failed" | "unverified";

export type Chain = "base" | "base-sepolia";

// A single step within a verification run.
export type VerificationStepId =
  | "endpoint_reachable"
  | "returns_402"
  | "payment_requirements_parsed"
  | "wallet_valid"
  | "payment_prepared"
  | "settlement_verified"
  | "valid_response";

export interface VerificationStep {
  id: VerificationStepId;
  label: string;
  status: "pass" | "fail" | "skipped" | "pending";
  detail?: string;
  // Optional raw evidence captured during the run (headers, status codes, etc.)
  evidence?: Record<string, unknown>;
}

export interface VerificationRun {
  id: string;
  serviceId: string;
  createdAt: string; // ISO timestamp
  status: VerificationStatus;
  steps: VerificationStep[];
  // Summary of what the verifier observed.
  httpStatus?: number;
  latencyMs?: number;
  // Parsed x402 payment requirement, if present.
  paymentRequirement?: PaymentRequirement | null;
  error?: string;
}

// Parsed representation of an x402 "402 Payment Required" challenge.
// Mirrors the shape of the x402 `accepts` payment requirement objects.
export interface PaymentRequirement {
  scheme: string; // e.g. "exact"
  network: string; // e.g. "base" | "base-sepolia"
  maxAmountRequired?: string; // atomic units of the asset (USDC = 6 decimals)
  asset?: string; // token contract address (USDC on Base)
  payTo?: string; // recipient wallet
  resource?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
}

export interface SettlementTx {
  hash: string;
  amountUsdc: number;
  timestamp: string;
  status: "success" | "failed";
}

export interface ServiceMetrics {
  uptimePct: number; // 0-100
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgLatencyMs: number;
  // Reputation score 0-100 derived from uptime, success rate, verification, volume.
  reputationScore: number;
}

// Where a listing came from. Used to mark provenance and demo data honestly.
export type DiscoverySource =
  | "seed" // the real in-app echo endpoint shipped with the app
  | "submission" // submitted via the List form
  | "manifest" // ingested via POST /api/manifests
  | "bazaar" // imported from the live Coinbase x402 Bazaar discovery network
  | "github" // discovered by the GitHub crawler adapter
  | "farcaster" // discovered by the Farcaster/Base adapter (placeholder)
  | "virtuals" // discovered by the Virtuals adapter (placeholder)
  | "manual"; // discovered by the manual URL-list adapter

// Proof that a wallet controls a listing — only `walletVerified` after a real
// signature check passes (lib/claim.ts). Never set to true without a signature.
export interface WalletOwnership {
  claimed: boolean;
  walletVerified: boolean;
  wallet?: string; // the wallet that proved control
  verifiedAt?: string;
  method?: "eip191-signature";
}

// A single uptime/health probe result.
export interface HealthCheck {
  id: string;
  serviceId: string;
  timestamp: string;
  // "up" means reachable AND speaking a valid contract (2xx or a 402 challenge).
  ok: boolean;
  status: number; // HTTP status; 0 when unreachable
  latencyMs: number;
  error?: string;
}

export type CallType = "test" | "payment" | "verification";

// A real call/payment attempt against a service. Drives live metrics.
export interface CallRecord {
  id: string;
  serviceId: string;
  type: CallType;
  timestamp: string;
  paid: boolean; // whether an on-chain payment was actually attempted
  ok: boolean;
  status: number;
  latencyMs: number;
  amountUsdc?: number;
  txHash?: string; // real settlement tx hash, when the facilitator returns one
  error?: string;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ServiceCategory;
  endpoint: string;
  // Optional dedicated health-check URL; falls back to `endpoint` when absent.
  healthCheckUrl?: string;
  wallet: string; // owner / payTo wallet (0x...)
  chain: Chain;
  // Price per call in USDC.
  priceUsdc: number;
  asset: string; // token address (USDC)
  inputSchema: string; // JSON schema or shape, stored as string
  outputSchema: string;
  ownerAgentId: string;
  verificationStatus: VerificationStatus;
  metrics: ServiceMetrics;
  settlements: SettlementTx[];
  verificationHistory: VerificationRun[];
  tags: string[];
  createdAt: string;
  updatedAt: string;

  // --- provenance & honesty ---
  demo?: boolean; // illustrative seed data, not independently verified
  source: DiscoverySource;
  discoveryUrl?: string; // where a crawler found it

  // --- ownership proof ---
  ownership: WalletOwnership;

  // --- live monitoring & reputation inputs (real data only) ---
  healthChecks: HealthCheck[];
  callLog: CallRecord[];
  lastCheckedAt?: string;
}

export interface Agent {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  wallet: string;
  avatarColor: string; // gradient seed for generated avatar
  // Aggregate reputation across all services this agent operates.
  trustScore: number; // 0-100
  totalRevenueUsdc: number;
  callsServed: number;
  avgRating: number; // 0-5
  serviceIds: string[];
  joinedAt: string;
  activity: ActivityEvent[];
  // True only after the agent proves control of `wallet` via signature.
  walletVerified?: boolean;
  demo?: boolean;
  source?: DiscoverySource;
}

// A pending wallet-ownership challenge. The owner signs `message` (which embeds
// `nonce`) with `wallet`; the server verifies the signature before granting
// ownership. Nonces are single-use and time-boxed.
export interface NonceChallenge {
  id: string; // `${serviceId}:${wallet}`
  serviceId: string;
  wallet: string;
  nonce: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

export interface ActivityEvent {
  id: string;
  type: "listed" | "verified" | "settlement" | "call" | "review";
  message: string;
  timestamp: string;
  serviceId?: string;
}

// ---------------------------------------------------------------------------
// Autonomous agents.
//
// A saved runner that pays for and calls a target x402 service on its own, on a
// fixed interval, until its USDC budget (or call cap) is exhausted. It pays with
// the platform's server payer key — that's how a headless agent transacts on
// x402 without a human signing each call. The budget is a hard ceiling.
// ---------------------------------------------------------------------------
export type AutonomousStatus = "running" | "paused" | "exhausted" | "stopped";

export interface AgentRun {
  id: string;
  timestamp: string;
  ok: boolean;
  status: number; // HTTP status of the paid call
  amountUsdc: number; // USDC spent on this run (0 if it failed)
  txHash?: string; // real on-chain settlement hash, when returned
  resultPreview?: string;
  error?: string;
}

export interface AutonomousAgent {
  id: string;
  name: string;
  ownerWallet: string; // the wallet that created/owns this runner
  targetServiceId: string;
  targetEndpoint: string;
  targetName: string;
  priceUsdc: number; // cost per call (from the target service)
  // The task the agent runs each call. For AI services this is the prompt sent
  // to the endpoint; empty for parameterless services (hash/uuid/echo).
  prompt?: string;
  model?: string;
  intervalSec: number; // seconds between calls
  maxCalls: number; // 0 = unlimited (still bounded by budget)
  budgetUsdc: number; // hard cap on total spend
  status: AutonomousStatus;
  callsMade: number;
  spentUsdc: number;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt: string;
  runs: AgentRun[];
}

// ---------------------------------------------------------------------------
// Marketplace.
//
// Sellers list things their agents do — an x402 API/service, an agent profile,
// or an autonomous-agent automation — for a one-time price. Buyers pay in USDC
// on Base via x402; the payment settles to the SELLER's wallet, and the buyer
// receives the deliverable (shown on their dashboard).
// ---------------------------------------------------------------------------
export type ListingType = "service" | "agent" | "automation" | "other";

// What the buyer receives on purchase. `kind` drives how the dashboard renders
// and what "deploy" action (if any) is offered.
export interface Deliverable {
  kind: "service-access" | "agent-template" | "automation-template" | "content";
  // Free-form payload: endpoint + manifest, an agent config, an automation
  // config (targetServiceId/prompt/model/interval/budget), or arbitrary content.
  data: Record<string, unknown>;
  note?: string;
}

export interface MarketplaceListing {
  id: string;
  type: ListingType;
  title: string;
  description: string;
  category: ServiceCategory;
  priceUsdc: number;
  sellerWallet: string; // receives the USDC settlement
  sellerAgentId?: string;
  serviceId?: string; // when listing an existing owned service
  deliverable: Deliverable;
  sales: number;
  revenueUsdc: number;
  createdAt: string;
  active: boolean;
  // Seeded sample listings shown for social proof — not purchasable (so nobody
  // pays real USDC to a wallet the "seller" doesn't control). Real user listings
  // have demo unset/false and buy normally.
  demo?: boolean;
}

export interface Purchase {
  id: string;
  listingId: string;
  title: string;
  type: ListingType;
  buyerWallet: string;
  sellerWallet: string;
  amountUsdc: number;
  txHash?: string;
  deliverable: Deliverable;
  timestamp: string;
}

// Service manifest — the portable JSON descriptor an agent can publish/copy.
export interface ServiceManifest {
  schema: "agent402/manifest@1";
  name: string;
  description: string;
  category: ServiceCategory;
  endpoint: string;
  x402: {
    network: Chain;
    scheme: "exact";
    asset: string;
    payTo: string;
    maxAmountRequired: string;
  };
  input: unknown;
  output: unknown;
}
