"use client";

import * as React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";
import { WalletBridge, UnconfiguredWalletProvider } from "@/components/wallet";

// Wraps the app in Privy so users can connect a wallet and pay with their own
// USDC on Base. If NEXT_PUBLIC_PRIVY_APP_ID is not set, the app still runs —
// the connect button shows a "configure Privy" hint instead of crashing.
export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <UnconfiguredWalletProvider>{children}</UnconfiguredWalletProvider>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: base,
        supportedChains: [base],
        appearance: { theme: "dark", accentColor: "#0052FF" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      <WalletBridge>{children}</WalletBridge>
    </PrivyProvider>
  );
}

export function isPrivyConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
}
