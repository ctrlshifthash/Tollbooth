"use client";

import * as React from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import type { EIP1193Provider } from "viem";
import { payAndCall, payRoute, payListing, getUsdcBalance, type PayResult, type RoutePayResult, type BuyResult } from "@/lib/x402-browser";

interface WalletState {
  configured: boolean;
  ready: boolean;
  connected: boolean;
  address: string | null;
  balance: number | null;
  login: () => void;
  logout: () => void;
  refreshBalance: () => Promise<void>;
  pay: (endpoint: string) => Promise<PayResult>;
  route: (body: { query?: string; category?: string; maxPriceUsdc?: number }) => Promise<RoutePayResult>;
  buy: (listingId: string) => Promise<BuyResult>;
}

const UNCONFIGURED: WalletState = {
  configured: false,
  ready: true,
  connected: false,
  address: null,
  balance: null,
  login: () => {},
  logout: () => {},
  refreshBalance: async () => {},
  pay: async () => {
    throw new Error("Wallet connection is not configured (set NEXT_PUBLIC_PRIVY_APP_ID).");
  },
  route: async () => {
    throw new Error("Wallet connection is not configured (set NEXT_PUBLIC_PRIVY_APP_ID).");
  },
  buy: async () => {
    throw new Error("Wallet connection is not configured (set NEXT_PUBLIC_PRIVY_APP_ID).");
  },
};

const WalletContext = React.createContext<WalletState>(UNCONFIGURED);
export const useWallet = () => React.useContext(WalletContext);

// Bridges Privy hooks into our context. Rendered ONLY inside <PrivyProvider>.
export function WalletBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const address = wallet?.address ?? null;
  const [balance, setBalance] = React.useState<number | null>(null);

  const refreshBalance = React.useCallback(async () => {
    if (!address) return setBalance(null);
    try {
      setBalance(await getUsdcBalance(address));
    } catch {
      setBalance(null);
    }
  }, [address]);

  React.useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const pay = React.useCallback(
    async (endpoint: string): Promise<PayResult> => {
      if (!wallet) throw new Error("Connect a wallet first.");
      // Make sure the wallet is on Base before signing the USDC payment.
      try {
        await wallet.switchChain(8453);
      } catch {
        /* some wallets prompt; if it fails we still attempt and surface the error */
      }
      const provider = (await wallet.getEthereumProvider()) as EIP1193Provider;
      const result = await payAndCall(provider, wallet.address as `0x${string}`, endpoint);
      refreshBalance();
      return result;
    },
    [wallet, refreshBalance]
  );

  const route = React.useCallback(
    async (body: { query?: string; category?: string; maxPriceUsdc?: number }): Promise<RoutePayResult> => {
      if (!wallet) throw new Error("Connect a wallet first.");
      try {
        await wallet.switchChain(8453);
      } catch {
        /* surfaced on signing if it fails */
      }
      const provider = (await wallet.getEthereumProvider()) as EIP1193Provider;
      const result = await payRoute(provider, wallet.address as `0x${string}`, body);
      refreshBalance();
      return result;
    },
    [wallet, refreshBalance]
  );

  const buy = React.useCallback(
    async (listingId: string): Promise<BuyResult> => {
      if (!wallet) throw new Error("Connect a wallet first.");
      try {
        await wallet.switchChain(8453);
      } catch {
        /* surfaced on signing if it fails */
      }
      const provider = (await wallet.getEthereumProvider()) as EIP1193Provider;
      const result = await payListing(provider, wallet.address as `0x${string}`, listingId);
      refreshBalance();
      return result;
    },
    [wallet, refreshBalance]
  );

  const value: WalletState = {
    configured: true,
    ready,
    connected: authenticated && !!address,
    address,
    balance,
    login,
    logout,
    refreshBalance,
    pay,
    route,
    buy,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function UnconfiguredWalletProvider({ children }: { children: React.ReactNode }) {
  return <WalletContext.Provider value={UNCONFIGURED}>{children}</WalletContext.Provider>;
}
