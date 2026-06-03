"use client";

import * as React from "react";
import Link from "next/link";
import {
  Play,
  CreditCard,
  FileJson,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  ShieldCheck,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { CodeBlock } from "@/components/code-block";
import { useWallet } from "@/components/wallet";
import type { Service, ServiceManifest } from "@/lib/types";
import { formatUsdc } from "@/lib/utils";

interface PaidResult {
  status: number;
  ok: boolean;
  latencyMs: number;
  headers?: Record<string, string>;
  bodyPreview?: string;
  paymentResponse?: unknown | null;
}

interface TestCallResult {
  ok: boolean;
  probe?: {
    status: number;
    latencyMs: number;
    is402: boolean;
    paymentRequirement: unknown;
    bodyPreview?: string;
  };
  paid?: PaidResult | null;
  paymentError?: string | null;
  error?: string;
}

// Try to surface an on-chain tx hash from the decoded payment response.
function extractTxHash(paymentResponse: unknown): string | null {
  if (!paymentResponse || typeof paymentResponse !== "object") return null;
  const o = paymentResponse as Record<string, unknown>;
  const candidate = (o.transaction ?? o.txHash ?? o.transactionHash ?? o.hash) as unknown;
  return typeof candidate === "string" && candidate.startsWith("0x") ? candidate : null;
}

export function ServiceActions({ service, manifest }: { service: Service; manifest: ServiceManifest }) {
  const [pending, setPending] = React.useState<null | "probe" | "pay">(null);
  const [result, setResult] = React.useState<TestCallResult | null>(null);
  const wallet = useWallet();

  async function call(pay: boolean) {
    setPending(pay ? "pay" : "probe");
    setResult(null);
    try {
      // Paid call: when wallet connect is configured, the visitor pays from
      // THEIR OWN wallet in the browser. Otherwise fall back to the server payer.
      if (pay && wallet.configured) {
        if (!wallet.connected) {
          setResult({ ok: false, paymentError: "Connect your wallet to pay with your own USDC." });
          wallet.login();
          return;
        }
        try {
          const pr = await wallet.pay(service.endpoint);
          setResult({
            ok: pr.ok,
            paid: {
              status: pr.status,
              ok: pr.ok,
              latencyMs: 0,
              bodyPreview: typeof pr.result === "string" ? pr.result : JSON.stringify(pr.result, null, 2),
              paymentResponse: pr.paymentResponse,
            },
          });
        } catch (e) {
          setResult({ ok: false, paymentError: e instanceof Error ? e.message : "Payment failed or was rejected." });
        }
        return;
      }

      const res = await fetch("/api/test-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service.id, pay }),
      });
      const data = (await res.json()) as TestCallResult;
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setPending(null);
    }
  }

  const explorerTx = (hash: string) =>
    (service.chain === "base" ? "https://basescan.org/tx/" : "https://sepolia.basescan.org/tx/") + hash;
  const txHash = result?.paid ? extractTxHash(result.paid.paymentResponse) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button onClick={() => call(false)} disabled={pending !== null} variant="outline">
          {pending === "probe" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Test Endpoint
        </Button>
        <Button onClick={() => call(true)} disabled={pending !== null}>
          {pending === "pay" ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
          Pay &amp; Call · {formatUsdc(service.priceUsdc)}
        </Button>
        <CopyButton
          variant="secondary"
          value={JSON.stringify(manifest, null, 2)}
          label="Copy Manifest"
          className="w-full"
        >
          <FileJson className="size-4" />
        </CopyButton>
      </div>

      {result && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {result.error ? (
            <div className="flex items-start gap-2 text-sm text-red-400">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Request failed</p>
                <p className="text-muted-foreground">{result.error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Probe (the 402 challenge) — only for the unpaid Test Endpoint */}
              {result.probe && (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {result.probe.is402 ? (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 className="size-4" /> Endpoint challenged with 402
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Info className="size-4" /> Endpoint returned {result.probe.status ?? "—"} (expected 402)
                      </span>
                    )}
                    {result.probe.latencyMs !== undefined && <Badge variant="muted">{result.probe.latencyMs}ms</Badge>}
                    <Badge variant="muted">HTTP {result.probe.status}</Badge>
                  </div>

                  {result.probe.paymentRequirement ? (
                    <CodeBlock
                      language="json"
                      filename="parsed payment requirement"
                      code={JSON.stringify(result.probe.paymentRequirement, null, 2)}
                    />
                  ) : result.probe.bodyPreview ? (
                    <CodeBlock language="text" filename="response preview" code={result.probe.bodyPreview} />
                  ) : null}
                </>
              )}

              {/* Real settlement result */}
              {result.paid && (
                <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-emerald-300">
                    <CheckCircle2 className="size-4" />
                    Paid &amp; called — settled USDC on {service.chain === "base" ? "Base" : "Base Sepolia"}
                    <Badge variant="muted">HTTP {result.paid.status}</Badge>
                    <Badge variant="muted">{result.paid.latencyMs}ms</Badge>
                  </div>
                  {txHash && (
                    <a
                      href={explorerTx(txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-blue-400 hover:underline"
                    >
                      {txHash.slice(0, 18)}…{txHash.slice(-8)} <ExternalLink className="size-3" />
                    </a>
                  )}
                  {result.paid.paymentResponse ? (
                    <CodeBlock
                      language="json"
                      filename="settlement (X-PAYMENT-RESPONSE)"
                      code={JSON.stringify(result.paid.paymentResponse, null, 2)}
                    />
                  ) : null}
                  {result.paid.bodyPreview ? (
                    <CodeBlock language="json" filename="paid response" code={result.paid.bodyPreview} />
                  ) : null}
                </div>
              )}

              {/* Payment couldn't run (e.g. no key configured) */}
              {result.paymentError && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3 text-sm">
                  <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-200">Payment not executed</p>
                    <p className="text-muted-foreground">{result.paymentError}</p>
                    <Link href="/docs#api" className="mt-1 inline-block text-blue-400 hover:underline">
                      How to enable real payments →
                    </Link>
                  </div>
                </div>
              )}

              {!result.paid && !result.paymentError && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Unpaid probe — no USDC moved. Use “Pay &amp; Call” to settle for
                  real.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
