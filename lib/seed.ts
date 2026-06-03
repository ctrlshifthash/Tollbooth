import type { Agent, Service } from "./types";
import { getAppUrl, getPayTo, getEchoPrice } from "./x402-config";

// ---------------------------------------------------------------------------
// Initial data.
//
// NO demo / fake listings. The registry seeds ONLY the real, in-app x402
// endpoints this app actually hosts (/api/x402/echo, /hash, /uuid). Each one is
// a genuine payable service: pay USDC on Base via the CDP facilitator and get a
// real result back. They become "verified" only after a real paid replay
// passes. Everything else is added by real actions (List a Service, manifest
// import, or the discovery crawler).
// ---------------------------------------------------------------------------

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ZERO = "0x0000000000000000000000000000000000000000";
const now = new Date().toISOString();
const APP = getAppUrl();
const payTo = getPayTo() ?? ZERO;
const ECHO_PRICE_USDC = Number(getEchoPrice().replace(/[^0-9.]/g, "")) || 0.01;

const emptyMetrics = { uptimePct: 0, totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgLatencyMs: 0, reputationScore: 0 };

function inAppService(opts: {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: Service["category"];
  path: string;
  priceUsdc: number;
  inputSchema: unknown;
  outputSchema: unknown;
  tags: string[];
}): Service {
  return {
    id: opts.id,
    slug: opts.slug,
    name: opts.name,
    description: opts.description,
    category: opts.category,
    endpoint: `${APP}${opts.path}`,
    healthCheckUrl: `${APP}${opts.path}`,
    wallet: payTo,
    chain: "base",
    priceUsdc: opts.priceUsdc,
    asset: USDC_BASE,
    inputSchema: JSON.stringify(opts.inputSchema, null, 2),
    outputSchema: JSON.stringify(opts.outputSchema, null, 2),
    ownerAgentId: "agent_agent402",
    verificationStatus: "pending",
    metrics: { ...emptyMetrics },
    settlements: [],
    verificationHistory: [],
    tags: opts.tags,
    createdAt: now,
    updatedAt: now,
    demo: false,
    source: "seed",
    // Self-owned: the operator wallet is the payTo, so it's claimed by construction.
    ownership: { claimed: true, walletVerified: false, wallet: payTo },
    healthChecks: [],
    callLog: [],
  };
}

const echoService = inAppService({
  id: "svc_agent402_echo",
  slug: "agent402-echo",
  name: "Tollbooth Echo",
  description:
    "A real, in-app x402 endpoint. Pay in USDC on Base and it echoes your JSON payload back — the simplest way to exercise the full pay-and-call loop against the live CDP facilitator.",
  category: "tools",
  path: "/api/x402/echo",
  priceUsdc: ECHO_PRICE_USDC,
  inputSchema: { type: "object", description: "Any JSON object to echo", additionalProperties: true },
  outputSchema: { type: "object", properties: { service: { type: "string" }, echoed: {}, settledAt: { type: "string" } } },
  tags: ["x402", "echo", "live"],
});

const hashService = inAppService({
  id: "svc_agent402_hash",
  slug: "agent402-hash",
  name: "Tollbooth Hash",
  description:
    "Pay in USDC on Base to hash any input. Returns SHA-256 and Keccak-256 (Ethereum) digests — a real, useful compute service settled on-chain per call.",
  category: "compute",
  path: "/api/x402/hash",
  priceUsdc: 0.01,
  inputSchema: { type: "object", properties: { text: { type: "string", description: "Text to hash" } } },
  outputSchema: {
    type: "object",
    properties: { service: { type: "string" }, input: { type: "string" }, sha256: { type: "string" }, keccak256: { type: "string" } },
  },
  tags: ["x402", "hash", "sha256", "keccak256", "compute"],
});

const uuidService = inAppService({
  id: "svc_agent402_uuid",
  slug: "agent402-uuid",
  name: "Tollbooth UUID",
  description:
    "Pay in USDC on Base for a batch of cryptographically-random UUIDv4s (1–100 per call). A real micro-service settled on-chain — handy for agents that need collision-free IDs.",
  category: "tools",
  path: "/api/x402/uuid",
  priceUsdc: 0.01,
  inputSchema: { type: "object", properties: { count: { type: "number", minimum: 1, maximum: 100, description: "How many UUIDs" } } },
  outputSchema: { type: "object", properties: { service: { type: "string" }, count: { type: "number" }, uuids: { type: "array", items: { type: "string" } } } },
  tags: ["x402", "uuid", "ids", "tools"],
});

const LLM_PRICE_USDC = Number((process.env.X402_LLM_PRICE ?? "$0.02").replace(/[^0-9.]/g, "")) || 0.02;

