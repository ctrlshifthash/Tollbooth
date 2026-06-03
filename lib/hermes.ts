import "server-only";
import { chatMessages, type ChatMsg, DEFAULT_MODEL } from "./inference";
import { paidX402Fetch, getPaymentKeyError } from "./x402-payment";
import { getAppUrl } from "./x402-config";
import { extractSettlementTxHash } from "./utils";

// ---------------------------------------------------------------------------
// Hermes orchestrator.
//
// A real agentic loop: an LLM (Hermes by default, via the model gateway) is the brain;
// the in-app x402 services are its tools. Each turn Hermes emits ONE JSON action
// — either call a tool or finish. Tool calls are REAL x402 payments settled in
// USDC on Base, and the tool's output is fed back to Hermes as an observation.
// Bounded by a step cap and a USDC budget.
// ---------------------------------------------------------------------------

interface Tool {
  name: string;
  path: string;
  field: string; // request body field the input maps to
  priceUsdc: number;
  desc: string;
}

const TOOLS: Tool[] = [
  { name: "ask_llm", path: "/api/x402/llm", field: "prompt", priceUsdc: 0.02, desc: "Ask a general LLM a question / sub-task. input: the prompt." },
  { name: "summarize", path: "/api/x402/summarize", field: "text", priceUsdc: 0.02, desc: "Summarize long text. input: the text to summarize." },
  { name: "extract", path: "/api/x402/extract", field: "text", priceUsdc: 0.02, desc: "Extract structured JSON from text. input: the text." },
  { name: "translate", path: "/api/x402/translate", field: "text", priceUsdc: 0.02, desc: "Translate text to English (prefix the text with the target language if other). input: the text." },
  { name: "hash", path: "/api/x402/hash", field: "text", priceUsdc: 0.01, desc: "Compute SHA-256 + Keccak-256 digests. input: the text." },
];

export interface HermesStep {
  action: string;
  input?: string;
  observation?: string;
  txHash?: string | null;
  costUsdc: number;
  ok: boolean;
  error?: string;
  thought?: string;
}

export interface HermesResult {
  ok: boolean;
  goal: string;
  model: string;
  finalAnswer: string;
  steps: HermesStep[];
  spentUsdc: number;
  error?: string;
}

function systemPrompt(): string {
  const toolLines = TOOLS.map((t) => `- ${t.name} ($${t.priceUsdc}/call): ${t.desc}`).join("\n");
  return [
    "You are a Hermes agent. You accomplish the user's goal by calling paid x402 tools that settle in USDC on Base.",
    "",
    "Tools available (each call costs real USDC):",
    toolLines,
    "",
    "Respond with EXACTLY ONE JSON object per turn and nothing else.",
    'To call a tool: {"thought":"<brief reasoning>","action":"<tool_name>","input":"<string>"}',
    'When finished: {"thought":"<brief>","action":"final","answer":"<your complete answer>"}',
    "",
    "Rules: use tools only when they genuinely help; prefer fewer calls; you have a limited budget.",
    "If you can answer directly, return final immediately without spending.",
  ].join("\n");
}

function parseAction(content: string): { thought?: string; action: string; input?: string; answer?: string } {
  const tryJson = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let obj = tryJson(content.trim());
  if (!obj) {
    const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) obj = tryJson(fence[1].trim());
  }
  if (!obj) {
    const braces = content.match(/\{[\s\S]*\}/);
    if (braces) obj = tryJson(braces[0]);
  }
  if (obj && typeof obj === "object" && typeof (obj as Record<string, unknown>).action === "string") {
    const o = obj as Record<string, unknown>;
    return {
      thought: typeof o.thought === "string" ? o.thought : undefined,
      action: String(o.action),
      input: typeof o.input === "string" ? o.input : undefined,
      answer: typeof o.answer === "string" ? o.answer : undefined,
    };
  }
  // No parseable action → treat the whole reply as the final answer.
  return { action: "final", answer: content.trim() };
}

function observe(bodyPreview: string): string {
  try {
    const o = JSON.parse(bodyPreview) as Record<string, unknown>;
    for (const k of ["completion", "summary", "translation"]) {
      if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).slice(0, 800);
    }
    if (o.data !== undefined) return JSON.stringify(o.data).slice(0, 800);
    if (typeof o.sha256 === "string") return `sha256=${o.sha256} keccak256=${o.keccak256 ?? ""}`;
  } catch {
    /* not JSON */
  }
  return bodyPreview.slice(0, 800);
}

