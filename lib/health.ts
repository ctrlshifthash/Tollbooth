import "server-only";
import { randomBytes } from "node:crypto";
import type { HealthCheck, Service } from "./types";
import { getServices, getServiceById, appendHealthCheck } from "./store";

// ---------------------------------------------------------------------------
// Uptime monitoring.
//
// Probes a service's health-check URL (or its endpoint) and records a real
// HealthCheck. "up" = reachable AND returning a sane contract: any 2xx OR a 402
// challenge (the correct response for an unpaid x402 resource). 5xx / network
// errors / unexpected codes count as down. Drives uptimePct + latency history.
// ---------------------------------------------------------------------------

function isHealthy(status: number): boolean {
  return status === 402 || (status >= 200 && status < 300);
}

export async function probeService(service: Service): Promise<HealthCheck> {
  const url = service.healthCheckUrl || service.endpoint;
  const id = `hc_${service.id}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "Tollbooth-Monitor/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - started;
    return {
      id,
      serviceId: service.id,
      timestamp: new Date().toISOString(),
      ok: isHealthy(res.status),
      status: res.status,
      latencyMs,
      error: isHealthy(res.status) ? undefined : `Unexpected status ${res.status}`,
    };
  } catch (e) {
    return {
      id,
      serviceId: service.id,
      timestamp: new Date().toISOString(),
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

// Probe one service and persist the result (updates live metrics).
export async function checkService(serviceId: string): Promise<HealthCheck | null> {
  const svc = await getServiceById(serviceId);
  if (!svc) return null;
  const check = await probeService(svc);
  await appendHealthCheck(svc.id, check);
  return check;
}

// Probe every non-demo service (used by the scheduled probe route/script).
// Demo seed listings are skipped so we never invent uptime for fake endpoints.
export async function checkAllServices(opts: { includeDemo?: boolean } = {}): Promise<HealthCheck[]> {
  const services = (await getServices()).filter((s) => opts.includeDemo || !s.demo);
  const results: HealthCheck[] = [];
  // Sequential to stay gentle on rate limits; the set is small.
  for (const svc of services) {
    const check = await probeService(svc);
    await appendHealthCheck(svc.id, check);
    results.push(check);
  }
  return results;
}