const llmService = inAppService({
  id: "svc_agent402_llm",
  slug: "agent402-ai-chat",
  name: "Tollbooth AI Chat",
  description:
    "Pay-per-prompt LLM inference, settled in USDC on Base. Send a prompt, pick any model (GPT-4o, Claude 3.5, Gemini, Llama), get a completion. No account, no API key — just x402.",
  category: "ai-inference",
  path: "/api/x402/llm",
  priceUsdc: LLM_PRICE_USDC,
  inputSchema: { type: "object", properties: { prompt: { type: "string" }, model: { type: "string" }, system: { type: "string" } }, required: ["prompt"] },
  outputSchema: { type: "object", properties: { model: { type: "string" }, completion: { type: "string" }, usage: { type: "object" } } },
  tags: ["x402", "ai", "llm", "inference"],
});

const summarizeService = inAppService({
  id: "svc_agent402_summarize",
  slug: "agent402-summarize",
  name: "Tollbooth Summarize",
  description:
    "Pay in USDC on Base to condense any text into a tight summary. Useful for agents triaging long documents, threads, or transcripts per call.",
  category: "ai-inference",
  path: "/api/x402/summarize",
  priceUsdc: LLM_PRICE_USDC,
  inputSchema: { type: "object", properties: { text: { type: "string" }, model: { type: "string" } }, required: ["text"] },
  outputSchema: { type: "object", properties: { summary: { type: "string" }, model: { type: "string" } } },
  tags: ["x402", "ai", "summarize", "nlp"],
});

const translateService = inAppService({
  id: "svc_agent402_translate",
  slug: "agent402-translate",
  name: "Tollbooth Translate",
  description:
    "Pay in USDC on Base to translate text into any language. Send text + a target language, get the translation back — settled on-chain per call.",
  category: "ai-inference",
  path: "/api/x402/translate",
  priceUsdc: LLM_PRICE_USDC,
  inputSchema: { type: "object", properties: { text: { type: "string" }, to: { type: "string" }, model: { type: "string" } }, required: ["text"] },
  outputSchema: { type: "object", properties: { to: { type: "string" }, translation: { type: "string" } } },
  tags: ["x402", "ai", "translate", "nlp"],
});

const extractService = inAppService({
  id: "svc_agent402_extract",
  slug: "agent402-extract",
  name: "Tollbooth Extract",
  description:
    "Pay in USDC on Base to turn unstructured text into clean structured JSON. Give it raw text + what to pull; get machine-usable JSON back — built for agent pipelines.",
  category: "data",
  path: "/api/x402/extract",
  priceUsdc: LLM_PRICE_USDC,
  inputSchema: { type: "object", properties: { text: { type: "string" }, instructions: { type: "string" }, model: { type: "string" } }, required: ["text"] },
  outputSchema: { type: "object", properties: { data: { type: "object" } } },
  tags: ["x402", "ai", "extract", "structured", "data"],
});

// The operator profile that owns the in-app services. Wallet = X402_PAY_TO, so
// these listings show up in that wallet's dashboard immediately. Revenue / calls
// / trust accrue only from real settled activity — nothing is pre-filled.
const operatorAgent: Agent = {
  id: "agent_agent402",
  handle: "agent402",
  displayName: "Tollbooth Core",
  bio: "Operator of the in-app Tollbooth x402 services on Base (Echo, Hash, UUID). Every listing is a real, payable endpoint settled through the Coinbase CDP facilitator.",
  wallet: payTo,
  avatarColor: "from-blue-600 to-indigo-400",
  trustScore: 0,
  totalRevenueUsdc: 0,
  callsServed: 0,
  avgRating: 0,
  serviceIds: [
    llmService.id,
    summarizeService.id,
    translateService.id,
    extractService.id,
    echoService.id,
    hashService.id,
    uuidService.id,
  ],
  joinedAt: now,
  activity: [
    { id: "z1", type: "listed", message: "Listed Tollbooth AI Chat (pay-per-prompt LLM)", timestamp: now, serviceId: llmService.id },
    { id: "z2", type: "listed", message: "Listed Tollbooth Summarize", timestamp: now, serviceId: summarizeService.id },
    { id: "z3", type: "listed", message: "Listed Tollbooth Translate", timestamp: now, serviceId: translateService.id },
    { id: "z4", type: "listed", message: "Listed Tollbooth Extract", timestamp: now, serviceId: extractService.id },
  ],
  walletVerified: false,
  demo: false,
  source: "seed",
};

export const seedAgents: Agent[] = [operatorAgent];
export const seedServices: Service[] = [
  llmService,
  summarizeService,
  translateService,
  extractService,
  echoService,
  hashService,
  uuidService,
];