export interface RunHermesInput {
  goal: string;
  model?: string;
  maxSteps?: number;
  budgetUsdc?: number;
}

export async function runHermesAgent(input: RunHermesInput): Promise<HermesResult> {
  const goal = input.goal.trim();
  const model = input.model?.trim() || DEFAULT_MODEL;
  const maxSteps = Math.min(Math.max(Math.floor(input.maxSteps ?? 6), 1), 12);
  const budgetUsdc = input.budgetUsdc && input.budgetUsdc > 0 ? input.budgetUsdc : 0.2;
  const app = getAppUrl();

  const steps: HermesStep[] = [];
  let spent = 0;

  if (!goal) return { ok: false, goal, model, finalAnswer: "", steps, spentUsdc: 0, error: "Goal is required" };

  const payErr = getPaymentKeyError();
  // We still let Hermes reason and answer directly if it spends nothing; tool
  // calls will fail clearly if the payer key is missing.

  const messages: ChatMsg[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: `Goal: ${goal}` },
  ];

  let finalAnswer = "";
  for (let i = 0; i < maxSteps; i++) {
    const r = await chatMessages({ messages, model, temperature: 0.4 });
    if (!r.ok) {
      return { ok: false, goal, model, finalAnswer, steps, spentUsdc: spent, error: r.error };
    }
    messages.push({ role: "assistant", content: r.content });
    const act = parseAction(r.content);

    if (act.action === "final" || !TOOLS.some((t) => t.name === act.action)) {
      if (act.action !== "final" && TOOLS.every((t) => t.name !== act.action)) {
        // Hermes named an unknown tool — nudge it, don't crash.
        steps.push({ action: act.action, ok: false, costUsdc: 0, error: "Unknown tool", thought: act.thought });
        messages.push({ role: "user", content: `No tool named "${act.action}". Use one of: ${TOOLS.map((t) => t.name).join(", ")}, or return {"action":"final","answer":"..."}.` });
        continue;
      }
      finalAnswer = act.answer ?? r.content;
      break;
    }

    const tool = TOOLS.find((t) => t.name === act.action)!;
    if (payErr) {
      steps.push({ action: tool.name, input: act.input, ok: false, costUsdc: 0, error: payErr, thought: act.thought });
      finalAnswer = `Cannot run tools: ${payErr}`;
      break;
    }
    if (spent + tool.priceUsdc > budgetUsdc + 1e-9) {
      steps.push({ action: tool.name, input: act.input, ok: false, costUsdc: 0, error: "Budget reached", thought: act.thought });
      messages.push({ role: "user", content: "Budget reached — no more tool calls. Return your best final answer now." });
      continue;
    }

    try {
      const body = { [tool.field]: act.input ?? "" };
      const paid = await paidX402Fetch(`${app}${tool.path}`, { body });
      const observation = observe(paid.bodyPreview);
      const txHash = extractSettlementTxHash(paid.paymentResponse) ?? null;
      if (paid.ok) spent = Math.round((spent + tool.priceUsdc) * 1e6) / 1e6;
      steps.push({
        action: tool.name,
        input: act.input,
        observation,
        txHash,
        costUsdc: paid.ok ? tool.priceUsdc : 0,
        ok: paid.ok,
        thought: act.thought,
        error: paid.ok ? undefined : `Tool HTTP ${paid.status}`,
      });
      messages.push({ role: "user", content: `Observation from ${tool.name}: ${observation}` });
    } catch (e) {
      const error = e instanceof Error ? e.message : "Tool call failed";
      steps.push({ action: tool.name, input: act.input, ok: false, costUsdc: 0, error, thought: act.thought });
      messages.push({ role: "user", content: `Tool ${tool.name} failed: ${error}. Try a different approach or finish.` });
    }
  }

  if (!finalAnswer) finalAnswer = "Reached the step limit before finishing. Partial progress is in the steps above.";
  return { ok: true, goal, model, finalAnswer, steps, spentUsdc: spent };
}
