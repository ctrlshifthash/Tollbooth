import type {
  PaymentRequirement,
  VerificationRun,
  VerificationStatus,
  VerificationStep,
  VerificationStepId,
} from "./types";
import { isValidEthAddress, isValidUrl } from "./utils";
import { getPaymentKeyError, paidX402Fetch } from "./x402-payment";

// ---------------------------------------------------------------------------
// x402 verification engine.
//
// This performs REAL checks against a submitted endpoint where possible:
//   1. endpoint is a valid URL and the wallet is a valid address (static)
//   2. the endpoint is reachable
//   3. it returns HTTP 402 Payment Required
//   4. the x402 payment requirements can be parsed (header or body)
//   5. a test payment can be prepared from those requirements
//   6. with X402_EVM_PRIVATE_KEY configured, the official x402 SDK signs the
//      payment and replays the request against Base/Base Sepolia.
//   7. successful paid replay is required before a service is marked verified.
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<VerificationStepId, string> = {
  endpoint_reachable: "Endpoint responds",
  returns_402: "Returns HTTP 402",
  payment_requirements_parsed: "Payment requirements parsed",
  wallet_valid: "Wallet address valid",
  payment_prepared: "Test payment prepared",
  settlement_verified: "Base settlement verified",
  valid_response: "Valid response returned",
};

const BASE_NETWORKS = new Set(["base", "base-sepolia", "eip155:8453", "eip155:84532"]);
const BASE_USDC_ASSETS = new Set([
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
]);

function step(id: VerificationStepId, status: VerificationStep["status"], detail?: string, evidence?: Record<string, unknown>): VerificationStep {
  return { id, label: STEP_LABELS[id], status, detail, evidence };
}

// Attempt to parse an x402 payment requirement from a 402 response.
// The x402 spec returns an `accepts` array in the JSON body; some servers also
// surface details via headers. We try the body first, then headers.
export async function parsePaymentRequirements(res: Response): Promise<PaymentRequirement | null> {
  // 1) JSON body with `accepts: [...]` (canonical x402 shape).
  try {
    const clone = res.clone();
    const ct = clone.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await clone.json()) as Record<string, unknown>;
      const accepts = (body.accepts ?? body.paymentRequirements) as unknown;
      const first = Array.isArray(accepts) ? accepts[0] : (body as unknown);
      const pr = coercePaymentRequirement(first);
      if (pr) return pr;
    }
  } catch {
    // fall through to header parsing
  }

  // 2) Headers — some implementations expose www-authenticate / x-payment hints.
  // x402 v2: requirements arrive as a base64-encoded JSON object in the
  // `payment-required` header, containing an `accepts` array.
  const v2Header = res.headers.get("payment-required");
  if (v2Header) {
    try {
      const decoded = JSON.parse(Buffer.from(v2Header, "base64").toString("utf8")) as Record<string, unknown>;
      const accepts = decoded.accepts as unknown;
      const first = Array.isArray(accepts) ? accepts[0] : decoded;
      const pr = coercePaymentRequirement(first);
      if (pr) return pr;
    } catch {
      // not decodable — fall through
    }
  }

  const headerCandidates = ["www-authenticate", "x-payment-required", "x-402-accepts"];
  for (const h of headerCandidates) {
    const raw = res.headers.get(h);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const pr = coercePaymentRequirement(Array.isArray(parsed) ? parsed[0] : parsed);
      if (pr) return pr;
    } catch {
      // header was not JSON — ignore
    }
  }
  return null;
}

function coercePaymentRequirement(obj: unknown): PaymentRequirement | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);
  const scheme = str(o.scheme);
  const network = str(o.network) ?? str(o.chain);
  // Require at least a scheme or network to consider it a valid x402 requirement.
  if (!scheme && !network) return null;
  return {
    scheme: scheme ?? "exact",
    network: network ?? "base",
    maxAmountRequired: str(o.maxAmountRequired) ?? str(o.amount),
    asset: str(o.asset),
    payTo: str(o.payTo) ?? str(o.recipient),
    resource: str(o.resource),
    description: str(o.description),
    mimeType: str(o.mimeType),
    maxTimeoutSeconds: num(o.maxTimeoutSeconds),
  };
}

