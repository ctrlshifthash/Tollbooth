import "server-only";
import { randomBytes } from "node:crypto";
import type { CallRecord, Service, ServiceCategory } from "./types";
import { getServices, getServiceById, appendCallRecord } from "./store";
import { getPaymentKeyError, paidX402Fetch } from "./x402-payment";
import { extractSettlementTxHash } from "./utils";
import { runHermesAgent, type HermesStep } from "./hermes";

// ---------------------------------------------------------------------------
// x402 Router.
//
// The actual product: given a task (free-text query and/or category + budget),
// pick the best LIVE x402 service, execute a REAL paid call, and return the
// real result. Agents integrate this one endpoint instead of 96 services and
// get best-price routing + reliability + spend caps for free.
// ---------------------------------------------------------------------------

export interface RouteRequest {
  query?: string;
  category?: ServiceCategory | "any";
  serviceId?: string;
  maxPriceUsdc?: number;
  input?: unknown; // optional JSON body for POST-style services
  dryRun?: boolean; // select only, do not pay
}

export interface Candidate {
  id: string;
  slug: string;
  name: string;
  endpoint: string;
  priceUsdc: number;
  reputation: number;
  uptimePct: number;
  chain: string;
}

export interface RouteResult {
  ok: boolean;
  error?: string;
  selected?: Candidate;
  reason?: string;
  candidates: Candidate[];
  result?: unknown; // the real response body / answer
  txHash?: string | null;
  amountUsdc?: number;
  status?: number;
  latencyMs?: number;
  // Set when the task was fulfilled by the Hermes orchestrator.
  viaHermes?: boolean;
  hermes?: { model: string; answer: string; steps: HermesStep[]; spentUsdc: number };
}

function toCandidate(s: Service): Candidate {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    endpoint: s.endpoint,
    priceUsdc: s.priceUsdc,
    reputation: s.metrics.reputationScore,
    uptimePct: s.metrics.uptimePct,
    chain: s.chain,
  };
}

// Rank live, affordable, matching services by reputation then price.
export async function selectCandidates(req: RouteRequest): Promise<Service[]> {
  let services = await getServices();

  if (req.serviceId) {
    const direct = await getServiceById(req.serviceId);
    return direct ? [direct] : [];
  }

  // Only real services that actually speak x402 (have answered a 402) and were
  // up on their most recent probe, priced within budget.
  services = services.filter((s) => {
    const latest = s.healthChecks?.[0];
    const recentlyUp = !!latest && latest.ok;
    const speaksX402 = (s.healthChecks ?? []).some((c) => c.status === 402) || s.id === "svc_agent402_echo";
    const affordable = req.maxPriceUsdc == null || s.priceUsdc <= req.maxPriceUsdc;
    return recentlyUp && speaksX402 && affordable && s.priceUsdc >= 0;
  });

  if (req.category && req.category !== "any") {
    services = services.filter((s) => s.category === req.category);
  }

  const q = req.query?.trim().toLowerCase();
  const terms = q ? q.split(/\s+/).filter(Boolean) : [];

  // Score each service by how well it matches the query terms (name/endpoint
  // weighted higher than description). Then rank by: relevance → reputation → price.
  const scored = services.map((s) => {
    const strong = `${s.name} ${s.endpoint} ${s.tags.join(" ")}`.toLowerCase();
    const weak = s.description.toLowerCase();
    const score = terms.reduce((n, t) => n + (strong.includes(t) ? 2 : weak.includes(t) ? 1 : 0), 0);
    return { s, score };
  });

  const pool = q ? scored.filter((x) => x.score > 0) : scored;
  pool.sort(
    (a, b) =>
      b.score - a.score ||
      b.s.metrics.reputationScore - a.s.metrics.reputationScore ||
      a.s.priceUsdc - b.s.priceUsdc
  );
  return pool.map((x) => x.s);
}

export async function routeAndRun(req: RouteRequest): Promise<RouteResult> {
  const ranked = await selectCandidates(req);
  const candidates = ranked.slice(0, 6).map(toCandidate);
  const pick = ranked[0];
  const reason = pick
    ? `Selected for best reputation (${pick.metrics.reputationScore}) within budget at ${pick.priceUsdc} USDC; ${pick.metrics.uptimePct.toFixed(0)}% uptime.`
    : undefined;

  // Free "find best service" mode — selection only.
  if (req.dryRun) {
    if (!pick) return { ok: false, error: "No live x402 service matched the request. Try widening category/budget or running health checks.", candidates };
    return { ok: true, selected: toCandidate(pick), reason, candidates };
  }

  // Paid mode with a free-text task → Hermes orchestrates: it reads the task,
  // calls the right x402 tools to do the work, and returns the real answer.
  const goal = req.query?.trim();
  if (goal) {
    // The Router brain is Hermes — it reads the task and orchestrates x402 tools.
    const h = await runHermesAgent({ goal, model: "nousresearch/hermes-4-405b", maxSteps: 4, budgetUsdc: 0.1 });
    return {
      ok: h.ok,
      viaHermes: true,
      selected: pick ? toCandidate(pick) : undefined,
      reason,
      candidates,
      result: h.finalAnswer,
      hermes: { model: h.model, answer: h.finalAnswer, steps: h.steps, spentUsdc: h.spentUsdc },
      txHash: h.steps.find((s) => s.txHash)?.txHash ?? null,
      amountUsdc: h.spentUsdc,
      error: h.error,
    };
  }

  // No free-text task → fall back to a direct best-service call.
  if (!pick) {
    return { ok: false, error: "No live x402 service matched the request. Try widening category/budget or running health checks.", candidates };
  }

  const keyErr = getPaymentKeyError();
  if (keyErr) {
    return { ok: false, error: keyErr, selected: toCandidate(pick), reason, candidates };
  }

  // Execute the real paid call (GET — the x402 payer wraps the request).
  let paid;
  try {
    paid = await paidX402Fetch(pick.endpoint);
  } catch (e) {
    // record the failed paid attempt
    await recordCall(pick, false, 0, 0, undefined, e instanceof Error ? e.message : "payment failed");
    return { ok: false, error: e instanceof Error ? e.message : "Paid call failed", selected: toCandidate(pick), reason, candidates };
  }

  const txHash = extractSettlementTxHash(paid.paymentResponse);
  await recordCall(pick, paid.ok, paid.status, paid.latencyMs, txHash ?? undefined);

  // Parse JSON result if possible.
  let result: unknown = paid.bodyPreview;
  try {
    result = JSON.parse(paid.bodyPreview);
  } catch {
    /* keep as text */
  }

  return {
    ok: paid.ok,
    selected: toCandidate(pick),
    reason,
    candidates,
    result,
    txHash,
    amountUsdc: paid.ok ? pick.priceUsdc : undefined,
    status: paid.status,
    latencyMs: paid.latencyMs,
  };
}

async function recordCall(svc: Service, ok: boolean, status: number, latencyMs: number, txHash?: string, error?: string) {
  const rec: CallRecord = {
    id: `call_${svc.id}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    serviceId: svc.id,
    type: "payment",
    timestamp: new Date().toISOString(),
    paid: true,
    ok,
    status,
    latencyMs,
    amountUsdc: ok ? svc.priceUsdc : undefined,
    txHash,
    error,
  };
  await appendCallRecord(svc.id, rec);
}
