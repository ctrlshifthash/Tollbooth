"use client";

import * as React from "react";
import Link from "next/link";
import {
  Store,
  Loader2,
  Wallet,
  Plus,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Boxes,
  Bot,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { useWallet } from "@/components/wallet";
import type { Agent, MarketplaceListing, Service } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { formatUsdc, truncateAddress, explorerTxUrl } from "@/lib/utils";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  service: { label: "Service / API", icon: <Boxes className="size-3.5" /> },
  agent: { label: "Agent", icon: <Bot className="size-3.5" /> },
  automation: { label: "Automation", icon: <Sparkles className="size-3.5" /> },
  other: { label: "Other", icon: <Tag className="size-3.5" /> },
};

interface BuyState {
  listingId: string;
  ok: boolean;
  txHash?: string | null;
  error?: string;
}

export function MarketplaceBrowser() {
  const wallet = useWallet();
  const [listings, setListings] = React.useState<MarketplaceListing[] | null>(null);
  const [fType, setFType] = React.useState("all");
  const [fCategory, setFCategory] = React.useState("all");
  const [showList, setShowList] = React.useState(false);
  const [buying, setBuying] = React.useState<string | null>(null);
  const [buyState, setBuyState] = React.useState<BuyState | null>(null);

  const load = React.useCallback(async () => {
    const qs = new URLSearchParams({ type: fType, category: fCategory });
    const res = await fetch(`/api/marketplace?${qs}`, { cache: "no-store" });
    const data = await res.json();
    setListings((data.listings as MarketplaceListing[]) ?? []);
  }, [fType, fCategory]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function buy(l: MarketplaceListing) {
    setBuyState(null);
    if (l.demo) {
      setBuyState({ listingId: l.id, ok: false, error: "This listing is currently unavailable." });
      return;
    }
    if (!wallet.connected) {
      wallet.login();
      return;
    }
    if (wallet.address && l.sellerWallet.toLowerCase() === wallet.address.toLowerCase()) {
      setBuyState({ listingId: l.id, ok: false, error: "You can't buy your own listing." });
      return;
    }
    setBuying(l.id);
    try {
      const r = await wallet.buy(l.id);
      setBuyState({ listingId: l.id, ok: r.ok, txHash: r.txHash, error: r.ok ? undefined : r.error ?? "Purchase failed" });
      if (r.ok) await load();
    } catch (e) {
      setBuyState({ listingId: l.id, ok: false, error: e instanceof Error ? e.message : "Purchase failed or was rejected." });
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={fType} onChange={(e) => setFType(e.target.value)} className="w-auto min-w-[140px]">
          <option value="all">All types</option>
          <option value="service">Services / APIs</option>
          <option value="agent">Agents</option>
          <option value="automation">Automations</option>
          <option value="other">Other</option>
        </Select>
        <Select value={fCategory} onChange={(e) => setFCategory(e.target.value)} className="w-auto min-w-[150px]">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <div className="ml-auto">
          <Button onClick={() => setShowList((v) => !v)}>
            {showList ? <X className="size-4" /> : <Plus className="size-4" />}
            {showList ? "Close" : "List something"}
          </Button>
        </div>
      </div>

      {showList && <ListingForm onCreated={() => { setShowList(false); load(); }} />}

      {/* Buy feedback */}
      {buyState && (
        <div
          className={
            buyState.ok
              ? "flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
              : "flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          }
        >
          {buyState.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
          {buyState.ok ? (
            <span className="flex flex-wrap items-center gap-2">
              Purchased — delivered to your <Link href="/dashboard" className="underline">dashboard</Link>.
              {buyState.txHash && (
                <a href={explorerTxUrl("base", buyState.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs hover:underline">
                  {truncateAddress(buyState.txHash, 8, 6)} <ExternalLink className="size-3" />
                </a>
              )}
            </span>
          ) : (
            <span>{buyState.error}</span>
          )}
        </div>
      )}

      {/* Listings */}
      {listings === null ? (
        <Card><CardContent className="flex justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></CardContent></Card>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={<Store className="size-6" />}
          title="Nothing listed yet"
          description="Be the first — list a service, an agent, or an automation. Buyers pay in USDC on Base and it settles straight to your wallet."
          action={<Button onClick={() => setShowList(true)}><Plus className="size-4" /> List something</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Card key={l.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{l.title}</h3>
                <Badge variant="muted" className="shrink-0 capitalize">
                  {TYPE_META[l.type]?.icon} {TYPE_META[l.type]?.label ?? l.type}
                </Badge>
              </div>
              <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{l.description || "—"}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Wallet className="size-3" /> {truncateAddress(l.sellerWallet)}</span>
                <span>{l.sales} sold</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/5 pt-4">
                <span className="text-lg font-bold tabular-nums">{formatUsdc(l.priceUsdc)}</span>
                <Button size="sm" disabled={buying === l.id} onClick={() => buy(l)}>
                  {buying === l.id ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                  Buy
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------

function ListingForm({ onCreated }: { onCreated: () => void }) {
  const wallet = useWallet();
  const [type, setType] = React.useState("service");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("tools");
  const [price, setPrice] = React.useState("1.00");
  const [serviceId, setServiceId] = React.useState("");
  const [content, setContent] = React.useState("");
  // automation fields
  const [autoTarget, setAutoTarget] = React.useState("");
  const [autoPrompt, setAutoPrompt] = React.useState("");
  const [autoModel, setAutoModel] = React.useState("");

  const [services, setServices] = React.useState<Service[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [agentId, setAgentId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/services", { cache: "no-store" }).then((r) => r.json()).then((d) => setServices((d.services as Service[]) ?? [])).catch(() => {});
    fetch("/api/agents", { cache: "no-store" }).then((r) => r.json()).then((d) => setAgents((d.agents as Agent[]) ?? [])).catch(() => {});
  }, []);

  const myServices = wallet.address ? services.filter((s) => s.wallet.toLowerCase() === wallet.address!.toLowerCase() || s.ownership?.wallet?.toLowerCase() === wallet.address!.toLowerCase()) : [];
  const myAgents = wallet.address ? agents.filter((a) => a.wallet.toLowerCase() === wallet.address!.toLowerCase()) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!wallet.connected || !wallet.address) {
      wallet.login();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          description,
          category,
          priceUsdc: Number(price),
          sellerWallet: wallet.address,
          sellerAgentId: agentId || undefined,
          serviceId: type === "service" ? serviceId : undefined,
          content: type === "other" ? content : undefined,
          targetServiceId: type === "automation" ? autoTarget : undefined,
          prompt: type === "automation" ? autoPrompt : undefined,
          model: type === "automation" ? autoModel : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create listing");
        return;
      }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">List something to sell</CardTitle>
      </CardHeader>
      <CardContent>
        {!wallet.connected ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Connect your wallet — sales settle to it in USDC on Base.</span>
            <Button onClick={wallet.login} disabled={!wallet.configured}><Wallet className="size-4" /> Connect</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Listing as <span className="font-mono text-foreground">{truncateAddress(wallet.address ?? "")}</span> · you own{" "}
              <span className="text-foreground">{myServices.length}</span> service{myServices.length === 1 ? "" : "s"} and{" "}
              <span className="text-foreground">{myAgents.length}</span> agent{myAgents.length === 1 ? "" : "s"} on this wallet.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="service">Service / API (one you own)</option>
                  <option value="automation">Automation (autonomous agent template)</option>
                  <option value="agent">Agent (clone a profile)</option>
                  <option value="other">Other (content / config)</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Your price (USDC)</Label>
                <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                <p className="text-xs text-muted-foreground">You decide. Buyers pay this once; it settles to your wallet.</p>
              </div>
            </div>

            {type === "service" && (
              <div className="space-y-1.5">
                <Label>Which of your services?</Label>
                <Select
                  value={serviceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setServiceId(id);
                    const s = myServices.find((x) => x.id === id);
                    if (s) {
                      setTitle(s.name);
                      setDescription(s.description);
                      setCategory(s.category);
                    }
                  }}
                >
                  <option value="">Select a service you own…</option>
                  {myServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {formatUsdc(s.priceUsdc)}/call</option>
                  ))}
                </Select>
                {myServices.length === 0 && <p className="text-xs text-muted-foreground">No services owned by this wallet yet — list one on the Services page first.</p>}
              </div>
            )}

            {type === "automation" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Target x402 service the automation calls</Label>
                  <Select value={autoTarget} onChange={(e) => setAutoTarget(e.target.value)}>
                    <option value="">Select a service…</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} · {formatUsdc(s.priceUsdc)}/call</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Task / prompt</Label>
                  <Textarea rows={2} value={autoPrompt} onChange={(e) => setAutoPrompt(e.target.value)} className="font-sans" placeholder="What the automation does each run" />
                </div>
                <div className="space-y-1.5">
                  <Label>Model slug (optional)</Label>
                  <Input value={autoModel} onChange={(e) => setAutoModel(e.target.value)} placeholder="e.g. nousresearch/hermes-4-405b" className="font-mono text-xs" />
                </div>
              </div>
            )}

            {type === "agent" && (
              <div className="space-y-1.5">
                <Label>Which of your agents?</Label>
                <Select
                  value={agentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAgentId(id);
                    const a = myAgents.find((x) => x.id === id);
                    if (a) {
                      setTitle(`${a.displayName} (agent)`);
                      setDescription(a.bio);
                    }
                  }}
                >
                  <option value="">— none / describe below —</option>
                  {myAgents.map((a) => (
                    <option key={a.id} value={a.id}>{a.displayName} (@{a.handle})</option>
                  ))}
                </Select>
                {myAgents.length === 0 && <p className="text-xs text-muted-foreground">No agents on this wallet yet — create one on the Agents page.</p>}
              </div>
            )}

            {type === "other" && (
              <div className="space-y-1.5">
                <Label>Content delivered on purchase</Label>
                <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="The text / config / link the buyer receives" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you selling?" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="font-sans" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>

            {error && <p className="flex items-center gap-1.5 text-sm text-red-400"><XCircle className="size-4" /> {error}</p>}
            <p className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-xs text-muted-foreground">
              Sales are paid by buyers in USDC on Base via x402 and settle directly to <span className="font-mono text-foreground">{wallet.address ? truncateAddress(wallet.address) : "your wallet"}</span>.
            </p>
            <Button type="submit" disabled={busy || !title.trim() || (type === "service" && !serviceId)}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Tag className="size-4" />}
              List for {formatUsdc(Number(price) || 0)}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
