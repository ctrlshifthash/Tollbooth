"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  Loader2,
  RefreshCw,
  Timer,
  Server,
  XCircle,
  CheckCircle2,
  Gauge,
  ExternalLink,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import type { HealthCheck, VerificationStatus } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

interface SummaryRow {
  id: string;
  slug: string;
  name: string;
  chain: "base" | "base-sepolia";
  demo: boolean;
  status: VerificationStatus;
  uptimePct: number;
  avgLatencyMs: number;
  lastCheckedAt: string | null;
  checkCount: number;
  failedChecks: number;
}
interface Detail {
  id: string;
  slug: string;
  name: string;
  endpoint: string;
  healthCheckUrl: string | null;
  demo: boolean;
  status: VerificationStatus;
  uptimePct: number;
  avgLatencyMs: number;
  lastCheckedAt: string | null;
  checks: HealthCheck[];
}

export default function MonitoringPage() {
  const [rows, setRows] = React.useState<SummaryRow[] | null>(null);
  const [summary, setSummary] = React.useState<{ monitored: number; avgUptime: number | null; totalFailedChecks: number } | null>(null);
  const [selected, setSelected] = React.useState<string>("");
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [checkingAll, setCheckingAll] = React.useState(false);
  const [checkingOne, setCheckingOne] = React.useState(false);

  const loadSummary = React.useCallback(async () => {
    const res = await fetch("/api/monitoring", { cache: "no-store" });
    const data = await res.json();
    setRows(data.services as SummaryRow[]);
    setSummary(data.summary);
  }, []);

  const loadDetail = React.useCallback(async (id: string) => {
    if (!id) return setDetail(null);
    const res = await fetch(`/api/monitoring?serviceId=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.ok) setDetail((await res.json()).service as Detail);
  }, []);

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);
  React.useEffect(() => {
    loadDetail(selected);
  }, [selected, loadDetail]);

  async function runOne() {
    if (!selected) return;
    setCheckingOne(true);
    try {
      await fetch("/api/monitoring/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: selected }),
      });
      await Promise.all([loadDetail(selected), loadSummary()]);
    } finally {
      setCheckingOne(false);
    }
  }

  async function runAll() {
    setCheckingAll(true);
    try {
      await fetch("/api/monitoring/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await Promise.all([loadSummary(), selected ? loadDetail(selected) : Promise.resolve()]);
    } finally {
      setCheckingAll(false);
    }
  }

  const bars = detail ? [...detail.checks].slice(0, 60).reverse() : [];

  return (
    <div className="container py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <Activity className="size-3.5" /> Monitoring
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Uptime &amp; health</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">
            Real probe history per service — uptime, latency, failed checks, and last-checked time. Run a check now, or
            schedule <code className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs">node scripts/monitor.mjs</code>{" "}
            (scheduled checks require a worker/cron).
          </p>
        </div>
      </div>
      <div className="mb-8 flex justify-end">
        <Button variant="outline" onClick={runAll} disabled={checkingAll}>
          {checkingAll ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Run all checks
        </Button>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi icon={<Server className="size-4" />} label="Services" value={(rows?.length ?? 0).toString()} />
          <Kpi icon={<Gauge className="size-4" />} label="Monitored" value={summary.monitored.toString()} />
          <Kpi icon={<Activity className="size-4" />} label="Avg uptime" value={summary.avgUptime === null ? "—" : `${summary.avgUptime.toFixed(1)}%`} accent />
          <Kpi icon={<XCircle className="size-4" />} label="Failed checks" value={summary.totalFailedChecks.toString()} />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        {/* Service selector + table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Services</CardTitle>
          </CardHeader>
          <CardContent>
            {rows === null ? (
              <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
            ) : rows.length === 0 ? (
              <EmptyState title="No services" description="List or discover a service to monitor it." className="py-8" />
            ) : (
              <div className="scrollbar-thin max-h-[460px] overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r.id)}
                        className={cn(
                          "cursor-pointer border-b border-border/50 last:border-0",
                          selected === r.id ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                        )}
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-2 font-medium">
                            <span className={cn("size-2 rounded-full", r.checkCount === 0 ? "bg-white/20" : r.failedChecks === 0 ? "bg-emerald-400" : "bg-amber-400")} />
                            <span className="truncate">{r.name}</span>
                            {r.demo && <Badge variant="warning">demo</Badge>}
                          </div>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                          {r.checkCount ? `${r.uptimePct.toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail */}
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base">{detail ? detail.name : "Select a service"}</CardTitle>
              {detail && <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{detail.healthCheckUrl || detail.endpoint}</p>}
            </div>
            {detail && (
              <Button size="sm" onClick={runOne} disabled={checkingOne}>
                {checkingOne ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
                Run health check
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!detail ? (
              <EmptyState icon={<Activity className="size-6" />} title="No service selected" description="Pick a service from the list to see its health timeline." className="py-10" />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={detail.status} />
                  <Badge variant="muted"><Activity className="size-3" /> {detail.checks.length ? `${detail.uptimePct.toFixed(1)}% uptime` : "no checks"}</Badge>
                  <Badge variant="muted"><Timer className="size-3" /> {detail.avgLatencyMs ? `${detail.avgLatencyMs}ms` : "—"}</Badge>
                  <Badge variant="muted">{detail.lastCheckedAt ? `checked ${timeAgo(detail.lastCheckedAt)}` : "never checked"}</Badge>
                </div>

                {bars.length > 0 ? (
                  <div className="flex h-14 items-end gap-1">
                    {bars.map((c) => (
                      <div
                        key={c.id}
                        title={`${c.ok ? "up" : "down"} · HTTP ${c.status} · ${c.latencyMs}ms · ${timeAgo(c.timestamp)}`}
                        className={cn("flex-1 rounded-sm", c.ok ? "bg-emerald-500/70" : "bg-red-500/70")}
                        style={{ height: `${Math.max(14, Math.min(100, c.ok ? 30 + Math.min(70, c.latencyMs / 20) : 100))}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-muted-foreground">
                    No health checks yet. Click <span className="font-medium text-foreground">Run health check</span> to record the first real probe.
                  </div>
                )}

                {/* Timeline table */}
                {detail.checks.length > 0 && (
                  <div className="scrollbar-thin max-h-[260px] overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2 font-medium">When</th>
                          <th className="px-3 py-2 font-medium">Result</th>
                          <th className="px-3 py-2 text-right font-medium">HTTP</th>
                          <th className="px-3 py-2 text-right font-medium">Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.checks.map((c) => (
                          <tr key={c.id} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-2 text-muted-foreground">{timeAgo(c.timestamp)}</td>
                            <td className="px-3 py-2">
                              {c.ok ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="size-3.5" /> up</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-400"><XCircle className="size-3.5" /> down</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.status || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{c.latencyMs}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <Link href={`/services/${detail.slug}`} className="inline-flex items-center gap-1 text-sm text-blue-400 hover:underline">
                  Open service page <ExternalLink className="size-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/[0.06] p-5" : "p-5"}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
