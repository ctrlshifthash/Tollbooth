import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Agent, CallRecord, HealthCheck, NonceChallenge, Service, WalletOwnership } from "./types";
import { seedAgents, seedServices } from "./seed";
import { recomputeServiceMetrics, recomputeAgentAggregates, HISTORY_CAP } from "./metrics";
import { slugify, truncateAddress } from "./utils";

// ---------------------------------------------------------------------------
// Local JSON data store.
//
// Seeds from lib/seed.ts on first run and writes mutations to /data/*.json.
// Every read/write goes through here, so swapping in Postgres/Prisma/SQLite
// later means re-implementing these functions only.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const SERVICES_FILE = path.join(DATA_DIR, "services.json");
const AGENTS_FILE = path.join(DATA_DIR, "agents.json");
const NONCES_FILE = path.join(DATA_DIR, "nonces.json");

function ensureSeeded() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SERVICES_FILE)) fs.writeFileSync(SERVICES_FILE, JSON.stringify(seedServices, null, 2));
  if (!fs.existsSync(AGENTS_FILE)) fs.writeFileSync(AGENTS_FILE, JSON.stringify(seedAgents, null, 2));
  if (!fs.existsSync(NONCES_FILE)) fs.writeFileSync(NONCES_FILE, JSON.stringify([], null, 2));
}

