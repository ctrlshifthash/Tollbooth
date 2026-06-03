"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag, Loader2, ExternalLink, Boxes, Bot, Sparkles, Tag, CheckCircle2, Rocket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { CopyButton } from "@/components/copy-button";
import { useWallet } from "@/components/wallet";
import type { Purchase } from "@/lib/types";
import { formatUsdc, explorerTxUrl, truncateAddress, timeAgo } from "@/lib/utils";

const ICON: Record<string, React.ReactNode> = {
  service: <Boxes className="size-3.5" />,
  agent: <Bot className="size-3.5" />,
  automation: <Sparkles className="size-3.5" />,
  other: <Tag className="size-3.5" />,
};

// Wallet-gated: what this wallet has bought on the marketplace + the deliverable,
// with a one-click action to put it to use (deploy automation / clone agent).
export function MyPurchases() {
  const wallet = useWallet();
  const [purchases, setPurchases] = React.useState<Purchase[] | null>(null);
  const [acting, setActing] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    if (!wallet.address) return setPurchases(null);
    const res = await fetch(`/api/purchases?buyer=${wallet.address}`, { cache: "no-store" });
    const data = await res.json();
    setPurchases((data.purchases as Purchase[]) ?? []);
  }, [wallet.address]);

  React.useEffect(() => {
    if (wallet.connected) load();
    else setPurchases(null);
  }, [wallet.connected, load]);

  async function deployAutomation(p: Purchase) {
    if (!wallet.address) return;
    setActing(p.id);
    try {
      const d = p.deliverable.data as Record<string, unknown>;
      const res = await fetch("/api/autonomous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerWallet: wallet.address,
          targetServiceId: d.targetServiceId,
          name: p.title,
          prompt: d.prompt,
          model: d.model,
          intervalSec: Number(d.intervalSec) || 60,
          budgetUsdc: Number(d.budgetUsdc) || 0.1,
        }),
      });
      if (res.ok) setDone((s) => ({ ...s, [p.id]: "Deployed to your agents." }));
    } finally {
      setActing(null);
    }
  }

  async function cloneAgent(p: Purchase) {
    if (!wallet.address) return;
    setActing(p.id);
    try {
      const d = p.deliverable.data as Record<string, unknown>;
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.address, displayName: d.displayName, bio: d.bio }),
      });
      if (res.ok) setDone((s) => ({ ...s, [p.id]: "Added to your agents." }));
    } finally {
      setActing(null);
    }
  }

  if (!wallet.connected) return null;

  if (purchases === null) {
    return <Card><CardContent className="flex justify-center py-8 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></CardContent></Card>;
  }
  if (purchases.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-6" />}
        title="No purchases yet"
        description="Things you buy on the Marketplace show up here, ready to use."
        action={<Link href="/marketplace"><Button variant="outline">Browse marketplace</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {purchases.map((p) => {
        const d = p.deliverable;
        return (
          <Card key={p.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{p.title}</span>
                    <Badge variant="muted" className="capitalize">{ICON[p.type]} {p.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatUsdc(p.amountUsdc)} · from {truncateAddress(p.sellerWallet)} · {timeAgo(p.timestamp)}
                  </p>
                </div>
                {p.txHash && (
                  <a href={explorerTxUrl("base", p.txHash)} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-xs text-blue-400 hover:underline">
                    {truncateAddress(p.txHash, 8, 6)} <ExternalLink className="size-3" />
                  </a>
                )}
              </div>

              {/* Deliverable */}
              {d.kind === "service-access" && (
                <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs">{String((d.data as Record<string, unknown>).endpoint ?? "")}</span>
                    <CopyButton value={String((d.data as Record<string, unknown>).endpoint ?? "")} label="" variant="ghost" size="icon" className="size-7" />
                  </div>
                  <CopyButton value={JSON.stringify((d.data as Record<string, unknown>).manifest ?? {}, null, 2)} label="Copy manifest" variant="outline" size="sm" />
                </div>
              )}
              {d.kind === "automation-template" && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
                  <span className="text-muted-foreground">{d.note}</span>
                  {done[p.id] ? (
                    <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="size-4" /> {done[p.id]}</span>
                  ) : (
                    <Button size="sm" disabled={acting === p.id} onClick={() => deployAutomation(p)}>
                      {acting === p.id ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Deploy
                    </Button>
                  )}
                </div>
              )}
              {d.kind === "agent-template" && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">
                  <span className="text-muted-foreground">{d.note}</span>
                  {done[p.id] ? (
                    <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="size-4" /> {done[p.id]}</span>
                  ) : (
                    <Button size="sm" disabled={acting === p.id} onClick={() => cloneAgent(p)}>
                      {acting === p.id ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />} Add to my agents
                    </Button>
                  )}
                </div>
              )}
              {d.kind === "content" && (
                <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm">{String((d.data as Record<string, unknown>).content ?? "")}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
