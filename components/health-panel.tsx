"use client";

import * as React from "react";
import { Activity, Loader2, RefreshCw, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HealthCheck } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

interface HealthData {
  uptimePct: number;
  avgLatencyMs: number;
  lastCheckedAt: string | null;
  checks: HealthCheck[];
}

export function HealthPanel({ serviceId, initial }: { serviceId: string; initial: HealthData }) {
  const [data, setData] = React.useState<HealthData>(initial);
  const [probing, setProbing] = React.useState(false);

  async function probeNow() {
    setProbing(true);
    try {
      await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });
      const res = await fetch(`/api/health?serviceId=${encodeURIComponent(serviceId)}`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as HealthData);
    } catch {
      /* ignore — UI keeps prior data */
    } finally {
      setProbing(false);
    }
  }

  // Newest first from the API; show oldest→newest left→right.
  const bars = [...data.checks].slice(0, 40).reverse();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-blue-400" /> Uptime &amp; latency
        </CardTitle>
        <Button variant="outline" size="sm" onClick={probeNow} disabled={probing}>
          {probing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Probe now
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Uptime" value={data.checks.length ? `${data.uptimePct.toFixed(1)}%` : "—"} />
          <Stat label="Avg latency" value={data.avgLatencyMs ? `${data.avgLatencyMs}ms` : "—"} icon={<Timer className="size-3.5" />} />
          <Stat label="Checks" value={data.checks.length.toString()} />
        </div>

        {bars.length > 0 ? (
          <div>
            <div className="flex h-12 items-end gap-1">
              {bars.map((c) => (
                <div
                  key={c.id}
                  title={`${c.ok ? "up" : "down"} · HTTP ${c.status} · ${c.latencyMs}ms · ${timeAgo(c.timestamp)}`}
                  className={cn(
                    "flex-1 rounded-sm",
                    c.ok ? "bg-emerald-500/70" : "bg-red-500/70"
                  )}
                  style={{ height: `${Math.max(12, Math.min(100, c.ok ? 30 + Math.min(70, c.latencyMs / 20) : 100))}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{data.lastCheckedAt ? `Last checked ${timeAgo(data.lastCheckedAt)}` : "Not yet checked"}</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-emerald-500/70" /> up</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-red-500/70" /> down</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-sm text-muted-foreground">
            No health checks yet.{" "}
            <button onClick={probeNow} className="text-blue-400 hover:underline">
              Run the first probe
            </button>{" "}
            to start tracking real uptime.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/[0.03] py-2">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
    </div>
  );
}
