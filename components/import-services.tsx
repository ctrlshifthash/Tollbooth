"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Radar, Loader2, Github, Globe, Sparkles, AlertTriangle, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface CrawlReport {
  source: string;
  scanned: number;
  discovered: number;
  placeholder?: boolean;
  note?: string;
}

// Import / discover panel. Pulls real services from the Coinbase x402 Bazaar or
// crawls external sources, then refreshes the directory. Lives on the Services
// page — discovery and the directory are one surface now.
export function ImportServices() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const [manualOn, setManualOn] = React.useState(false);
  const [manual, setManual] = React.useState("");
  const [githubOn, setGithubOn] = React.useState(false);
  const [githubQuery, setGithubQuery] = React.useState("x402 base agent");
  const [farcasterOn, setFarcasterOn] = React.useState(false);
  const [virtualsOn, setVirtualsOn] = React.useState(false);

  const [running, setRunning] = React.useState(false);
  const [bazaarBusy, setBazaarBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reports, setReports] = React.useState<CrawlReport[] | null>(null);

  async function syncBazaar() {
    setBazaarBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/bazaar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bazaar sync failed");
      setMsg(`Imported ${data.imported} live services (${data.skippedExisting} already listed) from ${data.baseServices} Base resources. Use the “Unverified” status filter or “Show discovered” to see them.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bazaar sync failed");
    } finally {
      setBazaarBusy(false);
    }
  }

  async function runCrawl() {
    setRunning(true);
    setError(null);
    setReports(null);
    try {
      const urls = manual.split(/\s+/).map((u) => u.trim()).filter(Boolean);
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual: manualOn && urls.length ? urls : undefined,
          github: githubOn ? { query: githubQuery, limit: 12 } : undefined,
          farcaster: farcasterOn || undefined,
          virtuals: virtualsOn || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Crawl failed");
      setReports(data.reports as CrawlReport[]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crawl failed");
    } finally {
      setRunning(false);
    }
  }

  const noneOn = !manualOn && !githubOn && !farcasterOn && !virtualsOn;

  return (
    <Card className="mb-6">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary"><Radar className="size-4" /></span>
          <div>
            <div className="text-sm font-semibold">Import &amp; discover services</div>
            <div className="text-xs text-muted-foreground">Pull the live Coinbase x402 Bazaar registry, or crawl external sources.</div>
          </div>
        </div>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <CardContent className="space-y-4 border-t border-white/5 pt-4">
          {/* Bazaar — the real one */}
          <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <div className="text-sm font-semibold">x402 Bazaar <span className="ml-1 text-xs font-normal text-emerald-400">● live network</span></div>
                <p className="text-xs text-muted-foreground">Real registered x402 resources from Coinbase&apos;s CDP discovery network (Base mainnet).</p>
                {msg && <p className="mt-1.5 text-xs text-blue-300">{msg}</p>}
              </div>
            </div>
            <Button onClick={syncBazaar} disabled={bazaarBusy} className="shrink-0">
              {bazaarBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {bazaarBusy ? "Importing…" : "Import from Bazaar"}
            </Button>
          </div>

          {/* External crawl sources */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SourceCard icon={<Globe className="size-4" />} title="Manual URLs" on={manualOn} onToggle={() => setManualOn((v) => !v)}>
              {manualOn && <Textarea rows={2} value={manual} onChange={(e) => setManual(e.target.value)} placeholder={"https://api.example.com/paid"} className="text-xs" />}
            </SourceCard>
            <SourceCard icon={<Github className="size-4" />} title="GitHub repos" on={githubOn} onToggle={() => setGithubOn((v) => !v)}>
              {githubOn && <Input value={githubQuery} onChange={(e) => setGithubQuery(e.target.value)} className="text-xs" />}
            </SourceCard>
            <SourceCard icon={<Sparkles className="size-4" />} title="Farcaster" on={farcasterOn} onToggle={() => setFarcasterOn((v) => !v)} placeholder />
            <SourceCard icon={<Sparkles className="size-4" />} title="Virtuals" on={virtualsOn} onToggle={() => setVirtualsOn((v) => !v)} placeholder />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={runCrawl} disabled={running || noneOn}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
              {running ? "Crawling…" : "Run crawl"}
            </Button>
            {noneOn && <span className="text-xs text-muted-foreground">Toggle a source, or use Import from Bazaar above.</span>}
            {error && <span className="flex items-center gap-1.5 text-sm text-red-400"><AlertTriangle className="size-4" /> {error}</span>}
            {reports?.map((r) => (
              <Badge key={r.source} variant={r.placeholder ? "muted" : r.discovered ? "success" : "secondary"} className="capitalize">
                {r.source}: {r.discovered}/{r.scanned}{r.placeholder ? " (placeholder)" : ""}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SourceCard({
  icon,
  title,
  on,
  onToggle,
  placeholder,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  on: boolean;
  onToggle: () => void;
  placeholder?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 ${on ? "border-primary/40" : "border-border"}`}>
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="text-primary">{icon}</span>
          {title}
          {placeholder && <Badge variant="muted">soon</Badge>}
        </span>
        <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-white/10"}`}>
          <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
        </span>
      </button>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
