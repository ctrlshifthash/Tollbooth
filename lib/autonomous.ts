import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { AgentRun, AutonomousAgent, AutonomousStatus } from "./types";
import { getServiceById, appendCallRecord } from "./store";
import { paidX402Fetch, getPaymentKeyError } from "./x402-payment";
import { extractSettlementTxHash } from "./utils";

// ---------------------------------------------------------------------------
// Autonomous agent engine.
//
// Each agent is a saved runner that, on its own schedule, pays for and calls a
// target x402 service using the platform payer key (X402_EVM_PRIVATE_KEY) and
// records the real result. A budget (USDC) and optional call cap bound spend —
// once reached the agent flips to "exhausted" and stops. Every successful run
// also logs a real CallRecord against the target service, so the marketplace's
// uptime / calls / revenue reflect autonomous traffic too.
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.VERCEL ? "/tmp/data" : path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "autonomous.json");
const MIN_INTERVAL_SEC = 15;

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, "[]");
}
function readAll(): AutonomousAgent[] {
  ensure();
  return JSON.parse(fs.readFileSync(FILE, "utf8")) as AutonomousAgent[];
}
function writeAll(agents: AutonomousAgent[]) {
  fs.writeFileSync(FILE, JSON.stringify(agents, null, 2));
}

export function getAutonomousAgents(owner?: string): AutonomousAgent[] {
  const all = readAll();
  if (!owner) return all;
  const o = owner.toLowerCase();
  return all.filter((a) => a.ownerWallet.toLowerCase() === o);
}

export function getAutonomousAgent(id: string): AutonomousAgent | undefined {
  return readAll().find((a) => a.id === id);
}

export function saveAutonomousAgent(agent: AutonomousAgent): AutonomousAgent {
  const all = readAll();
  const i = all.findIndex((a) => a.id === agent.id);
  if (i >= 0) all[i] = agent;
  else all.unshift(agent);
  writeAll(all);
  return agent;
}

export function deleteAutonomousAgent(id: string) {
  writeAll(readAll().filter((a) => a.id !== id));
}

export interface CreateInput {
  name: string;
  ownerWallet: string;
  targetServiceId: string;
  intervalSec: number;
  maxCalls: number;
  budgetUsdc: number;
  prompt?: string;
  model?: string;
}

export function createAutonomousAgent(input: CreateInput): { ok: boolean; error?: string; agent?: AutonomousAgent } {
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.ownerWallet)) return { ok: false, error: "A valid owner wallet is required" };
  const svc = getServiceById(input.targetServiceId);
  if (!svc) return { ok: false, error: "Target service not found" };
  if (!(input.budgetUsdc > 0)) return { ok: false, error: "Set a budget greater than 0 USDC" };

  const now = new Date();
  const agent: AutonomousAgent = {
    id: `auto_${randomBytes(5).toString("hex")}`,
    name: input.name.trim() || `${svc.name} runner`,
    ownerWallet: input.ownerWallet,
    targetServiceId: svc.id,
    targetEndpoint: svc.endpoint,
    targetName: svc.name,
    priceUsdc: svc.priceUsdc,
    prompt: input.prompt?.trim() || undefined,
    model: input.model?.trim() || undefined,
    intervalSec: Math.max(MIN_INTERVAL_SEC, Math.floor(input.intervalSec) || 60),
    maxCalls: Math.max(0, Math.floor(input.maxCalls) || 0),
    budgetUsdc: input.budgetUsdc,
    status: "running",
    callsMade: 0,
    spentUsdc: 0,
    createdAt: now.toISOString(),
    nextRunAt: now.toISOString(), // eligible immediately
    runs: [],
  };
  return { ok: true, agent: saveAutonomousAgent(agent) };
}

// Pull the human-meaningful result out of a service response body for display.
function extractResultPreview(bodyPreview: string): string {
  try {
    const o = JSON.parse(bodyPreview) as Record<string, unknown>;
    for (const k of ["completion", "summary", "translation", "result"]) {
      if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).slice(0, 500);
    }
    if (o.data !== undefined) return JSON.stringify(o.data).slice(0, 500);
    if (o.echoed !== undefined) return JSON.stringify(o.echoed).slice(0, 500);
    if (Array.isArray(o.uuids)) return (o.uuids as string[]).join(", ").slice(0, 500);
    if (typeof o.sha256 === "string") return `sha256: ${o.sha256}`;
  } catch {
    /* not JSON */
  }
  return bodyPreview.slice(0, 500);
}