function validateBasePaymentRequirement(paymentRequirement: PaymentRequirement): string | null {
  if (!BASE_NETWORKS.has(paymentRequirement.network)) {
    return `Unsupported network "${paymentRequirement.network}". Tollbooth verifies Base and Base Sepolia only.`;
  }
  if (paymentRequirement.asset && !BASE_USDC_ASSETS.has(paymentRequirement.asset.toLowerCase())) {
    return `Unsupported asset "${paymentRequirement.asset}". Tollbooth verifies USDC on Base/Base Sepolia only.`;
  }
  if (paymentRequirement.payTo && !isValidEthAddress(paymentRequirement.payTo)) {
    return `Invalid payTo address "${paymentRequirement.payTo}".`;
  }
  if (!paymentRequirement.maxAmountRequired || !/^\d+$/.test(paymentRequirement.maxAmountRequired)) {
    return "Missing or invalid maxAmountRequired.";
  }
  return null;
}

// Derive an overall status from steps. `verified` requires every executed check
// to pass AND no failures; pending settlement/response keep it `pending`.
function deriveStatus(steps: VerificationStep[]): VerificationStatus {
  if (steps.some((s) => s.status === "fail")) return "failed";
  if (steps.some((s) => s.status === "pending")) return "pending";
  if (steps.every((s) => s.status === "pass")) return "verified";
  return "pending";
}

export interface VerifyInput {
  serviceId: string;
  endpoint: string;
  wallet: string;
}

