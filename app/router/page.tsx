"use client";

import * as React from "react";
import Link from "next/link";
import {
  Zap,
  Loader2,
  Search,
  CircleDollarSign,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Wand2,
  ArrowRight,
  Cpu,
  Receipt,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/code-block";
import { CATEGORIES } from "@/lib/types";
import { explorerTxUrl, formatUsdc, truncateAddress } from "@/lib/utils";
import { useWallet } from "@/components/wallet";
import { Wallet } from "lucide-react";

interface Candidate {
  id: string;
  slug: string;
  name: string;
  endpoint: string;
  priceUsdc: number;
  reputation: number;
  uptimePct: number;
  chain: "base" | "base-sepolia";
}
interface HermesStepUI {
  action: string;
  input?: string;
  observation?: string;
  txHash?: string | null;
  costUsdc: number;
  ok: boolean;
  error?: string;
  thought?: string;
}
interface RouteResult {
  ok: boolean;
  error?: string;
  selected?: Candidate;
  reason?: string;
  candidates: Candidate[];
  result?: unknown;
  txHash?: string | null;
  amountUsdc?: number;
  status?: number;
  latencyMs?: number;
  viaHermes?: boolean;
  hermes?: { model: string; answer: string; steps: HermesStepUI[]; spentUsdc: number };
}

const EXAMPLES = ["AAPL stock price", "polymarket markets", "crypto news", "chain block number", "TSLA price"];

export default function RouterPage() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("any");
  const [maxPrice, setMaxPrice] = React.useState("0.01");
  const [busy, setBusy] = React.useState<null | "find" | "run">(null);
  const [res, setRes] = React.useState<RouteResult | null>(null);
  const { configured, connected, address, balance, login, route } = useWallet();

  async function select(): Promise<RouteResult> {
    const r = await fetch("/api/router/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query.trim() || undefined,
        category,
        maxPriceUsdc: maxPrice ? Number(maxPrice) : undefined,
        dryRun: true,
      }),
    });
    return (await r.json()) as RouteResult;
  }

  // run=true -> pay Tollbooth's Router fee from the user's wallet; run=false -> select only (free).
  async function go(run: boolean) {
    setBusy(run ? "run" : "find");
    setRes(null);
    try {
      if (!run) {
        setRes(await select());
        return;
      }
      if (!configured) {
        setRes({ ok: false, error: "Wallet connect isn't configured (set NEXT_PUBLIC_PRIVY_APP_ID).", candidates: [] });
        return;
      }
      if (!connected) {
        setRes({ ok: false, error: "Connect your wallet to pay the Router fee.", candidates: [] });
        return;
      }
      try {
        const r = await route({
          query: query.trim() || undefined,
          category,
          maxPriceUsdc: maxPrice ? Number(maxPrice) : undefined,
        });
        setRes({
          ok: !!r.ok,
          selected: r.selected ? { ...r.selected, id: r.selected.slug } : undefined,
          reason: r.reason ?? undefined,
          result: r.result,
          txHash: r.downstreamTx ?? null,
          status: typeof r.status === "number" ? r.status : undefined,
          amountUsdc: r.feeUsdc,
          candidates: (r.candidates as RouteResult["candidates"]) ?? [],
          viaHermes: r.viaHermes,
          hermes: r.hermes as RouteResult["hermes"],
          error: r.error ?? undefined,
        });
      } catch (e) {
        setRes({ ok: false, error: e instanceof Error ? e.message : "Payment failed or was rejected.", candidates: [] });
      }
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : "Request failed", candidates: [] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="container max-w-4xl py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"><Zap className="size-3.5" /> x402 Router</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Run a task across the x402 network</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">Describe what you need. Pay a flat <span className="font-medium text-foreground">$0.10 in USDC on Base</span> and{" "}
          <span className="font-medium text-foreground">Hermes</span> reads your task, calls the right x402 services to do
          the work, and returns the <span className="font-medium text-foreground">real result</span> — one endpoint instead of 96.</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1.5">
            <Label>What do you want?</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && go(false)}
                placeholder="e.g. AAPL stock price"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="any">Any category</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max price (USDC)</Label>
              <Input type="number" min={0} step="0.001" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={() => go(true)} disabled={busy !== null} size="lg">
              {busy === "run" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              Route &amp; pay · $0.10
            </Button>
            <Button onClick={() => go(false)} disabled={busy !== null} variant="outline" size="lg">
              {busy === "find" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Find best service (free)
            </Button>
          </div>

          {/* Wallet status — you pay with your own USDC on Base */}
          <div className="flex items-center gap-2 border-t border-white/5 pt-3 text-sm">
            {!configured ? (
              <span className="text-muted-foreground">
                Connect-wallet not configured — set <code className="font-mono">NEXT_PUBLIC_PRIVY_APP_ID</code> to let users pay.
              </span>
            ) : connected ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="size-4 text-emerald-400" /> Paying from{" "}
                <span className="font-mono text-foreground">{truncateAddress(address ?? "")}</span>
                {balance !== null && <span className="text-emerald-400">· {formatUsdc(balance)} USDC</span>}
              </span>
            ) : (
              <>
                <span className="text-muted-foreground">Connect your wallet to pay with your own USDC.</span>
                <Button size="sm" variant="ghost" onClick={login}>
                  <Wallet className="size-4" /> Connect
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {res && (
        <div className="mt-6 space-y-4">
          {res.error && !res.selected && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <XCircle className="size-4 shrink-0" /> {res.error}
            </div>
          )}

          {/* Hermes-fulfilled result */}
          {res.viaHermes && res.hermes && (
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4 text-blue-400" /> Ran with Hermes
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{res.hermes.model}</Badge>
                    <Badge variant="muted"><CircleDollarSign className="size-3" /> {formatUsdc(res.hermes.spentUsdc)} in tools</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {res.error && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm text-amber-200">
                    <XCircle className="size-4 shrink-0" /> {res.error}
                  </div>
                )}
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-emerald-300">
                    <CheckCircle2 className="size-4" /> Answer
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{res.hermes.answer}</p>
                </div>
                {res.hermes.steps.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      x402 tool calls ({res.hermes.steps.length})
                    </div>
                    <ul className="space-y-1.5">
                      {res.hermes.steps.map((s, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-1.5">
                            {s.ok ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <XCircle className="size-3.5 text-red-400" />}
                            <Cpu className="size-3.5 text-blue-400" /> {s.action}
                          </span>
                          {s.txHash ? (
                            <a href={explorerTxUrl("base", s.txHash)} target="_blank" rel="noreferrer" className="font-mono text-blue-400 hover:underline">
                              {truncateAddress(s.txHash, 8, 6)} <ExternalLink className="inline size-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{s.costUsdc ? formatUsdc(s.costUsdc) : s.error ?? "—"}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3 text-sm">
                  <Link href="/payments">
                    <Button size="sm" variant="ghost"><Receipt className="size-4" /> Payments</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {!res.viaHermes && res.selected && (
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="size-4 text-blue-400" /> Routed to {res.selected.name}
                    </CardTitle>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{res.selected.endpoint}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                    <Badge variant="default">{formatUsdc(res.selected.priceUsdc)}/call</Badge>
                    <span className="text-xs text-muted-foreground">rep {res.selected.reputation} · {res.selected.uptimePct.toFixed(0)}% up</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {res.reason && <p className="text-sm text-muted-foreground">{res.reason}</p>}

                {res.error && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3 text-sm text-amber-200">
                    <XCircle className="size-4 shrink-0" /> {res.error}
                  </div>
                )}

                {res.result !== undefined && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-emerald-300">
                        <CheckCircle2 className="size-4" /> Paid Tollbooth &amp; routed
                      </span>
                      {res.amountUsdc != null && <Badge variant="muted"><CircleDollarSign className="size-3" /> {formatUsdc(res.amountUsdc)} fee</Badge>}
                      {res.status != null && <Badge variant="muted">HTTP {res.status}</Badge>}
                      {res.latencyMs != null && <Badge variant="muted">{res.latencyMs}ms</Badge>}
                    </div>
                    <CodeBlock
                      language="json"
                      filename="real result"
                      code={typeof res.result === "string" ? res.result : JSON.stringify(res.result, null, 2)}
                    />
                    {res.txHash && (
                      <a
                        href={explorerTxUrl(res.selected.chain, res.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-blue-400 hover:underline"
                      >
                        settled on Base · {truncateAddress(res.txHash, 12, 8)} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3 text-sm">
                  <Link href={`/services/${res.selected.slug}`}>
                    <Button size="sm" variant="ghost">Open service <ArrowRight className="size-4" /></Button>
                  </Link>
                  <Link href="/payments">
                    <Button size="sm" variant="ghost"><Receipt className="size-4" /> Payments</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Candidate shortlist (transparency) */}
          {res.candidates.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Considered {res.candidates.length} services</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-white/5">
                  {res.candidates.map((c, i) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        {i === 0 && <Badge variant="success">picked</Badge>}
                        <Link href={`/services/${c.slug}`} className="truncate hover:text-blue-400">{c.name}</Link>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatUsdc(c.priceUsdc)} · rep {c.reputation} · {c.uptimePct.toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
