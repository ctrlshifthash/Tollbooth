import "server-only";
import type { Agent, CallRecord, HealthCheck, NonceChallenge, Service, WalletOwnership } from "./types";
import { seedAgents, seedServices } from "./seed";
import { recomputeServiceMetrics, recomputeAgentAggregates, HISTORY_CAP } from "./metrics";
import { slugify, truncateAddress } from "./utils";
import { kvGet, kvSet } from "./db";

// ---------------------------------------------------------------------------
// Data store (Postgres KV via lib/db).
//
// Each collection is one JSONB row: "services", "agents", "nonces". Seeds from
// lib/seed.ts the first time a collection is read. Async throughout — callers
// await. Swapping the backend means re-implementing lib/db only.
// ---------------------------------------------------------------------------

function normalizeService(s: Service): Service {
  return {
    ...s,
    source: s.source ?? "seed",
    ownership: s.ownership ?? { claimed: false, walletVerified: false },
    healthChecks: s.healthChecks ?? [],
    callLog: s.callLog ?? [],
  };
}

// Read a collection, seeding it on first access.
async function readServices(): Promise<Service[]> {
  const v = await kvGet<Service[] | null>("services", null);
  if (v === null) {
    await kvSet("services", seedServices);
    return seedServices.map(normalizeService);
  }
  return v.map(normalizeService);
}
async function readAgents(): Promise<Agent[]> {
  const v = await kvGet<Agent[] | null>("agents", null);
  if (v === null) {
    await kvSet("agents", seedAgents);
    return seedAgents;
  }
  return v;
}

// ---- Services -------------------------------------------------------------

export async function getServices(): Promise<Service[]> {
  return readServices();
}

export async function getServiceById(id: string): Promise<Service | undefined> {
  return (await readServices()).find((s) => s.id === id || s.slug === id);
}

export async function saveService(service: Service): Promise<Service> {
  const services = await readServices();
  const idx = services.findIndex((s) => s.id === service.id);
  if (idx >= 0) services[idx] = service;
  else services.unshift(service);
  await kvSet("services", services);
  return service;
}

export async function replaceServices(services: Service[]): Promise<void> {
  await kvSet("services", services);
}

// ---- Health checks --------------------------------------------------------

export async function appendHealthCheck(serviceId: string, check: HealthCheck): Promise<Service | undefined> {
  const svc = await getServiceById(serviceId);
  if (!svc) return undefined;
  svc.healthChecks = [check, ...(svc.healthChecks ?? [])].slice(0, HISTORY_CAP);
  svc.lastCheckedAt = check.timestamp;
  svc.metrics = recomputeServiceMetrics(svc);
  svc.updatedAt = check.timestamp;
  if (svc.demo) svc.demo = false;
  await saveService(svc);
  await refreshAgentForService(svc);
  return svc;
}

// ---- Call / payment records ----------------------------------------------

export async function appendCallRecord(serviceId: string, rec: CallRecord): Promise<Service | undefined> {
  const svc = await getServiceById(serviceId);
  if (!svc) return undefined;
  svc.callLog = [rec, ...(svc.callLog ?? [])].slice(0, HISTORY_CAP);
  if (rec.paid && rec.ok && rec.txHash) {
    svc.settlements = [
      { hash: rec.txHash, amountUsdc: rec.amountUsdc ?? svc.priceUsdc, timestamp: rec.timestamp, status: "success" as const },
      ...svc.settlements,
    ].slice(0, 50);
  }
  svc.metrics = recomputeServiceMetrics(svc);
  svc.updatedAt = rec.timestamp;
  if (svc.demo) svc.demo = false;
  await saveService(svc);
  await refreshAgentForService(svc);
  return svc;
}

// ---- Ownership ------------------------------------------------------------

export async function setServiceOwnership(serviceId: string, ownership: WalletOwnership): Promise<Service | undefined> {
  const svc = await getServiceById(serviceId);
  if (!svc) return undefined;
  svc.ownership = ownership;
  svc.updatedAt = new Date().toISOString();
  await saveService(svc);
  return svc;
}

// ---- Agents ---------------------------------------------------------------

export async function getAgents(): Promise<Agent[]> {
  return readAgents();
}

export async function getAgentById(id: string): Promise<Agent | undefined> {
  return (await readAgents()).find((a) => a.id === id || a.handle === id);
}

