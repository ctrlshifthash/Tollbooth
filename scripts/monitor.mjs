#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Scheduled uptime prober for Tollbooth.
//
// Calls POST /api/health to probe every non-demo service and persist real
// HealthCheck records (which update uptime / latency / reputation).
//
// Usage:
//   node scripts/monitor.mjs                 # one pass against localhost:3000
//   AGENT402_URL=https://your.app node scripts/monitor.mjs
//   INTERVAL_MS=60000 node scripts/monitor.mjs   # loop every 60s
//   CRON_SECRET=... node scripts/monitor.mjs      # send the auth header
//
// Or wire POST /api/health into a real cron (Vercel Cron, GitHub Actions, etc.).
// ---------------------------------------------------------------------------

const BASE = (process.env.AGENT402_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 0);

async function runOnce() {
  const headers = { "Content-Type": "application/json" };
  if (SECRET) headers["Authorization"] = `Bearer ${SECRET}`;
  try {
    const res = await fetch(`${BASE}/api/health`, { method: "POST", headers, body: "{}" });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[monitor] HTTP ${res.status}:`, data.error ?? data);
      return;
    }
    console.log(
      `[monitor] ${new Date().toISOString()} checked=${data.checked} up=${data.up} down=${data.down}`
    );
  } catch (e) {
    console.error("[monitor] request failed:", e.message);
  }
}

await runOnce();
if (INTERVAL_MS > 0) {
  console.log(`[monitor] looping every ${INTERVAL_MS}ms — Ctrl+C to stop`);
  setInterval(runOnce, INTERVAL_MS);
}
