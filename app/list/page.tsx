"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plug,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Wand2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { VerificationSteps } from "@/components/verification-steps";
import { Wallet } from "lucide-react";
import { useWallet } from "@/components/wallet";
import { CATEGORIES } from "@/lib/types";
import type { Service, VerificationRun } from "@/lib/types";
import { isValidEthAddress, isValidUrl, truncateAddress } from "@/lib/utils";

const DEFAULT_INPUT = `{
  "type": "object",
  "properties": { "prompt": { "type": "string" } },
  "required": ["prompt"]
}`;

const DEFAULT_OUTPUT = `{
  "type": "object",
  "properties": { "result": { "type": "string" } }
}`;

interface FormState {
  name: string;
  endpoint: string;
  category: string;
  priceUsdc: string;
  wallet: string;
  chain: string;
  description: string;
  inputSchema: string;
  outputSchema: string;
  agentHandle: string;
  agentName: string;
}

const EMPTY: FormState = {
  name: "",
  endpoint: "",
  category: "ai-inference",
  priceUsdc: "0.01",
  wallet: "",
  chain: "base",
  description: "",
  inputSchema: DEFAULT_INPUT,
  outputSchema: DEFAULT_OUTPUT,
  agentHandle: "",
  agentName: "",
};

export default function ListServicePage() {
  const wallet = useWallet();
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ service: Service; verification: VerificationRun } | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // The connected wallet is the payTo / owner. Keep the wallet field in sync so
  // every listing is owned by the lister and shows up in their dashboard.
  React.useEffect(() => {
    if (wallet.connected && wallet.address) {
      setForm((f) => ({ ...f, wallet: wallet.address as string }));
    }
  }, [wallet.connected, wallet.address]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!isValidUrl(form.endpoint)) e.endpoint = "Enter a valid http(s) URL";
    if (!isValidEthAddress(form.wallet)) e.wallet = "Enter a valid 0x wallet address";
    if (Number.isNaN(Number(form.priceUsdc)) || Number(form.priceUsdc) < 0) e.priceUsdc = "Enter a valid price";
    for (const [k, label] of [
      ["inputSchema", "Input schema"],
      ["outputSchema", "Output schema"],
    ] as const) {
      if (form[k].trim()) {
        try {
          JSON.parse(form[k]);
        } catch {
          e[k] = `${label} must be valid JSON`;
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          priceUsdc: Number(form.priceUsdc),
          // Create / brand the owner agent for this wallet.
          agent: { handle: form.agentHandle, displayName: form.agentName },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Submission failed");
        if (data.errors) setErrors(data.errors);
        return;
      }
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  function fillSample() {
    setForm((f) => ({
      ...f,
      name: "Sentiment API",
      endpoint: "https://api.example.com/v1/sentiment",
      category: "ai-inference",
      priceUsdc: "0.004",
      // Keep the connected wallet as the owner; don't inject a fake address.
      wallet: wallet.connected && wallet.address ? wallet.address : f.wallet,
      chain: "base",
      description: "Classify text sentiment (positive / neutral / negative) with a confidence score. Pay per call.",
      inputSchema: DEFAULT_INPUT,
      outputSchema: `{
  "type": "object",
  "properties": {
    "label": { "type": "string" },
    "score": { "type": "number" }
  }
}`,
    }));
    setErrors({});
  }

  // ----- Result view -----
  if (result) {
    const ok = result.verification.status === "verified";
    const pending = result.verification.status === "pending";
    return (
      <div className="container max-w-3xl py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={
                    ok
                      ? "grid size-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400"
                      : pending
                      ? "grid size-11 place-items-center rounded-xl bg-amber-500/15 text-amber-400"
                      : "grid size-11 place-items-center rounded-xl bg-red-500/15 text-red-400"
                  }
                >
                  {ok ? <CheckCircle2 className="size-6" /> : pending ? <ShieldCheck className="size-6" /> : <XCircle className="size-6" />}
                </span>
                <div>
                  <CardTitle>{result.service.name} submitted</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Verification {result.verification.status} Â· live endpoint probe
                  </p>
                </div>
              </div>
              <StatusBadge status={result.verification.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {pending && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                Status is <strong>pending</strong> until the full x402 paid replay completes successfully. Configure a
                funded <code>X402_EVM_PRIVATE_KEY</code> to run the payment step.
              </p>
            )}
            <VerificationSteps steps={result.verification.steps} animate />
            <div className="flex flex-wrap gap-3 border-t border-white/5 pt-5">
              <Link href={`/services/${result.service.slug}`}>
                <Button>
                  View service page <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href={`/verify?endpoint=${encodeURIComponent(result.service.endpoint)}&wallet=${result.service.wallet}&serviceId=${result.service.id}`}>
                <Button variant="outline">Re-run verification</Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setForm(EMPTY);
                }}
              >
                List another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Form view -----
  return (
    <div className="container max-w-3xl py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0000ff]/40 bg-[#0000ff]/10 px-3 py-1 text-xs font-medium text-blue-200">
            <Plug className="size-3.5" /> Register an endpoint
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">List a service</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Submit your x402 endpoint. On submit we run a live verification â€” reaching the endpoint, checking for a 402,
            and parsing the payment requirements.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={fillSample} className="shrink-0">
          <Wand2 className="size-4" /> Fill sample
        </Button>
      </div>

      {serverError && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertTriangle className="size-4 shrink-0" /> {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Service name" error={errors.name}>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="LLM Router" />
            </Field>
            <Field label="Endpoint URL" error={errors.endpoint} hint="The URL agents will call. Must return 402 to unpaid requests.">
              <Input
                value={form.endpoint}
                onChange={(e) => set("endpoint", e.target.value)}
                placeholder="https://api.yourservice.com/v1/route"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" error={errors.category}>
                <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Price per call (USDC)" error={errors.priceUsdc}>
                <Input type="number" min={0} step="0.001" value={form.priceUsdc} onChange={(e) => set("priceUsdc", e.target.value)} />
              </Field>
            </div>
            <Field label="Description" hint="One or two sentences agents will read in the directory.">
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="What does this service do?"
                className="font-sans"
                rows={3}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your agent &amp; payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Connected wallet = the owner of this listing */}
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
              {wallet.connected && wallet.address ? (
                <div className="flex items-center gap-2 text-sm">
                  <Wallet className="size-4 text-emerald-400" />
                  <span>
                    Listing as <span className="font-mono">{truncateAddress(wallet.address, 8, 6)}</span>
                    {wallet.balance !== null && <span className="text-muted-foreground"> · {wallet.balance.toFixed(2)} USDC</span>}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="size-4 text-blue-400" />
                  {wallet.configured ? "Connect your wallet to own this listing." : "Wallet connect not configured — enter a payTo wallet manually."}
                </div>
              )}
              {wallet.configured && !wallet.connected && (
                <Button type="button" size="sm" onClick={wallet.login} disabled={!wallet.ready}>
                  <Wallet className="size-4" /> Connect wallet
                </Button>
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your agent handle" hint="Your operator profile (auto-created from your wallet if blank).">
                <Input value={form.agentHandle} onChange={(e) => set("agentHandle", e.target.value)} placeholder="acme-labs" />
              </Field>
              <Field label="Agent display name">
                <Input value={form.agentName} onChange={(e) => set("agentName", e.target.value)} placeholder="Acme Labs" />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
              <Field label="Wallet address (payTo)" error={errors.wallet} hint="Receives USDC settlements. Auto-filled from your connected wallet.">
                <Input
                  value={form.wallet}
                  onChange={(e) => set("wallet", e.target.value)}
                  placeholder="0x…"
                  className="font-mono"
                  readOnly={wallet.connected}
                />
              </Field>
              <Field label="Chain">
                <Select value={form.chain} onChange={(e) => set("chain", e.target.value)}>
                  <option value="base">Base</option>
                  <option value="base-sepolia">Base Sepolia</option>
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schemas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <Field label="Input schema (JSON)" error={errors.inputSchema}>
              <Textarea value={form.inputSchema} onChange={(e) => set("inputSchema", e.target.value)} rows={8} />
            </Field>
            <Field label="Output schema (JSON)" error={errors.outputSchema}>
              <Textarea value={form.outputSchema} onChange={(e) => set("outputSchema", e.target.value)} rows={8} />
            </Field>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-blue-400" />
            We never fake a verified badge â€” status reflects the live probe result.
          </p>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
            {submitting ? "Verifyingâ€¦" : "Submit & verify"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {error && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="size-3" /> {error}
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
