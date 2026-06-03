// ---------------------------------------------------------------------------
// x402 / Base mainnet configuration.
//
// All real-payment behaviour is driven by environment variables so no secrets
// live in the repo. See .env.example for the full list.
// ---------------------------------------------------------------------------

import type { Network } from "@x402/core/types";

// Base mainnet, CAIP-2 form expected by @x402/* v2.
export const X402_NETWORK: Network = "eip155:8453";
export const X402_CHAIN_LABEL = "base";
export const BASE_CHAIN_ID = 8453;

// USDC on Base mainnet (6 decimals). The x402 facilitator resolves this from
// the price + network automatically; we keep it here for display/manifest use.
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Price charged by the in-app payable endpoint (/api/x402/echo).
export function getEchoPrice(): string {
  return process.env.X402_ECHO_PRICE?.trim() || "$0.01";
}

// Tollbooth's platform fee per routed task (the x402 Router). Charged to the
// caller; Tollbooth pays the downstream service and keeps the margin.
export function getRoutePrice(): string {
  return process.env.X402_ROUTE_PRICE?.trim() || "$0.10";
}

export function getRoutePriceUsdc(): number {
  return Number(getRoutePrice().replace(/[^0-9.]/g, "")) || 0.1;
}

// Wallet that receives settlements for the in-app endpoint.
export function getPayTo(): string | null {
  const v = process.env.X402_PAY_TO?.trim();
  return v && /^0x[a-fA-F0-9]{40}$/.test(v) ? v : null;
}

// Public base URL of this deployment (used to build the echo service endpoint).
export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

export function getEchoEndpoint(): string {
  return `${getAppUrl()}/api/x402/echo`;
}

// The CDP facilitator (mainnet) needs CDP API credentials.
export function hasCdpKeys(): boolean {
  return Boolean(process.env.CDP_API_KEY_ID?.trim() && process.env.CDP_API_KEY_SECRET?.trim());
}

// Why the in-app payable endpoint can't run yet, or null if fully configured.
export function getEchoServerError(): string | null {
  if (!getPayTo()) {
    return "Set X402_PAY_TO to a valid 0x wallet to receive settlements for the in-app endpoint.";
  }
  if (!hasCdpKeys()) {
    return "Set CDP_API_KEY_ID and CDP_API_KEY_SECRET — the Base mainnet x402 facilitator requires CDP credentials.";
  }
  return null;
}
