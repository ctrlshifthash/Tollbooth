import "server-only";
import { randomBytes } from "node:crypto";
import { verifyMessage } from "viem";
import type { NonceChallenge, WalletOwnership } from "./types";
import {
  getServiceById,
  saveNonce,
  getNonce,
  deleteNonce,
  setServiceOwnership,
  getAgentById,
  saveAgent,
} from "./store";
import { isValidEthAddress } from "./utils";

// ---------------------------------------------------------------------------
// Wallet ownership proof (EIP-191 personal_sign).
//
// 1. The claimant requests a nonce for (serviceId, wallet).
// 2. They sign the returned human-readable message with that wallet.
// 3. We recover the signer with viem `verifyMessage` and only mark ownership
//    verified if the recovered address matches. No signature => no ownership.
// ---------------------------------------------------------------------------

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function buildClaimMessage(serviceId: string, wallet: string, nonce: string, issuedAt: string): string {
  return [
    "Tollbooth — verify wallet ownership of an x402 service.",
    "",
    `Service: ${serviceId}`,
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
    "",
    "Signing this proves you control this wallet. It does not authorize any transaction.",
  ].join("\n");
}

export interface IssueResult {
  ok: boolean;
  error?: string;
  challenge?: NonceChallenge;
}

export async function issueNonce(serviceId: string, wallet: string): Promise<IssueResult> {
  if (!isValidEthAddress(wallet)) return { ok: false, error: "Invalid wallet address" };
  const service = await getServiceById(serviceId);
  if (!service) return { ok: false, error: "Service not found" };

  const now = new Date();
  const issuedAt = now.toISOString();
  const nonce = `0x${randomBytes(16).toString("hex")}`;
  const message = buildClaimMessage(service.id, wallet, nonce, issuedAt);
  const challenge: NonceChallenge = {
    id: `${service.id}:${wallet.toLowerCase()}`,
    serviceId: service.id,
    wallet,
    nonce,
    message,
    issuedAt,
    expiresAt: new Date(now.getTime() + NONCE_TTL_MS).toISOString(),
  };
  await saveNonce(challenge);
  return { ok: true, challenge };
}

export interface VerifyClaimResult {
  ok: boolean;
  error?: string;
  ownership?: WalletOwnership;
}

export async function verifyClaim(serviceId: string, wallet: string, signature: string): Promise<VerifyClaimResult> {
  if (!isValidEthAddress(wallet)) return { ok: false, error: "Invalid wallet address" };
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) return { ok: false, error: "Invalid signature format" };

  const service = await getServiceById(serviceId);
  if (!service) return { ok: false, error: "Service not found" };

  const challenge = await getNonce(service.id, wallet);
  if (!challenge) return { ok: false, error: "No active nonce — request a new challenge first" };
  if (Date.parse(challenge.expiresAt) < Date.now()) {
    await deleteNonce(service.id, wallet);
    return { ok: false, error: "Nonce expired — request a new challenge" };
  }

  // The wallet that signs must equal the wallet being claimed.
  let valid = false;
  try {
    valid = await verifyMessage({
      address: wallet as `0x${string}`,
      message: challenge.message,
      signature: signature as `0x${string}`,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Signature verification failed" };
  }

  if (!valid) {
    return { ok: false, error: "Signature does not match the claimed wallet" };
  }

  // Optional integrity check: the proven wallet should be the service payTo.
  const matchesPayTo = service.wallet.toLowerCase() === wallet.toLowerCase();

  const ownership: WalletOwnership = {
    claimed: true,
    walletVerified: true,
    wallet,
    verifiedAt: new Date().toISOString(),
    method: "eip191-signature",
  };
  await setServiceOwnership(service.id, ownership);
  await deleteNonce(service.id, wallet);

  // Promote the owning agent's wallet-verified flag when the wallets line up.
  const agent = await getAgentById(service.ownerAgentId);
  if (agent && agent.wallet.toLowerCase() === wallet.toLowerCase()) {
    await saveAgent({ ...agent, walletVerified: true });
  }

  return { ok: true, ownership: { ...ownership, ...(matchesPayTo ? {} : {}) } };
}
