import "server-only";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm";
import { ExactEvmSchemeV1 } from "@x402/evm/v1";
import { privateKeyToAccount } from "viem/accounts";

const SUPPORTED_V2_NETWORKS = ["eip155:8453", "eip155:84532"] as const;

export interface PaidCallResult {
  status: number;
  ok: boolean;
  latencyMs: number;
  headers: Record<string, string>;
  bodyPreview: string;
  paymentResponse: unknown | null;
}

export function getPaymentKeyError(): string | null {
  const raw = process.env.X402_EVM_PRIVATE_KEY;
  if (!raw) return "Set X402_EVM_PRIVATE_KEY to a funded Base/Base Sepolia EVM private key.";
  return normalizePrivateKey(raw) ? null : "X402_EVM_PRIVATE_KEY must be a 32-byte hex private key, with or without 0x.";
}

export async function paidX402Fetch(endpoint: string, opts?: { body?: unknown }): Promise<PaidCallResult> {
  const key = normalizePrivateKey(process.env.X402_EVM_PRIVATE_KEY);
  if (!key) {
    throw new Error(getPaymentKeyError() ?? "Missing x402 payment key.");
  }

  const account = privateKeyToAccount(key);
  const client = new x402Client();
  for (const network of SUPPORTED_V2_NETWORKS) {
    client.register(network, new ExactEvmScheme(account));
  }
  client.registerV1("base", new ExactEvmSchemeV1(account));
  client.registerV1("base-sepolia", new ExactEvmSchemeV1(account));
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  // POST with a JSON body when one is supplied (e.g. an agent sending a prompt);
  // otherwise a plain GET probe. The x402 client re-issues the request with the
  // payment header, preserving method + body.
  const hasBody = opts?.body !== undefined && opts.body !== null;
  const started = Date.now();
  const res = await fetchWithPayment(endpoint, {
    method: hasBody ? "POST" : "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Tollbooth-PaidCall/1.0",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(opts!.body) } : {}),
    cache: "no-store",
  });

  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const bodyPreview = await safeBodyPreview(res);
  const paymentHeader = res.headers.get("payment-response") ?? res.headers.get("x-payment-response");

  return {
    status: res.status,
    ok: res.ok,
    latencyMs: Date.now() - started,
    headers,
    bodyPreview,
    paymentResponse: paymentHeader ? safeDecodePaymentResponse(paymentHeader) : null,
  };
}

function normalizePrivateKey(value: string | undefined): `0x${string}` | null {
  if (!value) return null;
  const trimmed = value.trim();
  const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) return null;
  return `0x${hex}`;
}

async function safeBodyPreview(res: Response): Promise<string> {
  try {
    return (await res.clone().text()).slice(0, 1200);
  } catch {
    return "";
  }
}

function safeDecodePaymentResponse(header: string): unknown {
  try {
    return decodePaymentResponseHeader(header);
  } catch {
    return header;
  }
}
