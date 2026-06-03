"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, Loader2, Plus, Wallet, ArrowUpRight, Boxes, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/avatar";
import { useWallet } from "@/components/wallet";
import type { Agent } from "@/lib/types";

// Wallet-gated: lists every agent the connected wallet owns (no limit) and lets
// the owner create more. Used on the Agents page and the Dashboard.
export function MyAgents() {
  const wallet = useWallet();
  const [agents, setAgents] = React.useState<Agent[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ displayName: "", handle: "", bio: "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!wallet.address) return setAgents(null);
    const res = await fetch("/api/agents", { cache: "no-store" });
    const data = await res.json();
    const a = wallet.address.toLowerCase();
    setAgents((data.agents as Agent[]).filter((x) => x.wallet.toLowerCase() === a));
  }, [wallet.address]);

  React.useEffect(() => {
    if (wallet.connected) load();
    else setAgents(null);
  }, [wallet.connected, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!wallet.address) return;
    setBusy(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.address, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create agent");
        return;
      }
      setForm({ displayName: "", handle: "", bio: "" });
      setOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!wallet.connected) {
    return (
      <EmptyState
        icon={<Wallet className="size-6" />}
        title="Connect to manage your agents"
        description="Create as many agents as you want — each tied to your wallet. They show up here and on your dashboard."
        action={<Button onClick={wallet.login} disabled={!wallet.configured || !wallet.ready}><Wallet className="size-4" /> Connect wallet</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{agents?.length ?? 0} agent{agents?.length === 1 ? "" : "s"} on this wallet · unlimited</p>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? "Close" : "Create agent"}
        </Button>
      </div>

      {open && (
        <Card>
          <CardContent className="p-5">
            <form onSubmit={create} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Display name</Label>
                  <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Acme Research Agent" />
                </div>
                <div className="space-y-1.5">
                  <Label>Handle (optional)</Label>
                  <Input value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} placeholder="acme-research" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Bio</Label>
                <Textarea rows={2} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} className="font-sans" placeholder="What this agent does" />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
                Create agent
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {agents === null ? (
        <Card><CardContent className="flex justify-center py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></CardContent></Card>
      ) : agents.length === 0 ? (
        <EmptyState icon={<Bot className="size-6" />} title="No agents yet" description="Create your first agent above." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.handle}`} className="group block">
              <Card className="h-full p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40">
                <div className="flex items-center gap-3">
                  <Avatar name={a.displayName} gradient={a.avatarColor} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 truncate font-medium">
                      {a.displayName}
                      <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="truncate text-sm text-muted-foreground">@{a.handle}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Boxes className="size-3.5" /> {a.serviceIds.length} services</span>
                  <Badge variant="muted">trust {a.trustScore}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
