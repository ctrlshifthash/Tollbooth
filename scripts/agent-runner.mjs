#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Autonomous agent runner for Tollbooth.
//
// Calls POST /api/autonomous/tick on a loop, which executes every agent whose
// next call is due — paying for and calling its target x402 service on-chain.
// Spend is bounded by each agent's budget + interval; this just provides the
// heartbeat so agents keep running when no browser tab is open.
//
// Usage:
//   node scripts/agent-runner.mjs                  # tick every 10s vs localhost
//   AGENT402_URL=https://your.app node scripts/agent-runner.mjs
//   INTERVAL_MS=15000 node scripts/agent-runner.mjs
//   CRON_SECRET=... node scripts/agent-runner.mjs  # send the auth header
//
// Or wire POST /api/autonomous/tick into a real cron (Vercel Cron, etc.).
// ---------------------------------------------------------------------------

const BASE = (process.env.AGENT402_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 10000);

async function tick() {
  const headers = { "Content-Type": "application/json" };
  if (SECRET) headers["Authorization"] = `Bearer ${SECRET}`;
  try {
    const res = await fetch(`${BASE}/api/autonomous/tick`, { method: "POST", headers, body: "{}" });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[agent-runner] HTTP ${res.status}:`, data.error ?? data);
      return;
    }
    if (data.ran > 0) {
      console.log(`[agent-runner] ${new Date().toISOString()} ran ${data.ran} agent(s)`);
    }
  } catch (e) {
    console.error("[agent-runner] request failed:", e.message);
  }
}

await tick();
console.log(`[agent-runner] looping every ${INTERVAL_MS}ms against ${BASE} — Ctrl+C to stop`);
setInterval(tick, INTERVAL_MS);
