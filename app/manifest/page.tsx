"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileJson,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Wand2,
  Boxes,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { formatUsdc, truncateAddress } from "@/lib/utils";

const SAMPLE = `{
  "schema": "agent402/manifest@1",
  "name": "Sentiment API",
  "description": "Classify text sentiment with a confidence score.",
  "category": "ai-inference",
  "endpoint": "https://api.example.com/v1/sentiment",
  "x402": {
    "network": "base",
    "scheme": "exact",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x9A7c1F3B2e4D5a6c7B8e9F0a1b2C3d4E5f6A7b8C",
    "maxAmountRequired": "4000"
  },
  "input": { "type": "object", "properties": { "text": { "type": "string" } } },
  "output": { "type": "object", "properties": { "label": { "type": "string" } } }
}`;

interface PreviewService {
  ok: boolean;
  name?: string;
  category?: string;
  endpoint?: string;
  wallet?: string;
  network?: string;
  priceUsdc?: number;
  errors?: string[];
}
interface PreviewResponse {
  valid: boolean;
  services: PreviewService[];
  agents: { wallet: string; existing: boolean }[];
}
interface ImportResult {
  ingested: number;
  failed: number;
  results: { ok: boolean; name?: string; slug?: string; status?: string; errors?: string[] }[];
}

function normalize(parsed: unknown) {
  if (Array.isArray(parsed)) return { manifests: parsed };
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.manifests)) return { manifests: o.manifests, agent: o.agent };
    if (o.manifest) return { manifests: [o.manifest], agent: o.agent };
    return { manifests: [parsed] };
  }
  return { manifests: [parsed] };
}

export default function ManifestPage() {
  const [text, setText] = React.useState("");
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [validating, setValidating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [imported, setImported] = React.useState<ImportResult | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setPreview(null);
      setImported(null);
    };
    reader.readAsText(f);
  }

  async function validate() {
    setParseError(null);
    setPreview(null);
    setImported(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }
    setValidating(true);
    try {
      const res = await fetch("/api/manifests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validateOnly: true, ...normalize(parsed) }),
      });
      const data = (await res.json()) as PreviewResponse;
      setPreview(data);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Validation request failed");
    } finally {
      setValidating(false);
    }
  }

  async function doImport() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/manifests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalize(parsed)),
      });
      const data = (await res.json()) as ImportResult;
      setImported(data);
    } catch {
      /* surfaced below as no-result */
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="container max-w-5xl py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"><FileJson className="size-3.5" /> Manifest import</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Import an Tollbooth manifest</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">Paste or upload an <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">agent402/manifest@1</code>{" "}
          document (one manifest, or many). We validate the schema, preview the detected agent and services, then run
          each through the live verification flow on import.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Editor */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Manifest JSON</CardTitle>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Upload
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setText(SAMPLE); setPreview(null); setImported(null); }}>
                <Wand2 className="size-4" /> Sample
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setPreview(null); setImported(null); }}
              rows={18}
              placeholder="Paste manifest JSON here…"
              className="text-xs"
            />
            {parseError && (
              <p className="flex items-center gap-1.5 text-sm text-red-400">
                <AlertTriangle className="size-4" /> {parseError}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={validate} disabled={!text.trim() || validating} variant="outline">
                {validating ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Validate &amp; preview
              </Button>
              <Button onClick={doImport} disabled={!preview?.valid || importing}>
                {importing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Import Manifest
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview / result */}
        <div className="space-y-4">
          {imported ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="size-4 text-emerald-400" /> Imported {imported.ingested} ·{" "}
                  {imported.failed} failed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {imported.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] p-3 text-sm">
                    {r.ok ? (
                      <>
                        <Link href={`/services/${r.slug}`} className="font-medium hover:text-blue-400">
                          {r.name}
                        </Link>
                        <div className="flex items-center gap-2">
                          {r.status && <StatusBadge status={r.status as never} />}
                          <Link href={`/services/${r.slug}`}>
                            <Button size="sm" variant="ghost"><ArrowRight className="size-4" /></Button>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <span className="text-red-400">{r.errors?.join("; ")}</span>
                    )}
                  </div>
                ))}
                <p className="pt-1 text-xs text-muted-foreground">
                  Each imported service ran the live verification pipeline; status reflects the real result.
                </p>
              </CardContent>
            </Card>
          ) : preview ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wallet className="size-4 text-blue-400" /> Detected agent{preview.agents.length === 1 ? "" : "s"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {preview.agents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No valid agent wallet detected.</p>
                  ) : (
                    preview.agents.map((a) => (
                      <div key={a.wallet} className="flex items-center justify-between rounded-lg bg-white/[0.03] p-3 text-sm">
                        <span className="font-mono text-xs">{truncateAddress(a.wallet)}</span>
                        <Badge variant={a.existing ? "secondary" : "default"}>
                          {a.existing ? "existing agent" : "new agent"}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Boxes className="size-4 text-blue-400" /> Detected services ({preview.services.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {preview.services.map((s, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      {s.ok ? (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                              <span className="font-medium">{s.name}</span>
                            </div>
                            <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{s.endpoint}</div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                            <Badge variant="muted">{s.category}</Badge>
                            <span className="text-muted-foreground">{formatUsdc(s.priceUsdc ?? 0)} · {s.network}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-sm text-red-400">
                          <XCircle className="mt-0.5 size-4 shrink-0" />
                          <ul className="space-y-0.5">
                            {s.errors?.map((e, j) => <li key={j}>{e}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                  {!preview.valid && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-400">
                      <AlertTriangle className="size-3.5" /> Fix the errors above before importing.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
                <FileJson className="mb-3 size-8 opacity-40" />
                Paste a manifest and click <span className="mx-1 font-medium text-foreground">Validate &amp; preview</span> to
                see the detected agent and services.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
