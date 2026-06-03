"use client";

import * as React from "react";
import { Sparkles, Loader2, Wrench, CheckCircle2, XCircle, ExternalLink, CircleDollarSign, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatUsdc, explorerTxUrl, truncateAddress } from "@/lib/utils";

const HERMES_DEFAULT = "nousresearch/hermes-4-405b";

interface Step {
  action: string;
  input?: string;
  observation?: string;
  txHash?: string | null;
  costUsdc: number;
  ok: boolean;
  error?: string;
  thought?: string;
}
interface Result {
  ok: boolean;
  goal: string;
  model: string;
  finalAnswer: string;
  steps: Step[];
  spentUsdc: number;
  error?: string;
}

export function HermesOrchestrator() {
  const [catalog, setCatalog] = React.useState<{ id: string; name: string; provider: string }[]>([]);
  const [goal, setGoal] = React.useState("Summarize what x402 is in 2 sentences, then translate that summary to Spanish.");
  const [model, setModel] = React.useState(HERMES_DEFAULT);
  const [maxSteps, setMaxSteps] = React.useState("6");
  const [budget, setBudget] = React.useState("0.15");
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/models", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCatalog(d.models ?? []))
      .catch(() => {});
  }, []);

  const groups = React.useMemo(() => {
    const by: Record<string, { id: string; name: string }[]> = {};
    for (const m of catalog) (by[m.provider] ??= []).push({ id: m.id, name: m.name });
    return Object.entries(by).sort((a, b) => a[0].localeCompare(b[0]));
  }, [catalog]);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/hermes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, model, maxSteps: Number(maxSteps), budgetUsdc: Number(budget) }),
      });
      const data = (await res.json()) as Result;
      if (!res.ok && !data.steps) throw new Error(data.error ?? "Run failed");
      setResult(data);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      {/* Control */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-blue-400" /> Run a Hermes agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Goal</Label>
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={4} className="font-sans" placeholder="What should the agent accomplish?" />
          </div>
          <div className="space-y-1.5">
            <Label>Brain model {catalog.length > 0 && <span className="text-xs font-normal text-muted-foreground">· {catalog.length} models</span>}</Label>
            <Select value={model} onChange={(e) => setModel(e.target.value)}>
              {catalog.length === 0 && <option value={HERMES_DEFAULT}>Hermes 4 405B</option>}
              {groups.map(([provider, models]) => (
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Max steps</Label>
              <Input type="number" min={1} max={12} value={maxSteps} onChange={(e) => setMaxSteps(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Budget (USDC)</Label>
              <Input type="number" min={0} step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
          </div>
          <p className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs text-muted-foreground">
            The model reasons, then calls paid x402 tools (ask_llm, summarize, extract, translate, hash) — each a real USDC
            settlement on Base. Budget caps total spend.
          </p>
          <Button onClick={run} disabled={running || !goal.trim()} className="w-full">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {running ? "Hermes is working…" : "Run agent"}
          </Button>
          {error && (
            <p className="flex items-center gap-1.5 text-sm text-amber-400">
              <XCircle className="size-4" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Trace */}
      <div className="space-y-4">
        {!result && !running && (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Set a goal and run — the agent&apos;s reasoning, each paid tool call, and its on-chain settlements appear here.
            </CardContent>
          </Card>
        )}
        {running && (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Hermes is reasoning and calling x402 tools…
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{result.model}</Badge>
              <Badge variant="muted">{result.steps.length} steps</Badge>
              <Badge variant="success" className="gap-1">
                <CircleDollarSign className="size-3" /> {formatUsdc(result.spentUsdc)} spent
              </Badge>
            </div>

            {/* Step trace */}
            {result.steps.map((s, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {s.ok ? <CheckCircle2 className="size-4 text-emerald-400" /> : <XCircle className="size-4 text-red-400" />}
                      <Wrench className="size-3.5 text-blue-400" /> {s.action}
                    </span>
                    {s.txHash ? (
                      <a href={explorerTxUrl("base", s.txHash)} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-xs text-blue-400 hover:underline">
                        {truncateAddress(s.txHash, 8, 6)} <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">{s.costUsdc ? formatUsdc(s.costUsdc) : s.error ?? "—"}</span>
                    )}
                  </div>
                  {s.thought && <p className="text-xs italic text-muted-foreground">“{s.thought}”</p>}
                  {s.input && <p className="text-xs"><span className="text-muted-foreground">in:</span> {s.input.slice(0, 200)}</p>}
                  {s.observation && <p className="line-clamp-4 rounded bg-white/[0.03] p-2 text-xs text-foreground/80">{s.observation}</p>}
                  {s.error && !s.observation && <p className="text-xs text-red-400/80">{s.error}</p>}
                </CardContent>
              </Card>
            ))}

            {/* Final answer */}
            <Card className="border-emerald-500/30 bg-emerald-500/[0.05]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-emerald-300">
                  <ArrowRight className="size-4" /> Final answer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{result.finalAnswer}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