// Run the full verification pipeline against a live endpoint.
export async function runVerification(input: VerifyInput): Promise<VerificationRun> {
  const { serviceId, endpoint, wallet } = input;
  const steps: VerificationStep[] = [];
  let httpStatus: number | undefined;
  let latencyMs: number | undefined;
  let paymentRequirement: PaymentRequirement | null = null;
  let error: string | undefined;

  // Static validation up front.
  const urlOk = isValidUrl(endpoint);
  const walletOk = isValidEthAddress(wallet);

  if (!urlOk) {
    steps.push(step("endpoint_reachable", "fail", "Endpoint is not a valid http(s) URL"));
    steps.push(step("returns_402", "skipped"));
    steps.push(step("payment_requirements_parsed", "skipped"));
    steps.push(step("wallet_valid", walletOk ? "pass" : "fail", walletOk ? wallet : "Invalid wallet address"));
    steps.push(step("payment_prepared", "skipped"));
    steps.push(step("settlement_verified", "skipped"));
    steps.push(step("valid_response", "skipped"));
    return finalize();
  }

  // 1) Reachability + status capture. Probe with a GET (no payment header) — a
  // compliant x402 resource answers 402 to an unpaid request.
  const started = Date.now();
  let res: Response | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    res = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "Tollbooth-Verifier/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    latencyMs = Date.now() - started;
    httpStatus = res.status;
    steps.push(
      step("endpoint_reachable", "pass", `Responded ${res.status} in ${latencyMs}ms`, {
        status: res.status,
        latencyMs,
      })
    );
  } catch (e) {
    latencyMs = Date.now() - started;
    error = e instanceof Error ? e.message : "Network error";
    steps.push(step("endpoint_reachable", "fail", `Could not reach endpoint: ${error}`));
    steps.push(step("returns_402", "skipped"));
    steps.push(step("payment_requirements_parsed", "skipped"));
    steps.push(step("wallet_valid", walletOk ? "pass" : "fail"));
    steps.push(step("payment_prepared", "skipped"));
    steps.push(step("settlement_verified", "skipped"));
    steps.push(step("valid_response", "skipped"));
    return finalize();
  }

  // 2) 402 check.
  const is402 = res.status === 402;
  steps.push(
    step(
      "returns_402",
      is402 ? "pass" : "fail",
      is402 ? "Endpoint correctly challenged with 402 Payment Required" : `Expected 402, got ${res.status}. x402 resources must answer 402 to unpaid requests.`,
      { status: res.status }
    )
  );

  // 3) Parse payment requirements (only meaningful if we got a 402, but we try
  // regardless in case the server attaches them to other statuses).
  if (is402) {
    paymentRequirement = await parsePaymentRequirements(res);
    const requirementError = paymentRequirement ? validateBasePaymentRequirement(paymentRequirement) : null;
    steps.push(
      step(
        "payment_requirements_parsed",
        paymentRequirement && !requirementError ? "pass" : "fail",
        paymentRequirement && !requirementError
          ? `Parsed scheme="${paymentRequirement.scheme}" network="${paymentRequirement.network}"`
          : requirementError ?? "402 returned but no parseable x402 payment requirements (expected an `accepts` array)",
        paymentRequirement ? (paymentRequirement as unknown as Record<string, unknown>) : undefined
      )
    );
    if (requirementError) paymentRequirement = null;
  } else {
    steps.push(step("payment_requirements_parsed", "skipped", "Skipped — endpoint did not return 402"));
  }

  // 4) Wallet validity. Cross-check the declared payTo against the listing wallet.
  let walletDetail = walletOk ? wallet : "Invalid wallet address (expected 0x + 40 hex)";
  let walletStatus: VerificationStep["status"] = walletOk ? "pass" : "fail";
  if (walletOk && paymentRequirement?.payTo && paymentRequirement.payTo.toLowerCase() !== wallet.toLowerCase()) {
    walletStatus = "fail";
    walletDetail = `Listing wallet (${wallet}) does not match endpoint payTo (${paymentRequirement.payTo})`;
  }
  steps.push(step("wallet_valid", walletStatus, walletDetail));

  // 5) Prepare a test payment from the parsed requirements. "Prepared" means we
  // could construct the payment intent locally — not that we paid.
  const canPrepare = is402 && !!paymentRequirement && walletStatus === "pass";
  steps.push(
    step(
      "payment_prepared",
      canPrepare ? "pass" : is402 ? "fail" : "skipped",
      canPrepare
        ? `Prepared an "exact" payment of ${paymentRequirement?.maxAmountRequired ?? "?"} atomic units to ${paymentRequirement?.payTo ?? wallet}`
        : "Could not prepare a test payment from the requirements"
    )
  );

  if (!canPrepare) {
    steps.push(step("settlement_verified", "skipped", "Skipped because payment preparation failed"));
    steps.push(step("valid_response", "skipped", "Skipped because payment preparation failed"));
    return finalize();
  }

  const paymentConfigError = getPaymentKeyError();
  if (paymentConfigError) {
    steps.push(step("settlement_verified", "fail", paymentConfigError));
    steps.push(step("valid_response", "skipped", "Skipped because no x402 payer key is configured"));
    error = paymentConfigError;
    return finalize();
  }

  try {
    const paid = await paidX402Fetch(endpoint);
    steps.push(
      step(
        "settlement_verified",
        paid.paymentResponse || paid.ok ? "pass" : "fail",
        paid.paymentResponse
          ? "Received payment response from x402 server/facilitator"
          : `Paid request completed with HTTP ${paid.status}, but no payment response header was returned`,
        {
          status: paid.status,
          latencyMs: paid.latencyMs,
          paymentResponse: paid.paymentResponse,
        }
      )
    );
    steps.push(
      step(
        "valid_response",
        paid.ok ? "pass" : "fail",
        paid.ok ? `Paid replay returned HTTP ${paid.status}` : `Paid replay failed with HTTP ${paid.status}`,
        { status: paid.status, bodyPreview: paid.bodyPreview }
      )
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "x402 paid request failed";
    error = message;
    steps.push(step("settlement_verified", "fail", message));
    steps.push(step("valid_response", "skipped", "Skipped because payment failed"));
  }

  return finalize();


  function finalize(): VerificationRun {
    const status = deriveStatus(steps);
    return {
      // deterministic-ish id without Math.random for SSR safety
      id: `ver_${serviceId}_${Date.parse(new Date().toISOString())}`,
      serviceId,
      createdAt: new Date().toISOString(),
      status,
      steps,
      httpStatus,
      latencyMs,
      paymentRequirement,
      error,
    };
  }
}