export async function getAgentByWallet(wallet: string): Promise<Agent | undefined> {
  const w = wallet.toLowerCase();
  return (await readAgents()).find((a) => a.wallet.toLowerCase() === w);
}

export async function saveAgent(agent: Agent): Promise<Agent> {
  const agents = await readAgents();
  const idx = agents.findIndex((a) => a.id === agent.id);
  if (idx >= 0) agents[idx] = agent;
  else agents.unshift(agent);
  await kvSet("agents", agents);
  return agent;
}

export async function getAgentsByWallet(wallet: string): Promise<Agent[]> {
  const w = wallet.toLowerCase();
  return (await readAgents()).filter((a) => a.wallet.toLowerCase() === w);
}

// Find or create an agent keyed by wallet (used by List a Service / manifests).
export async function upsertAgentByWallet(
  wallet: string,
  meta?: { handle?: string; displayName?: string; bio?: string }
): Promise<Agent> {
  const agents = await readAgents();
  const w = wallet.toLowerCase();
  const existing = agents.find((a) => a.wallet.toLowerCase() === w);
  if (existing) {
    if (meta?.displayName || meta?.bio || meta?.handle) {
      return saveAgent({
        ...existing,
        displayName: meta.displayName?.trim() || existing.displayName,
        bio: meta.bio?.trim() || existing.bio,
      });
    }
    return existing;
  }
  const nowIso = new Date().toISOString();
  const baseHandle = (meta?.handle && slugify(meta.handle)) || `agent-${wallet.slice(2, 8).toLowerCase()}`;
  const taken = (h: string) => agents.some((a) => a.id === h || a.handle === h);
  const uniqueHandle = taken(baseHandle) ? `${baseHandle}-${Date.parse(nowIso).toString(36).slice(-4)}` : baseHandle;
  return saveAgent(newAgent(wallet, uniqueHandle, meta?.displayName, meta?.bio));
}

// Always create a NEW agent owned by `wallet` (no upsert) — unlimited per wallet.
export async function createAgent(input: { wallet: string; handle?: string; displayName?: string; bio?: string }): Promise<Agent> {
  const agents = await readAgents();
  const base = (input.handle && slugify(input.handle)) || `agent-${input.wallet.slice(2, 8).toLowerCase()}`;
  let handle = base;
  let n = 2;
  const taken = (h: string) => agents.some((a) => a.id === `agent_${h}` || a.handle === h);
  while (taken(handle)) handle = `${base}-${n++}`;
  return saveAgent(newAgent(input.wallet, handle, input.displayName, input.bio));
}

function newAgent(wallet: string, handle: string, displayName?: string, bio?: string): Agent {
  return {
    id: `agent_${handle}`,
    handle,
    displayName: displayName?.trim() || `Agent ${truncateAddress(wallet)}`,
    bio: bio?.trim() || "x402 agent on Base.",
    wallet,
    avatarColor: "from-indigo-500 to-blue-400",
    trustScore: 0,
    totalRevenueUsdc: 0,
    callsServed: 0,
    avgRating: 0,
    serviceIds: [],
    joinedAt: new Date().toISOString(),
    activity: [],
    walletVerified: false,
    demo: false,
    source: "submission",
  };
}

// Recompute an owner agent's real aggregates after its service data changes.
async function refreshAgentForService(service: Service): Promise<void> {
  const agent = await getAgentById(service.ownerAgentId);
  if (!agent || agent.demo) return;
  const updated = recomputeAgentAggregates(agent, await getServices());
  await saveAgent({ ...agent, ...updated });
}

// ---- Nonce challenges (wallet ownership proof) ----------------------------

export async function getNonces(): Promise<NonceChallenge[]> {
  return kvGet<NonceChallenge[]>("nonces", []);
}

export async function saveNonce(challenge: NonceChallenge): Promise<void> {
  const nonces = (await getNonces()).filter((n) => n.id !== challenge.id);
  nonces.unshift(challenge);
  await kvSet("nonces", nonces.slice(0, 200));
}

export async function getNonce(serviceId: string, wallet: string): Promise<NonceChallenge | undefined> {
  const id = `${serviceId}:${wallet.toLowerCase()}`;
  return (await getNonces()).find((n) => n.id === id);
}

export async function deleteNonce(serviceId: string, wallet: string): Promise<void> {
  const id = `${serviceId}:${wallet.toLowerCase()}`;
  await kvSet(
    "nonces",
    (await getNonces()).filter((n) => n.id !== id)
  );
}