function readJson<T>(file: string): T {
  ensureSeeded();
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Backfill defaults so older/partial records always satisfy the current shape.
function normalizeService(s: Service): Service {
  return {
    ...s,
    source: s.source ?? "seed",
    ownership: s.ownership ?? { claimed: false, walletVerified: false },
    healthChecks: s.healthChecks ?? [],
    callLog: s.callLog ?? [],
  };
}

// ---- Services -------------------------------------------------------------

export function getServices(): Service[] {
  return readJson<Service[]>(SERVICES_FILE).map(normalizeService);
}

export function getServiceById(id: string): Service | undefined {
  return getServices().find((s) => s.id === id || s.slug === id);
}

export function saveService(service: Service): Service {
  const services = getServices();
  const idx = services.findIndex((s) => s.id === service.id);
  if (idx >= 0) services[idx] = service;
  else services.unshift(service);
  writeJson(SERVICES_FILE, services);
  return service;
}

export function replaceServices(services: Service[]) {
  writeJson(SERVICES_FILE, services);
}

// ---- Health checks --------------------------------------------------------

// Append a real probe result and recompute live metrics + lastCheckedAt.
export function appendHealthCheck(serviceId: string, check: HealthCheck): Service | undefined {
  const svc = getServiceById(serviceId);
  if (!svc) return undefined;
  svc.healthChecks = [check, ...(svc.healthChecks ?? [])].slice(0, HISTORY_CAP);
  svc.lastCheckedAt = check.timestamp;
  svc.metrics = recomputeServiceMetrics(svc);
  svc.updatedAt = check.timestamp;
  // Real data has arrived — it's no longer just demo.
  if (svc.demo) svc.demo = false;
  saveService(svc);
  refreshAgentForService(svc);
  return svc;
}

// ---- Call / payment records ----------------------------------------------

export function appendCallRecord(serviceId: string, rec: CallRecord): Service | undefined {
  const svc = getServiceById(serviceId);
  if (!svc) return undefined;
  svc.callLog = [rec, ...(svc.callLog ?? [])].slice(0, HISTORY_CAP);
  // Real, settled payment → record a real settlement with its tx hash.
  if (rec.paid && rec.ok && rec.txHash) {
    svc.settlements = [
      { hash: rec.txHash, amountUsdc: rec.amountUsdc ?? svc.priceUsdc, timestamp: rec.timestamp, status: "success" as const },
      ...svc.settlements,
    ].slice(0, 50);
  }
  svc.metrics = recomputeServiceMetrics(svc);
  svc.updatedAt = rec.timestamp;
  if (svc.demo) svc.demo = false;
  saveService(svc);
  refreshAgentForService(svc);
  return svc;
}

// ---- Ownership ------------------------------------------------------------

export function setServiceOwnership(serviceId: string, ownership: WalletOwnership): Service | undefined {
  const svc = getServiceById(serviceId);
  if (!svc) return undefined;
  svc.ownership = ownership;
  svc.updatedAt = new Date().toISOString();
  saveService(svc);
  return svc;
}

// ---- Agents ---------------------------------------------------------------

export function getAgents(): Agent[] {
  return readJson<Agent[]>(AGENTS_FILE);
}

export function getAgentById(id: string): Agent | undefined {
  return getAgents().find((a) => a.id === id || a.handle === id);
}

export function getAgentByWallet(wallet: string): Agent | undefined {
  const w = wallet.toLowerCase();
  return getAgents().find((a) => a.wallet.toLowerCase() === w);
}

export function saveAgent(agent: Agent): Agent {
  const agents = getAgents();
  const idx = agents.findIndex((a) => a.id === agent.id);
  if (idx >= 0) agents[idx] = agent;
  else agents.unshift(agent);
  writeJson(AGENTS_FILE, agents);
  return agent;
}

// Find or create an agent (operator profile) keyed by its wallet. This is how a
// connected wallet becomes a first-class agent: listing a service or importing a
// manifest from a new wallet creates that wallet's agent automatically. Optional
// meta lets the owner brand the profile (handle / display name / bio).
export function upsertAgentByWallet(
  wallet: string,
  meta?: { handle?: string; displayName?: string; bio?: string }
): Agent {
  const existing = getAgentByWallet(wallet);
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
  const uniqueHandle = getAgentById(baseHandle) ? `${baseHandle}-${Date.parse(nowIso).toString(36).slice(-4)}` : baseHandle;
  const agent: Agent = {
    id: `agent_${uniqueHandle}`,
    handle: uniqueHandle,
    displayName: meta?.displayName?.trim() || `Agent ${truncateAddress(wallet)}`,
    bio: meta?.bio?.trim() || "x402 service operator on Base.",
    wallet,
    avatarColor: "from-indigo-500 to-blue-400",
    trustScore: 0,
    totalRevenueUsdc: 0,
    callsServed: 0,
    avgRating: 0,
    serviceIds: [],
    joinedAt: nowIso,
    activity: [],
    walletVerified: false,
    demo: false,
    source: "submission",
  };
  return saveAgent(agent);
}

// All agents owned by a wallet (a wallet can own unlimited agents).
export function getAgentsByWallet(wallet: string): Agent[] {
  const w = wallet.toLowerCase();
  return getAgents().filter((a) => a.wallet.toLowerCase() === w);
}

// Always create a NEW agent owned by `wallet` (no upsert) — wallets can have
// any number of agents. Handle is made unique.
export function createAgent(input: { wallet: string; handle?: string; displayName?: string; bio?: string }): Agent {
  const nowIso = new Date().toISOString();
  const base = (input.handle && slugify(input.handle)) || `agent-${input.wallet.slice(2, 8).toLowerCase()}`;
  let handle = base;
  let n = 2;
  while (getAgentById(handle)) handle = `${base}-${n++}`; // ensure uniqueness
  const agent: Agent = {
    id: `agent_${handle}`,
    handle,
    displayName: input.displayName?.trim() || `Agent ${truncateAddress(input.wallet)}`,
    bio: input.bio?.trim() || "x402 agent on Base.",
    wallet: input.wallet,
    avatarColor: "from-indigo-500 to-blue-400",
    trustScore: 0,
    totalRevenueUsdc: 0,
    callsServed: 0,
    avgRating: 0,
    serviceIds: [],
    joinedAt: nowIso,
    activity: [],
    walletVerified: false,
    demo: false,
    source: "submission",
  };
  return saveAgent(agent);
}

// Recompute an owner agent's real aggregates after its service data changes.
function refreshAgentForService(service: Service) {
  const agent = getAgentById(service.ownerAgentId);
  if (!agent || agent.demo) return; // never overwrite demo agent showcase numbers
  const updated = recomputeAgentAggregates(agent, getServices());
  saveAgent({ ...agent, ...updated });
}

// ---- Nonce challenges (wallet ownership proof) ----------------------------

export function getNonces(): NonceChallenge[] {
  return readJson<NonceChallenge[]>(NONCES_FILE);
}

export function saveNonce(challenge: NonceChallenge) {
  const nonces = getNonces().filter((n) => n.id !== challenge.id);
  nonces.unshift(challenge);
  writeJson(NONCES_FILE, nonces.slice(0, 200));
}

export function getNonce(serviceId: string, wallet: string): NonceChallenge | undefined {
  const id = `${serviceId}:${wallet.toLowerCase()}`;
  return getNonces().find((n) => n.id === id);
}

export function deleteNonce(serviceId: string, wallet: string) {
  const id = `${serviceId}:${wallet.toLowerCase()}`;
  writeJson(NONCES_FILE, getNonces().filter((n) => n.id !== id));
}
