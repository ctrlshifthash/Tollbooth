"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Loader2,
  Globe,
  Wallet,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { VerificationSteps } from "@/components/verification-steps";
import { EmptyState } from "@/components/empty-state";
import type { VerificationRun, VerificationStatus } from "@/lib/types";
import { isValidEthAddress, isValidUrl } from "@/lib/utils";

// The seven stages shown while a run is in flight (mirrors lib/verification.ts).
const PIPELINE = [
  "Endpoint responds",
  "Returns HTTP 402",
  "Payment requirements parsed",
  "Wallet address valid",
  "Test payment prepared",
  "Base settlement verified",
  "Valid response returned",
];

function VerifyInner() {
  const params = useSearchParams();
  const [endpoint, setEndpoint] = React.useState(params.get("endpoint") ?? "");
  const [wallet, setWallet] = React.useState(params.get("wallet") ?? "");
  const serviceId = params.get("serviceId") ?? undefined;

  const [running, setRunning] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState(0);
  const [run, setRun] = React.useState<VerificationRun | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canRun = isValidUrl(endpoint) && isValidEthAddress(wallet);

  async function start() {
    if (!canRun) {
      setError("Enter a valid endpoint URL and 0x wallet address.");
      return;
    }
    setError(null);
    setRun(null);
    setRunning(true);
    setActiveStep(0);

    // Animate the pipeline progressing while the real request is in flight.
    const ticker = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, PIPELINE.length - 1));
    }, 360);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, wallet, serviceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed");
      } else {
        setRun(data.verification as VerificationRun);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      clearInterval(ticker);
      setActiveStep(PIPELINE.length - 1);
      setRunning(false);
    }
  }

  function reset() {
    setRun(null);
    setError(null);
    setActiveStep(0);
  }

  return (
    <div className="container max-w-4xl py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"><ShieldCheck className="size-3.5" /> Live x402 verification</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Verify an x402 endpoint</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">We probe the endpoint, confirm a real HTTP 402, parse the payment requirements, validate the wallet, then
          attempt a paid replay when <code>X402_EVM_PRIVATE_KEY</code> is configured. Nothing is faked.</p>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label>Endpoint URL</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://api.service.com/v1/route"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Wallet (payTo)</Label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0xâ€¦"
                className="pl-9 font-mono"
              />
            </div>
          </div>
          <Button onClick={start} disabled={running} size="lg" className="sm:mb-0">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {running ? "Running" : "Verify"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <XCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {/* In-flight pipeline */}
      {running && !run && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="size-4 animate-spin text-blue-400" /> Verifying endpointâ€¦
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {PIPELINE.map((label, i) => {
                const state = i < activeStep ? "done" : i === activeStep ? "active" : "idle";
                return (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        state === "done"
                          ? "grid size-6 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"
                          : state === "active"
                          ? "grid size-6 place-items-center rounded-full bg-blue-500/15 text-blue-400"
                          : "grid size-6 place-items-center rounded-full bg-white/5 text-muted-foreground"
                      }
                    >
                      {state === "done" ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : state === "active" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Clock className="size-3.5" />
                      )}
                    </span>
                    <span className={state === "idle" ? "text-muted-foreground" : ""}>{label}</span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {run && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <ResultIcon status={run.status} /> Verification {run.status}
              </CardTitle>
              <div className="flex items-center gap-2">
                <StatusBadge status={run.status} />
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RotateCcw className="size-4" /> Run again
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2 text-sm">
              {run.httpStatus !== undefined && <Badge variant="muted">HTTP {run.httpStatus}</Badge>}
              {run.latencyMs !== undefined && <Badge variant="muted">{run.latencyMs}ms</Badge>}
              {run.paymentRequirement && (
                <Badge variant="default">
                  {run.paymentRequirement.scheme} Â· {run.paymentRequirement.network}
                </Badge>
              )}
            </div>
            <VerificationSteps steps={run.steps} animate />
            {run.error && <p className="text-sm text-red-400">{run.error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Empty / idle */}
      {!running && !run && !error && (
        <div className="mt-6">
          <EmptyState
            icon={<ShieldCheck className="size-6" />}
            title="Ready to verify"
            description="Enter an x402 endpoint and the wallet that should receive payment, then run the live verification pipeline."
          />
        </div>
      )}
    </div>
  );
}

function ResultIcon({ status }: { status: VerificationStatus }) {
  if (status === "verified") return <CheckCircle2 className="size-5 text-emerald-400" />;
  if (status === "failed") return <XCircle className="size-5 text-red-400" />;
  return <Clock className="size-5 text-amber-400" />;
}

export default function VerifyPage() {
  return (
    <React.Suspense
      fallback={
        <div className="container flex max-w-4xl items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <VerifyInner />
    </React.Suspense>
  );
}
