import { createWalletClient, createPublicClient, custom, http, type EIP1193Provider } from "viem";
import { base } from "viem/chains";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";

// ---------------------------------------------------------------------------
// Browser x402 payer.
//
// The connected user's OWN wallet signs the x402 USDC payment (EIP-3009) in the
// browser. To avoid cross-origin CORS against third-party services, the actual
// HTTP requests are routed through our same-origin /api/proxy, which faithfully
// relays the x402 headers. The server never holds the user's key.
// ---------------------------------------------------------------------------

export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const X402_NETWORK = "eip155:8453"; // Base mainnet

// Route every fetch through our same-origin proxy, preserving method + the
// x402 payment headers that the x402 client sets on the (retry) request.
const PASS_HEADERS = ["payment-signature", "x-payment", "payment", "accept", "content-type"];

const proxyFetch: typeof globalThis.fetch = async (input, init) => {
  let url: string;
  let method = "GET";
  const headers = new Headers();

  if (typeof input === "string" || input instanceof URL) {
    url = String(input);
    method = init?.method ?? "GET";
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  } else {
    url = input.url;
    method = input.method || "GET";
    input.headers.forEach((v, k) => headers.set(k, v));
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  }

  const out = new Headers();
  for (const h of PASS_HEADERS) {
    const v = headers.get(h);
    if (v) out.set(h, v);
  }
  return fetch(`/api/proxy?url=${encodeURIComponent(url)}`, { method, headers: out, cache: "no-store" });
};

function signerFromProvider(provider: EIP1193Provider, address: `0x${string}`) {
  const wc = createWalletClient({ account: address, chain: base, transport: custom(provider) });
  return toClientEvmSigner({
    address,
    // The exact-evm scheme calls signTypedData({domain,types,primaryType,message}).
    // The wallet client already has the account bound; cast to its param type.
    signTypedData: (m) => wc.signTypedData(m as unknown as Parameters<typeof wc.signTypedData>[0]),
  });
}

export interface PayResult {
  ok: boolean;
  status: number;
  result: unknown;
  paymentResponse: unknown | null;
  txHash: string | null;
}

// Pay for and call an x402 endpoint using the connected wallet.
export async function payAndCall(
  provider: EIP1193Provider,
  address: `0x${string}`,
  endpoint: string
): Promise<PayResult> {
  const signer = signerFromProvider(provider, address);
  const client = new x402Client().register(X402_NETWORK, new ExactEvmScheme(signer));
  const payFetch = wrapFetchWithPayment(proxyFetch, client);

  const res = await payFetch(endpoint, { method: "GET" });
  const text = await res.text();
  let result: unknown = text;
  try {
    result = JSON.parse(text);
  } catch {
    /* keep as text */
  }

  let paymentResponse: unknown | null = null;
  let txHash: string | null = null;
  const header = res.headers.get("x-payment-response") ?? res.headers.get("payment-response");
  if (header) {
    try {
      paymentResponse = decodePaymentResponseHeader(header);
      const o = paymentResponse as Record<string, unknown>;
      const tx = (o.transaction ?? o.txHash ?? o.hash) as unknown;
      if (typeof tx === "string" && tx.startsWith("0x")) txHash = tx;
    } catch {
      paymentResponse = header;
    }
  }

  return { ok: res.ok, status: res.status, result, paymentResponse, txHash };
}

export interface RoutePayResult {
  status: number;
  ok?: boolean;
  feeUsdc?: number;
  selected?: { name: string; slug: string; endpoint: string; priceUsdc: number; reputation: number; uptimePct: number; chain: "base" | "base-sepolia" } | null;
  reason?: string | null;
  result?: unknown;
  downstreamTx?: string | null;
  candidates?: unknown[];
  viaHermes?: boolean;
  hermes?: { model: string; answer: string; steps: unknown[]; spentUsdc: number } | null;
  error?: string | null;
}

// Pay Tollbooth's Router fee from the user's wallet and get the routed result.
// Same-origin (/api/x402/route) so it's called directly — no proxy needed.
export async function payRoute(
  provider: EIP1193Provider,
  address: `0x${string}`,
  body: { query?: string; category?: string; maxPriceUsdc?: number }
): Promise<RoutePayResult> {
  const signer = signerFromProvider(provider, address);
  const client = new x402Client().register(X402_NETWORK, new ExactEvmScheme(signer));
  const payFetch = wrapFetchWithPayment(fetch, client);

  const res = await payFetch("/api/x402/route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { status: res.status, ...(data as Omit<RoutePayResult, "status">) };
}

export interface BuyResult {
  ok: boolean;
  status: number;
  purchase?: unknown;
  deliverable?: unknown;
  txHash?: string | null;
  error?: string;
}

// Buy a marketplace listing — the buyer's wallet pays USDC on Base directly to
// the seller (the buy endpoint's 402 sets payTo = seller). Same-origin, so no proxy.
export async function payListing(
  provider: EIP1193Provider,
  address: `0x${string}`,
  listingId: string
): Promise<BuyResult> {
  const signer = signerFromProvider(provider, address);
  const client = new x402Client().register(X402_NETWORK, new ExactEvmScheme(signer));
  const payFetch = wrapFetchWithPayment(fetch, client);

  const res = await payFetch(`/api/marketplace/buy/${listingId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ buyer: address }),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return {
    ok: res.ok,
    status: res.status,
    purchase: data.purchase,
    deliverable: data.deliverable,
    txHash: (data.txHash as string) ?? null,
    error: data.error as string | undefined,
  };
}

export async function getUsdcBalance(address: string): Promise<number> {
  const client = createPublicClient({ chain: base, transport: http() });
  const abi = [
    { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  ] as const;
  const bal = (await client.readContract({
    address: USDC_BASE,
    abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  })) as bigint;
  return Number(bal) / 1_000_000;
}
