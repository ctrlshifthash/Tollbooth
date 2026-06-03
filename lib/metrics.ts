import type { Agent, Service, ServiceMetrics } from "./types";
import { computeReputation } from "./utils";

// ---------------------------------------------------------------------------
// Live metric derivation.
//
// All numbers here come from REAL records — HealthChecks and CallRecords that
// the app actually produced — never from seed values. Demo services keep their
// illustrative seed metrics only until the first real check/call arrives.
// ---------------------------------------------------------------------------

export const HISTORY_CAP = 250;

export function recomputeServiceMetrics(service: Service): ServiceMetrics {
  const checks = service.healthChecks ?? [];
  const calls = service.callLog ?? [];

  // Uptime = share of health probes that were "up".
  const uptimePct = checks.length ? (checks.filter((c) => c.ok).length / checks.length) * 100 : 0;

  // Latency averaged across successful probes and successful calls.
  const latencies = [
    ...checks.filter((c) => c.ok && c.latencyMs > 0).map((c) => c.latencyMs),
    ...calls.filter((c) => c.ok && c.latencyMs > 0).map((c) => c.latencyMs),
  ];
  const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  const successfulCalls = calls.filter((c) => c.ok).length;
  const failedCalls = calls.filter((c) => !c.ok).length;
  const totalCalls = calls.length;

  const verified = service.verificationStatus === "verified";
  const reputationScore = computeReputation({ uptimePct, successfulCalls, failedCalls, totalCalls, verified });

  return {
    uptimePct: Math.round(uptimePct * 100) / 100,
    totalCalls,
    successfulCalls,
    failedCalls,
    avgLatencyMs,
    reputationScore,
  };
}

// Whether a service has any real telemetry yet (vs. demo/seed numbers).
export function hasLiveData(service: Service): boolean {
  return (service.healthChecks?.length ?? 0) > 0 || (service.callLog?.length ?? 0) > 0;
}

// Recompute an agent's aggregates from the REAL call logs of its services.
export function recomputeAgentAggregates(agent: Agent, services: Service[]): Partial<Agent> {
  const owned = services.filter((s) => agent.serviceIds.includes(s.id));
  const live = owned.filter((s) => !s.demo || hasLiveData(s));

  // Revenue from real settled payments only.
  const totalRevenueUsdc = owned
    .flatMap((s) => s.callLog ?? [])
    .filter((c) => c.paid && c.ok && typeof c.amountUsdc === "number")
    .reduce((sum, c) => sum + (c.amountUsdc ?? 0), 0);

  // Calls served from real ok call records.
  const callsServed = owned.flatMap((s) => s.callLog ?? []).filter((c) => c.ok).length;

  // Trust = mean reputation of services with live data (else 0).
  const trustScore =
    live.length > 0 ? Math.round(live.reduce((a, s) => a + s.metrics.reputationScore, 0) / live.length) : 0;

  return { totalRevenueUsdc, callsServed, trustScore };
}
