"use client";

import * as React from "react";
import { BadgeCheck, Loader2, ShieldQuestion, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WalletOwnership } from "@/lib/types";
import { truncateAddress, timeAgo } from "@/lib/utils";

// Minimal EIP-1193 shape.
type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
function getEthereum(): Eth | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: Eth }).ethereum ?? null;
}

export function ClaimOwnership({
  serviceId,
  payTo,
  initial,
}: {
  serviceId: string;
  payTo: string;
  initial: WalletOwnership;
}) {
  const [ownership, setOwnership] = React.useState<WalletOwnership>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const verified = ownership.walletVerified;
  const hasPayTo = /^0x[a-fA-F0-9]{40}$/.test(payTo);

  async function claim() {
    setError(null);
    const eth = getEthereum();
    if (!eth) {
      setError("No EVM wallet detected. Install MetaMask (or another injected wallet) to sign the proof.");
      return;
    }
    setBusy(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts?.[0];
      if (!account) throw new Error("No account connected");
      if (account.toLowerCase() !== payTo.toLowerCase()) {
        throw new Error(`Connect the service's payTo wallet (${truncateAddress(payTo)}) to prove ownership.`);
      }

      // 1) Request a nonce/message to sign.
      const nonceRes = await fetch("/api/claim/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, wallet: account }),
      });
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceData.error ?? "Could not get a nonce");

      // 2) Sign it (EIP-191 personal_sign).
      const signature = (await eth.request({
        method: "personal_sign",
        params: [nonceData.message, account],
      })) as string;

      // 3) Verify the signature server-side.
      const verifyRes = await fetch("/api/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, wallet: account, signature }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error ?? "Verification failed");
      setOwnership(verifyData.ownership as WalletOwnership);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Claim failed";
      setError(msg.includes("User rejected") ? "Signature request was rejected." : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldQuestion className="size-4 text-blue-400" /> Wallet ownership
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {verified ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] p-3">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" />
            <div className="text-sm">
              <p className="font-medium text-emerald-300">Owner verified</p>
              <p className="text-muted-foreground">
                <span className="font-mono">{truncateAddress(ownership.wallet ?? payTo)}</span> proved control via
                signature{ownership.verifiedAt ? ` · ${timeAgo(ownership.verifiedAt)}` : ""}.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This listing is <span className="font-medium text-foreground">unclaimed</span>. The owner proves control
              by signing a nonce with the payTo wallet — no transaction, no gas. Ownership is never shown as verified
              without a valid signature.
            </p>
            {hasPayTo ? (
              <Button onClick={claim} disabled={busy} className="w-full">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                {busy ? "Awaiting signature…" : "Claim & verify ownership"}
              </Button>
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/[0.02] p-2 text-xs text-muted-foreground">
                No payTo wallet on record for this listing yet, so ownership can't be proven.
              </p>
            )}
            {error && (
              <p className="flex items-start gap-1.5 text-sm text-red-400">
                <XCircle className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
