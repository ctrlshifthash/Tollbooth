"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Wallet,
  Loader2,
  Activity,
  CircleDollarSign,
  XCircle,
  CreditCard,
  RefreshCw,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { CopyButton } from "@/components/copy-button";
import { MyPurchases } from "@/components/my-purchases";
import { MyAgents } from "@/components/my-agents";
import { useWallet } from "@/components/wallet";
import type { Service } from "@/lib/types";
import { formatCompact, formatUsdc, explorerTxUrl, truncateAddress, toManifest } from "@/lib/utils";
import { RotateCw, FileJson, Receipt, ArrowUpRight, Pencil, Info } from "lucide-react";

export default function DashboardPage() {
  const wallet = useWallet();
  const [services, setServices] = React.useState<Service[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [probing, setProbing] = React.useState(false);
  const [verifying, setVerifying] = React.useState<string | null>(null);

  const load = React.useCallback(async (addr: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/services", { cache: "no-store" });
      const data = await res.json();
      const a = addr.toLowerCase();
      const mine = (data.services as Service[]).filter(
        (s) => s.wallet.toLowerCase() === a || s.ownership?.wallet?.toLowerCase() === a
      );
      setServices(mine);
    } finally {
      setLoading(false);
    }
  }, []);

  // The dashboard is bound to the CONNECTED wallet — load its services on
  // connect, clear them on disconnect. No free-form address entry.
  React.useEffect(() => {
    if (wallet.connected && wallet.address) load(wallet.address);
    else setServices(null);
  }, [wallet.connected, wallet.address, load]);

  async function probeAll() {
    if (!services || !wallet.address) return;
    setProbing(true);
    try {
      await Promise.all(
        services.map((s) =>
          fetch("/api/health", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serviceId: s.id }),
          })
        )
      );
      await load(wallet.address);
    } finally {
      setProbing(false);
    }
  }

  async function reVerify(s: Service) {
    if (!wallet.address) return;
    setVerifying(s.id);
    try {
      await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: s.id, endpoint: s.endpoint, wallet: s.wallet }),
      });
      await load(wallet.address);
    } finally {
      setVerifying(null);
    }
  }

  // ---- aggregates from REAL data ----
  const agg = React.useMemo(() => {
    const list = services ?? [];
    let paidCalls = 0;
    let revenue = 0;
    let failures = 0;
    let uptimeSum = 0;
    let uptimeCount = 0;
    const settlements: { hash: string; amountUsdc: number; chain: Service["chain"] }[] = [];
    for (const s of list) {
      const calls = s.callLog ?? [];
      paidCalls += calls.filter((c) => c.paid && c.ok).length;
      revenue += calls.filter((c) => c.paid && c.ok).reduce((sum, c) => sum + (c.amountUsdc ?? 0), 0);
      failures += calls.filter((c) => !c.ok).length + (s.healthChecks ?? []).filter((h) => !h.ok).length;
      if ((s.healthChecks ?? []).length) {
        uptimeSum += s.metrics.uptimePct;
        uptimeCount++;
      }
      for (const t of s.settlements ?? []) {
        if (t.hash) settlements.push({ hash: t.hash, amountUsdc: t.amountUsdc, chain: s.chain });
      }
    }
    return { paidCalls, revenue, failures, avgUptime: uptimeCount ? uptimeSum / uptimeCount : null, settlements };
  }, [services]);

  return (
    <div className="container py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"><LayoutDashboard className="size-3.5" /> Owner dashboard</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Your services</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">Connect your wallet to manage the x402 services it owns, with live monitoring. All numbers are derived from
          real health checks and on-chain settlements — never seed data.</p>
        </div>
      </div>

      {/* Connected-wallet bar */}
      <Card className="mb-8">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          {wallet.connected && wallet.address ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
                  <Wallet className="size-4" />
                </div>
                <div>
                  <div className="font-mono text-sm">{truncateAddress(wallet.address, 8, 6)}</div>
                  <div className="text-xs text-muted-foreground">
                    {wallet.balance === null ? "balance —" : `${wallet.balance.toFixed(2)} USDC on Base`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => wallet.address && load(wallet.address)} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Refresh
                </Button>
                <Button variant="ghost" size="sm" onClick={wallet.logout}>
                  <LogOut className="size-4" /> Disconnect
                </Button>
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="size-4 text-blue-400" />
                {wallet.configured
                  ? "Connect a wallet to view and manage your services."
                  : "Wallet connect isn't configured (set NEXT_PUBLIC_PRIVY_APP_ID)."}
              </div>
              <Button onClick={wallet.login} disabled={!wallet.configured || !wallet.ready}>
                <Wallet className="size-4" /> Connect wallet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {wallet.connected && (
        <div className="mb-10 space-y-10">
          <section>
            <h2 className="mb-4 text-lg font-semibold">Purchases</h2>
            <MyPurchases />
          </section>
          <section>
            <h2 className="mb-4 text-lg font-semibold">Your agents</h2>
            <MyAgents />
          </section>
        </div>
      )}

      {!wallet.connected ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="Connect your wallet"
          description="The dashboard is bound to your connected wallet. Connect to see the services it owns, their live uptime, paid calls, and on-chain revenue."
        />
      ) : services === null || loading ? (
        <EmptyState icon={<Loader2 className="size-6 animate-spin" />} title="Loading your services…" description="Reading on-chain and live monitoring data." />
      ) : services.length === 0 ? (
        <EmptyState
          icon={<LayoutDashboard className="size-6" />}
          title="No services for this wallet"
          description="This wallet doesn't own or hasn't claimed any listed services yet."
          action={
            <Link href="/list">
              <Button>List a service</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {/* Monitoring dashboard */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Monitoring</h2>
              <Button variant="outline" size="sm" onClick={probeAll} disabled={probing}>
                {probing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Probe all
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon={<Activity className="size-4" />} label="Avg uptime" value={agg.avgUptime === null ? "—" : `${agg.avgUptime.toFixed(1)}%`} hint={agg.avgUptime === null ? "no checks yet" : undefined} />
              <Kpi icon={<XCircle className="size-4" />} label="Failures" value={formatCompact(agg.failures)} />
              <Kpi icon={<CreditCard className="size-4" />} label="Paid calls" value={formatCompact(agg.paidCalls)} />
              <Kpi icon={<CircleDollarSign className="size-4" />} label="Revenue (settled)" value={formatUsdc(agg.revenue)} accent />
            </div>
          </div>

          {/* Owned/claimed services */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Listed &amp; claimed services</h2>
            <div className="scrollbar-thin overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-white/[0.02] text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 text-right font-medium">Uptime</th>
                    <th className="px-4 py-3 text-right font-medium">Paid calls</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => {
                    const calls = s.callLog ?? [];
                    const paid = calls.filter((c) => c.paid && c.ok);
                    const rev = paid.reduce((sum, c) => sum + (c.amountUsdc ?? 0), 0);
                    return (
                      <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <Link href={`/services/${s.slug}`} className="font-medium hover:text-blue-400">
                            {s.name}
                          </Link>
                          {s.demo && <Badge variant="warning" className="ml-2">demo</Badge>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={s.verificationStatus} /></td>
                        <td className="px-4 py-3">
                          {s.ownership?.walletVerified ? (
                            <Badge variant="success">verified</Badge>
                          ) : (
                            <Badge variant="muted">unclaimed</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {(s.healthChecks ?? []).length ? `${s.metrics.uptimePct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{paid.length}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatUsdc(rev)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" title="Re-run verification" onClick={() => reVerify(s)} disabled={verifying === s.id}>
                              {verifying === s.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                            </Button>
                            <CopyButton value={JSON.stringify(toManifest(s), null, 2)} label="" variant="ghost" size="icon" className="size-8" title="Copy manifest">
                              <FileJson className="size-4" />
                            </CopyButton>
                            <Link href={`/payments?serviceId=${s.id}`} title="Payment history">
                              <Button size="sm" variant="ghost"><Receipt className="size-4" /></Button>
                            </Link>
                            <Link href={`/manifest`} title="Edit via manifest re-import">
                              <Button size="sm" variant="ghost"><Pencil className="size-4" /></Button>
                            </Link>
                            <Link href={`/services/${s.slug}`} title="Open service">
                              <Button size="sm" variant="ghost"><ArrowUpRight className="size-4" /></Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real settlements */}
          {agg.settlements.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold">Settlements on Base</h2>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-white/5">
                    {agg.settlements.map((t) => (
                      <li key={t.hash} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <a href={explorerTxUrl(t.chain, t.hash)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-mono text-xs text-blue-400 hover:underline">
                          {truncateAddress(t.hash, 14, 10)} <ExternalLink className="size-3" />
                        </a>
                        <span className="font-medium tabular-nums">{formatUsdc(t.amountUsdc)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint, accent }: { icon: React.ReactNode; label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/[0.06] p-5" : "p-5"}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
