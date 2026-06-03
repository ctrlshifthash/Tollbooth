"use client";

import * as React from "react";
import {
  Bot,
  Wallet,
  Loader2,
  Play,
  Pause,
  Square,
  Trash2,
  Zap,
  CircleDollarSign,
  Repeat,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Power,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { useWallet } from "@/components/wallet";
import type { AutonomousAgent, Service } from "@/lib/types";
import { formatUsdc, truncateAddress, explorerTxUrl, timeAgo } from "@/lib/utils";

// Curated fallback models (mirrors the server list). The live catalog is loaded
// from /api/models; this is only used if that fetch fails.
const MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (fast, cheap)" },
  { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8 (frontier)" },
  { id: "anthropic/claude-opus-4.8-fast", label: "Claude Opus 4.8 (fast)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "x-ai/grok-4.20", label: "Grok 4.20" },
  { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
];

const AI_SERVICE = (s?: Service) =>
  !!s && (s.tags?.some((t) => ["ai", "llm"].includes(t)) || ["ai-inference", "data"].includes(s.category));

const STATUS_VARIANT: Record<AutonomousAgent["status"], "success" | "muted" | "warning" | "destructive"> = {
  running: "success",
  paused: "warning",
  exhausted: "muted",
  stopped: "destructive",
};

// Wallet-gated panel for creating and operating autonomous agents. Embedded in
// the Agents page — autonomous agents ARE agents, just self-driving ones.
export function AutonomousAgents() {
  const wallet = useWallet();
  const [services, setServices] = React.useState<Service[]>([]);
  const [catalog, setCatalog] = React.useState<{ id: string; name: string; provider: string }[]>([]);
  const [agents, setAgents] = React.useState<AutonomousAgent[]>([]);
  const [autoRun, setAutoRun] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({ targetServiceId: "", name: "", intervalSec: "30", budgetUsdc: "0.10", maxCalls: "0", prompt: "", model: MODELS[0].id });
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  React.useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list = (d.services as Service[]) ?? [];
        setServices(list);
        setForm((f) => ({ ...f, targetServiceId: f.targetServiceId || list[0]?.id || "" }));
      })
      .catch(() => {});
    // Full live model catalog for the model picker.
    fetch("/api/models", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCatalog(d.models ?? []))
      .catch(() => {});
  }, []);

  // Group the catalog by provider for <optgroup>s; fall back to the curated list.
  const modelGroups = React.useMemo(() => {
    const src = catalog.length ? catalog : MODELS.map((m) => ({ id: m.id, name: m.label, provider: m.id.split("/")[0] }));
    const by: Record<string, { id: string; name: string }[]> = {};
    for (const m of src) (by[m.provider] ??= []).push({ id: m.id, name: m.name });
    return Object.entries(by).sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog]);

  const loadAgents = React.useCallback(async () => {
    if (!wallet.address) return;
    const res = await fetch(`/api/autonomous?owner=${wallet.address}`, { cache: "no-store" });
    const data = await res.json();
    setAgents((data.agents as AutonomousAgent[]) ?? []);
  }, [wallet.address]);

  React.useEffect(() => {
    if (wallet.connected) loadAgents();
    else setAgents([]);
  }, [wallet.connected, loadAgents]);

  // Drive autonomous execution while open; budget + interval caps bound spend.
  React.useEffect(() => {
    if (!wallet.connected || !autoRun) return;
    let alive = true;
    const tick = async () => {
      try {
        await fetch("/api/autonomous/tick", { method: "POST" });
        if (alive) await loadAgents();
      } catch {
        /* ignore */
      }
    };
    const h = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [wallet.connected, autoRun, loadAgents]);

  async function create(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!wallet.address) return;
    setCreating(true);
    try {
      const res = await fetch("/api/autonomous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerWallet: wallet.address,
          targetServiceId: form.targetServiceId,
          name: form.name,
          intervalSec: Number(form.intervalSec),
          budgetUsdc: Number(form.budgetUsdc),
          maxCalls: Number(form.maxCalls),
          prompt: AI_SERVICE(selected) ? form.prompt : "",
          model: AI_SERVICE(selected) ? form.model : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create agent");
        return;
      }
      setForm((f) => ({ ...f, name: "" }));
      await loadAgents();
    } finally {
      setCreating(false);
    }
  }

  async function act(id: string, path: string, method = "POST", body?: unknown) {
    setBusy(id);
    try {
      await fetch(`/api/autonomous/${id}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      await loadAgents();
    } finally {
      setBusy(null);
    }
  }

  const selected = services.find((s) => s.id === form.targetServiceId);

  if (!wallet.connected) {
    return (
      <EmptyState
        icon={<Bot className="size-6" />}
        title="Connect your wallet to run autonomous agents"
        description="An autonomous agent pays for and calls an x402 service on its own, on a fixed interval, until its USDC budget runs out. Connect to create one."
        action={
          <Button onClick={wallet.login} disabled={!wallet.configured || !wallet.ready}>
            <Wallet className="size-4" /> Connect wallet
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      {/* Create */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">New autonomous agent</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Target service</Label>
              <Select value={form.targetServiceId} onChange={(e) => set("targetServiceId", e.target.value)}>
                {services.length === 0 && <option value="">No services available</option>}
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {formatUsdc(s.priceUsdc)}/call
                  </option>
                ))}
              </Select>
            </div>

            {AI_SERVICE(selected) && (
              <>
                <div className="space-y-1.5">
                  <Label>Task / prompt</Label>
                  <Textarea
                    value={form.prompt}
                    onChange={(e) => set("prompt", e.target.value)}
                    rows={3}
                    className="font-sans"
                    placeholder="e.g. Write a one-line, punchy tagline for an x402 payments startup."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Model {catalog.length > 0 && <span className="text-xs font-normal text-muted-foreground">· {catalog.length} models</span>}</Label>
                  <Select value={form.model} onChange={(e) => set("model", e.target.value)}>
                    {modelGroups.map(([provider, models]) => (
                      <optgroup key={provider} label={provider}>
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Agent name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={selected ? `${selected.name} runner` : "My runner"} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Interval (seconds)</Label>
                <Input type="number" min={15} step={5} value={form.intervalSec} onChange={(e) => set("intervalSec", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Budget (USDC)</Label>
                <Input type="number" min={0} step="0.01" value={form.budgetUsdc} onChange={(e) => set("budgetUsdc", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Max calls (0 = until budget runs out)</Label>
              <Input type="number" min={0} step={1} value={form.maxCalls} onChange={(e) => set("maxCalls", e.target.value)} />
            </div>
            {selected && (
              <p className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs text-muted-foreground">
                At {formatUsdc(selected.priceUsdc)}/call, a {formatUsdc(Number(form.budgetUsdc) || 0)} budget funds ~
                <span className="font-medium text-foreground">
                  {selected.priceUsdc > 0 ? Math.floor((Number(form.budgetUsdc) || 0) / selected.priceUsdc) : "∞"}
                </span>{" "}
                calls, one every {form.intervalSec}s.
              </p>
            )}
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-red-400">
                <XCircle className="size-4" /> {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={creating || !form.targetServiceId}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
              Launch agent
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Runners */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Running for {truncateAddress(wallet.address ?? "", 6, 4)}</h3>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Power className={autoRun ? "size-4 text-emerald-400" : "size-4"} />
            <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} className="accent-blue-500" />
            Auto-run while open
          </label>
        </div>

        {agents.length === 0 ? (
          <EmptyState icon={<Bot className="size-6" />} title="No autonomous agents yet" description="Create one on the left — it'll start paying and calling its target on its own." />
        ) : (
          agents.map((a) => {
            const pct = a.budgetUsdc > 0 ? Math.min(100, (a.spentUsdc / a.budgetUsdc) * 100) : 0;
            return (
              <Card key={a.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{a.name}</span>
                        <Badge variant={STATUS_VARIANT[a.status]} className="capitalize">{a.status}</Badge>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">→ {a.targetName}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" title="Run now" disabled={busy === a.id || a.status !== "running"} onClick={() => act(a.id, "/run")}>
                        {busy === a.id ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                      </Button>
                      {a.status === "running" ? (
                        <Button size="sm" variant="ghost" title="Pause" onClick={() => act(a.id, "", "POST", { action: "pause" })}>
                          <Pause className="size-4" />
                        </Button>
                      ) : a.status === "paused" ? (
                        <Button size="sm" variant="ghost" title="Resume" onClick={() => act(a.id, "", "POST", { action: "resume" })}>
                          <Play className="size-4" />
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" title="Stop" disabled={a.status === "stopped"} onClick={() => act(a.id, "", "POST", { action: "stop" })}>
                        <Square className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Delete" onClick={() => act(a.id, "", "DELETE")}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Stat icon={<Repeat className="size-3.5" />} label="Calls" value={a.maxCalls > 0 ? `${a.callsMade}/${a.maxCalls}` : String(a.callsMade)} />
                    <Stat icon={<Zap className="size-3.5" />} label="Interval" value={`${a.intervalSec}s`} />
                    <Stat icon={<CircleDollarSign className="size-3.5" />} label="Spent" value={`${formatUsdc(a.spentUsdc)} / ${formatUsdc(a.budgetUsdc)}`} />
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400" style={{ width: `${pct}%` }} />
                  </div>

                  {a.prompt && (
                    <p className="rounded-lg border border-white/10 bg-white/[0.02] p-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Task:</span> {a.prompt}
                      {a.model && <span className="text-muted-foreground"> · {a.model}</span>}
                    </p>
                  )}

                  {a.runs.length > 0 && (
                    <ul className="space-y-2 border-t border-white/5 pt-3">
                      {a.runs.slice(0, 4).map((r) => (
                        <li key={r.id} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                              {r.ok ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <XCircle className="size-3.5 text-red-400" />}
                              <span className="text-muted-foreground">{timeAgo(r.timestamp)}</span>
                              {r.error && <span className="truncate text-red-400/80">· {r.error}</span>}
                            </span>
                            {r.txHash ? (
                              <a href={explorerTxUrl("base", r.txHash)} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-blue-400 hover:underline">
                                {truncateAddress(r.txHash, 8, 6)} <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              <span className="tabular-nums text-muted-foreground">{formatUsdc(r.amountUsdc)}</span>
                            )}
                          </div>
                          {r.ok && r.resultPreview && (
                            <p className="line-clamp-3 rounded bg-white/[0.03] p-2 text-foreground/80">{r.resultPreview}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