// Would the next paid call exceed the budget or call cap?
function limitsReached(a: AutonomousAgent): boolean {
  if (a.maxCalls > 0 && a.callsMade >= a.maxCalls) return true;
  if (a.budgetUsdc > 0 && a.spentUsdc + a.priceUsdc > a.budgetUsdc + 1e-9) return true;
  return false;
}

// Execute exactly one paid call for an agent (if it's due/eligible).
export async function runAgentOnce(id: string): Promise<AutonomousAgent | undefined> {
  const a = getAutonomousAgent(id);
  if (!a) return undefined;
  if (a.status !== "running") return a;
  if (limitsReached(a)) {
    a.status = "exhausted";
    return saveAutonomousAgent(a);
  }

  const run: AgentRun = {
    id: `run_${randomBytes(4).toString("hex")}`,
    timestamp: new Date().toISOString(),
    ok: false,
    status: 0,
    amountUsdc: 0,
  };

  const keyErr = getPaymentKeyError();
  if (keyErr) {
    run.error = keyErr;
    a.status = "paused"; // can't pay — pause rather than spin
  } else {
    try {
      // If the agent has a task prompt, POST it; the AI service fulfils it.
      const body = a.prompt ? { prompt: a.prompt, text: a.prompt, model: a.model } : undefined;
      const paid = await paidX402Fetch(a.targetEndpoint, body ? { body } : undefined);
      const txHash = extractSettlementTxHash(paid.paymentResponse) ?? undefined;
      run.ok = paid.ok;
      run.status = paid.status;
      run.txHash = txHash;
      run.resultPreview = extractResultPreview(paid.bodyPreview);
      if (paid.ok) {
        run.amountUsdc = a.priceUsdc;
        a.spentUsdc = Math.round((a.spentUsdc + a.priceUsdc) * 1e6) / 1e6;
        a.callsMade += 1;
        // Reflect this autonomous call in the target service's real metrics.
        appendCallRecord(a.targetServiceId, {
          id: `call_${randomBytes(4).toString("hex")}`,
          serviceId: a.targetServiceId,
          type: "payment",
          timestamp: run.timestamp,
          paid: true,
          ok: true,
          status: paid.status,
          latencyMs: paid.latencyMs,
          amountUsdc: a.priceUsdc,
          txHash,
        });
      } else {
        run.error = `Paid call returned HTTP ${paid.status}`;
      }
    } catch (e) {
      run.error = e instanceof Error ? e.message : "Paid call failed";
    }
  }

  a.runs = [run, ...a.runs].slice(0, 100);
  a.lastRunAt = run.timestamp;
  a.nextRunAt = new Date(Date.now() + a.intervalSec * 1000).toISOString();
  if (limitsReached(a)) a.status = "exhausted";
  return saveAutonomousAgent(a);
}

// Run every agent whose nextRunAt is due. Driven by the page poll or the
// scripts/agent-runner.mjs worker / a cron hitting POST /api/autonomous/tick.
export async function tickDueAgents(): Promise<{ ran: number; agents: AutonomousAgent[] }> {
  const due = readAll().filter((a) => a.status === "running" && Date.parse(a.nextRunAt) <= Date.now());
  const agents: AutonomousAgent[] = [];
  for (const a of due) {
    const r = await runAgentOnce(a.id);
    if (r) agents.push(r);
  }
  return { ran: agents.length, agents };
}

export function setStatus(id: string, status: AutonomousStatus): AutonomousAgent | undefined {
  const a = getAutonomousAgent(id);
  if (!a) return undefined;
  // Don't silently resurrect an exhausted budget.
  if (status === "running" && a.budgetUsdc > 0 && a.spentUsdc + a.priceUsdc > a.budgetUsdc + 1e-9) {
    a.status = "exhausted";
    return saveAutonomousAgent(a);
  }
  a.status = status;
  if (status === "running") a.nextRunAt = new Date().toISOString();
  return saveAutonomousAgent(a);
}
