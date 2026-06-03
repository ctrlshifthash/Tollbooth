"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Search, Loader2, XCircle, KeyRound, PenLine, BadgeCheck, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { ClaimOwnership } from "@/components/claim-ownership";
import type { Service } from "@/lib/types";
import { truncateAddress } from "@/lib/utils";

export default function ClaimPage() {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [service, setService] = React.useState<Service | null>(null);

  async function lookup() {
    setError(null);
    setService(null);
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      // Try direct id/slug first.
      let res = await fetch(`/api/services/${encodeURIComponent(q)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setService(data.service as Service);
        return;
      }
      // Fall back to matching by endpoint URL.
      res = await fetch("/api/services", { cache: "no-store" });
      const all = (await res.json()).services as Service[];
      const match = all.find((s) => s.endpoint === q || s.endpoint === q.replace(/\/$/, ""));
      if (match) setService(match);
      else setError("No service found for that ID, slug, or endpoint URL.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container max-w-3xl py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"><ShieldCheck className="size-3.5" /> Ownership claim</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Claim a service</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">Prove you control a listed or discovered service by signing a nonce with its payTo wallet. No transaction, no
          gas. Ownership is only marked verified when the signature checks out.</p>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Step n="1" icon={<KeyRound className="size-4" />} title="Generate nonce" body="We issue a unique, time-boxed message tied to this service + wallet." />
        <Step n="2" icon={<PenLine className="size-4" />} title="Sign message" body="Your wallet signs it (EIP-191 personal_sign). Nothing is broadcast on-chain." />
        <Step n="3" icon={<BadgeCheck className="size-4" />} title="Verify signature" body="The server recovers the signer with viem and confirms it matches." />
      </div>

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label>Service ID, slug, or endpoint URL</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder="agent402-echo  ·  https://api.you.dev/x402"
                className="pl-9"
              />
            </div>
          </div>
          <Button onClick={lookup} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Look up
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <XCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {service && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link href={`/services/${service.slug}`} className="hover:text-blue-400">
                      {service.name}
                    </Link>
                    <StatusBadge status={service.verificationStatus} />
                  </CardTitle>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{service.endpoint}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {service.demo && <Badge variant="warning">Demo</Badge>}
                  <span className="font-mono text-xs text-muted-foreground">payTo {truncateAddress(service.wallet)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href={`/services/${service.slug}`} className="inline-flex items-center gap-1 text-sm text-blue-400 hover:underline">
                View full service <ArrowRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>

          {/* Real claim flow (connect → nonce → sign → verify) */}
          <ClaimOwnership serviceId={service.id} payTo={service.wallet} initial={service.ownership} />
        </div>
      )}
    </div>
  );
}

function Step({ n, icon, title, body }: { n: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full border border-primary/30 bg-primary/10 font-mono text-xs text-blue-300">
          {n}
        </span>
        <span className="text-blue-400">{icon}</span>
      </div>
      <h4 className="text-sm font-medium">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
