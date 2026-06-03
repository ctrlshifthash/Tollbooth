"use client";

import * as React from "react";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet";
import { truncateAddress, formatUsdc } from "@/lib/utils";

export function ConnectButton() {
  const { configured, ready, connected, address, balance, login, logout } = useWallet();

  if (!configured) {
    return (
      <Button
        size="sm"
        variant="outline"
        title="Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local to enable wallet connect"
        onClick={() => alert("Wallet connect needs a Privy App ID. Add NEXT_PUBLIC_PRIVY_APP_ID to .env.local.")}
      >
        <Wallet className="size-4" /> Connect
      </Button>
    );
  }

  if (!ready) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Loader2 className="size-4 animate-spin" />
      </Button>
    );
  }

  if (!connected) {
    return (
      <Button size="sm" onClick={login}>
        <Wallet className="size-4" /> Connect wallet
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs sm:block">
        <span className="font-mono">{truncateAddress(address ?? "")}</span>
        {balance !== null && <span className="ml-2 text-emerald-400">{formatUsdc(balance)}</span>}
      </div>
      <Button size="sm" variant="outline" onClick={logout} title="Disconnect">
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
