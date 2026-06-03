import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Globe,
  Wallet,
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  Timer,
  ExternalLink,
  Network,
  Coins,
  ArrowRightLeft,
  History,
  BadgeCheck,
  FlaskConical,
} from "lucide-react";
import { ClaimOwnership } from "@/components/claim-ownership";
import { HealthPanel } from "@/components/health-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ReputationScore } from "@/components/reputation-score";
import { Avatar } from "@/components/avatar";
import { CodeBlock } from "@/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { ServiceActions } from "@/components/service-actions";
import { VerificationSteps } from "@/components/verification-steps";
import { EmptyState } from "@/components/empty-state";
import { getServiceById, getAgentById } from "@/lib/store";
import { CATEGORIES } from "@/lib/types";
import { formatCompact, formatUsdc, timeAgo, toManifest, truncateAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const service = getServiceById(params.id);
  if (!service) return { title: "Service not found" };
  return { title: service.name, description: service.description };
}

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const service = getServiceById(params.id);
  if (!service) notFound();

  const owner = getAgentById(service.ownerAgentId);
  const manifest = toManifest(service);
  const category = CATEGORIES.find((c) => c.value === service.category)?.label ?? service.category;
  const successRate =
    service.metrics.successfulCalls + service.metrics.failedCalls > 0
      ? (service.metrics.successfulCalls / (service.metrics.successfulCalls + service.metrics.failedCalls)) * 100
      : 0;
  const explorerBase = service.chain === "base" ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/";
  const latestRun = service.verificationHistory[0];

  return (
    <div className="container py-10">
      <Link href="/services" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to services
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{service.name}</h1>
            <StatusBadge status={service.verificationStatus} />
            {service.ownership.walletVerified && (
              <Badge variant="success">
                <BadgeCheck className="size-3" /> Owner verified
              </Badge>
            )}
            {service.demo && (
              <Badge variant="warning">
                <FlaskConical className="size-3" /> Demo data
              </Badge>
            )}
            {service.source && service.source !== "seed" && service.source !== "submission" && (
              <Badge variant="muted" className="capitalize">
                via {service.source}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="muted">{category}</Badge>
            <Badge variant="secondary" className="capitalize">
              <Network className="size-3" /> {service.chain}
            </Badge>
            {service.tags.map((t) => (
              <Badge key={t} variant="outline">
                #{t}
              </Badge>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-muted-foreground">{service.description}</p>
        </div>
        <Card className="shrink-0 p-5">
          <ReputationScore score={service.metrics.reputationScore} size="lg" />
        </Card>
      </div>

      {/* Actions */}
      <div className="mt-8">
        <ServiceActions service={service} manifest={manifest} />
      </div>

      {/* Metrics row */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard icon={<Zap className="size-4" />} label="Price / call" value={formatUsdc(service.priceUsdc)} accent />
        <MetricCard icon={<Activity className="size-4" />} label="Uptime" value={`${service.metrics.uptimePct.toFixed(2)}%`} />
        <MetricCard icon={<ArrowRightLeft className="size-4" />} label="Total calls" value={formatCompact(service.metrics.totalCalls)} />
        <MetricCard icon={<Timer className="size-4" />} label="Avg latency" value={`${service.metrics.avgLatencyMs}ms`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {/* Connection details */}
          <Card>
            <CardHeader>
              <CardTitle>Connection details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <KeyRow icon={<Globe className="size-4" />} label="Endpoint" value={service.endpoint} mono copyable />
              <KeyRow icon={<Wallet className="size-4" />} label="Wallet (payTo)" value={service.wallet} mono copyable />
              <KeyRow icon={<Coins className="size-4" />} label="Asset (USDC)" value={service.asset} mono copyable />
              <KeyRow icon={<Network className="size-4" />} label="Network" value={service.chain} />
              <KeyRow
                icon={<Zap className="size-4" />}
                label="Amount (atomic)"
                value={`${manifest.x402.maxAmountRequired} (${formatUsdc(service.priceUsdc)})`}
              />
            </CardContent>
          </Card>

          {/* Schemas */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Input schema</h3>
              <CodeBlock language="json" filename="input" code={service.inputSchema} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Output schema</h3>
              <CodeBlock language="json" filename="output" code={service.outputSchema} />
            </div>
          </div>

          {/* Uptime / health monitoring */}
          <HealthPanel
            serviceId={service.id}
            initial={{
              uptimePct: service.metrics.uptimePct,
              avgLatencyMs: service.metrics.avgLatencyMs,
              lastCheckedAt: service.lastCheckedAt ?? null,
              checks: service.healthChecks,
            }}
          />

          {/* Settlement examples */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="size-4 text-blue-400" /> Settlement examples
              </CardTitle>
            </CardHeader>
            <CardContent>
              {service.settlements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No settlements recorded yet.</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {service.settlements.map((s) => (
                    <li key={s.hash} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <a
                          href={`${explorerBase}${s.hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 font-mono text-xs text-blue-400 hover:underline"
                        >
                          {truncateAddress(s.hash, 12, 10)}
                          <ExternalLink className="size-3" />
                        </a>
                        <span className="text-xs text-muted-foreground">{timeAgo(s.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">{formatUsdc(s.amountUsdc)}</span>
                        <Badge variant={s.status === "success" ? "success" : "destructive"}>{s.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Verification history */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-blue-400" /> Verification history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestRun ? (
                <div className="space-y-6">
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <StatusBadge status={latestRun.status} />
                      <span>Latest run · {timeAgo(latestRun.createdAt)}</span>
                    </div>
                    <VerificationSteps steps={latestRun.steps} />
                  </div>
                  {service.verificationHistory.length > 1 && (
                    <div className="border-t border-white/5 pt-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Earlier runs
                      </h4>
                      <ul className="space-y-2">
                        {service.verificationHistory.slice(1).map((run) => (
                          <li key={run.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{timeAgo(run.createdAt)}</span>
                            <StatusBadge status={run.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No verification runs yet"
                  description="Run a verification to populate this service's trust history."
                  action={
                    <Link href={`/verify?endpoint=${encodeURIComponent(service.endpoint)}&wallet=${service.wallet}&serviceId=${service.id}`}>
                      <Button>Run verification</Button>
                    </Link>
                  }
                  className="py-10"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="min-w-0 space-y-6">
          {/* Wallet ownership claim/proof */}
          <ClaimOwnership serviceId={service.id} payTo={service.wallet} initial={service.ownership} />

          {/* Owner */}
          {owner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operated by</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/agents/${owner.handle}`} className="flex items-center gap-3 hover:opacity-90">
                  <Avatar name={owner.displayName} gradient={owner.avatarColor} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{owner.displayName}</div>
                    <div className="truncate text-sm text-muted-foreground">@{owner.handle}</div>
                  </div>
                </Link>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <SideStat label="Trust" value={owner.trustScore.toString()} />
                  <SideStat label="Rating" value={owner.avgRating.toFixed(1)} />
                  <SideStat label="Services" value={owner.serviceIds.length.toString()} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reliability */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reliability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Reliability label="Successful calls" value={service.metrics.successfulCalls} icon={<CheckCircle2 className="size-4 text-emerald-400" />} />
              <Reliability label="Failed calls" value={service.metrics.failedCalls} icon={<XCircle className="size-4 text-red-400" />} />
              <div>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-muted-foreground">Success rate</span>
                  <span className="font-semibold tabular-nums">{successRate.toFixed(2)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${successRate}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manifest */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Service manifest</CardTitle>
              <CopyButton value={JSON.stringify(manifest, null, 2)} label="Copy" />
            </CardHeader>
            <CardContent>
              <CodeBlock language="json" filename="agent402/manifest@1" code={JSON.stringify(manifest, null, 2)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ----- presentational helpers -----

function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/[0.06] p-4" : "p-4"}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}

function KeyRow({
  icon,
  label,
  value,
  mono,
  copyable,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className={mono ? "truncate font-mono text-sm" : "truncate text-sm"}>{value}</span>
        {copyable && <CopyButton value={value} label="" variant="ghost" size="icon" className="size-7 shrink-0" />}
      </div>
    </div>
  );
}

function SideStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] py-2">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Reliability({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-semibold tabular-nums">{formatCompact(value)}</span>
    </div>
  );
}
