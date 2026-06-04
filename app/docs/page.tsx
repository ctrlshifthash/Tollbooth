import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Boxes, Plug, ShieldCheck, Terminal, FileJson, Webhook, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";

export const metadata: Metadata = {
  title: "Docs",
  description: "Integrate an x402 service with Tollbooth — endpoint example, manifest, and API reference.",
};

const ENDPOINT_EXAMPLE = `// A minimal x402-enabled endpoint (Next.js route handler).
// Unpaid requests get a 402 with payment requirements; paid requests run.
import { NextResponse } from "next/server";

const PAY_TO = "0x9A7c1F3B2e4D5a6c7B8e9F0a1b2C3d4E5f6A7b8C";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export async function POST(req: Request) {
  const payment = req.headers.get("X-PAYMENT");

  // No payment? Challenge with 402 + x402 payment requirements.
  if (!payment) {
    return NextResponse.json(
      {
        x402Version: 1,
        accepts: [{
          scheme: "exact",
          network: "base",
          maxAmountRequired: "10000",        // 0.01 USDC (6 decimals)
          asset: USDC_BASE,
          payTo: PAY_TO,
          resource: "https://api.you.dev/v1/route",
          description: "One completion",
          maxTimeoutSeconds: 60,
        }],
      },
      { status: 402 }
    );
  }

  // Verify + settle the payment via your x402 facilitator here.
  //   const settled = await facilitator.verify(payment, requirement);
  //   if (!settled) return new NextResponse("Invalid payment", { status: 402 });

  const { prompt } = await req.json();
  return NextResponse.json({ completion: await runModel(prompt) });
}`;

const MANIFEST_EXAMPLE = `{
  "schema": "agent402/manifest@1",
  "name": "LLM Router",
  "description": "Routes prompts to the cheapest capable model.",
  "category": "ai-inference",
  "endpoint": "https://api.nimbus.dev/v1/route",
  "x402": {
    "network": "base",
    "scheme": "exact",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x9A7c1F3B2e4D5a6c7B8e9F0a1b2C3d4E5f6A7b8C",
    "maxAmountRequired": "10000"
  },
  "input": { "type": "object", "properties": { "prompt": { "type": "string" } } },
  "output": { "type": "object", "properties": { "completion": { "type": "string" } } }
}`;

const REGISTER_EXAMPLE = `curl -X POST https://www.trytollbooth.com/api/services \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "LLM Router",
    "endpoint": "https://api.nimbus.dev/v1/route",
    "category": "ai-inference",
    "priceUsdc": 0.01,
    "wallet": "0x9A7c1F3B2e4D5a6c7B8e9F0a1b2C3d4E5f6A7b8C",
    "chain": "base",
    "description": "Routes prompts to the cheapest capable model."
  }'

# => 201 { "service": { ... }, "verification": { "status": "pending", "steps": [ ... ] } }`;

const VERIFY_EXAMPLE = `curl -X POST https://www.trytollbooth.com/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpoint": "https://api.nimbus.dev/v1/route",
    "wallet": "0x9A7c1F3B2e4D5a6c7B8e9F0a1b2C3d4E5f6A7b8C",
    "serviceId": "svc_llm_router"
  }'

# => { "verification": { "status": "pending", "httpStatus": 402, "steps": [ ... ] } }`;

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "endpoint", label: "Example endpoint" },
  { id: "manifest", label: "Service manifest" },
  { id: "verify", label: "Verification flow" },
  { id: "api", label: "API reference" },
];

export default function DocsPage() {
  return (
    <div className="container py-12">
      <div className="base-hero base-dither relative mb-10 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <BookOpen className="size-3.5" /> Documentation
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Integrate an x402 service</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">
            Wrap any API in the x402 payment protocol, list it on Tollbooth, and start getting paid per call in USDC on
            Base. Everything below works against this app&apos;s own API routes.
          </p>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
        {/* Sticky section nav */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
            <Link href="/list" className="mt-4 block">
              <Button className="w-full" size="sm">
                List a Service <ArrowRight className="size-4" />
              </Button>
            </Link>
          </nav>
        </aside>

        <div className="min-w-0 space-y-16">
          {/* Overview */}
          <section id="overview" className="scroll-mt-24">
            <SectionTitle icon={<Boxes className="size-5" />} title="Overview" />
            <p className="mt-3 text-muted-foreground">
              x402 revives the dormant <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">402 Payment Required</code>{" "}
              HTTP status. A client calls your endpoint; if it has not paid, you respond <strong>402</strong> with a
              machine-readable list of acceptable payments. The client pays in USDC on Base, then retries with an{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">X-PAYMENT</code> header. Tollbooth sits
              on top: it verifies your endpoint actually speaks x402, then tracks uptime and reputation.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <FlowStep icon={<Plug className="size-4" />} title="Wrap" body="Return 402 + payment requirements for unpaid requests." />
              <FlowStep icon={<ShieldCheck className="size-4" />} title="Verify" body="Tollbooth probes the live endpoint and parses the challenge." />
              <FlowStep icon={<Webhook className="size-4" />} title="Earn" body="Each paid call settles to your wallet on Base." />
            </div>
          </section>

          {/* Endpoint */}
          <section id="endpoint" className="scroll-mt-24">
            <SectionTitle icon={<Terminal className="size-5" />} title="Example endpoint implementation" />
            <p className="mt-3 text-muted-foreground">
              The only hard requirement for verification is that an unpaid request receives a real{" "}
              <strong>HTTP 402</strong> with a parseable <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">accepts</code>{" "}
              array.
            </p>
            <div className="mt-4">
              <CodeBlock language="typescript" filename="app/api/route/route.ts" code={ENDPOINT_EXAMPLE} />
            </div>
          </section>

          {/* Manifest */}
          <section id="manifest" className="scroll-mt-24">
            <SectionTitle icon={<FileJson className="size-5" />} title="Service manifest" />
            <p className="mt-3 text-muted-foreground">
              The manifest is the portable descriptor of your service. Copy it from any service page, or generate it
              when you list. Schema version: <Badge variant="muted">agent402/manifest@1</Badge>
            </p>
            <div className="mt-4">
              <CodeBlock language="json" filename="manifest.json" code={MANIFEST_EXAMPLE} />
            </div>
          </section>

          {/* Verification */}
          <section id="verify" className="scroll-mt-24">
            <SectionTitle icon={<ShieldCheck className="size-5" />} title="Verification flow" />
            <p className="mt-3 text-muted-foreground">
              When you register a service (or hit <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm">/api/verify</code>),
              Tollbooth runs these checks in order. A service is only marked <strong>verified</strong> when all executed
              checks pass.
            </p>
            <Card className="mt-4 p-5">
              <ol className="space-y-2.5 text-sm">
                {[
                  ["Endpoint responds", "We can reach the URL within a timeout."],
                  ["Returns HTTP 402", "Unpaid requests are challenged with 402."],
                  ["Payment requirements parsed", "The x402 `accepts` array is valid."],
                  ["Wallet valid", "payTo is a valid address and matches the listing."],
                  ["Test payment prepared", "An `exact` payment intent can be built."],
                  ["Settlement verified", "Tollbooth receives a paid response or payment response header."],
                  ["Valid response returned", "Paid replay returns a schema-valid body."],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs text-blue-300">
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-medium">{title}</span>{" "}
                      <span className="text-muted-foreground">— {body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
            <p className="mt-4 text-sm text-muted-foreground">
              Try it live on the{" "}
              <Link href="/verify" className="text-blue-400 hover:underline">
                verification page
              </Link>
              .
            </p>
          </section>

          {/* API reference */}
          <section id="api" className="scroll-mt-24">
            <SectionTitle icon={<Webhook className="size-5" />} title="API reference" />
            <div className="mt-4 space-y-8">
              <Endpoint method="GET" path="/api/services" desc="List services. Supports ?category, ?chain, ?verified=true, ?q, ?minUptime, ?maxPrice, ?sort." />
              <Endpoint method="GET" path="/api/services/:id" desc="Fetch a single service (by id or slug) plus its generated manifest." />
              <div>
                <Endpoint method="POST" path="/api/services" desc="Register a new service. Runs verification immediately; the result sets the stored status." />
                <div className="mt-3">
                  <CodeBlock language="bash" filename="register a service" code={REGISTER_EXAMPLE} />
                </div>
              </div>
              <div>
                <Endpoint method="POST" path="/api/verify" desc="Run the live x402 verification pipeline against an endpoint + wallet." />
                <div className="mt-3">
                  <CodeBlock language="bash" filename="verify an endpoint" code={VERIFY_EXAMPLE} />
                </div>
              </div>
              <Endpoint method="POST" path="/api/test-call" desc="Unpaid probe (or, with pay:true, a real paid x402 call). Records a CallRecord and any settlement tx." />
              <Endpoint method="POST" path="/api/manifests" desc="Ingest one or many agent402/manifest@1 manifests; upserts the owning agent by wallet and verifies each." />
              <Endpoint method="POST" path="/api/claim/nonce" desc="Issue a nonce + message for wallet-ownership proof." />
              <Endpoint method="POST" path="/api/claim/verify" desc="Verify a signed nonce (EIP-191). Ownership is only stored on a valid signature." />
              <Endpoint method="GET" path="/api/health" desc="Health history + derived uptime/latency for a service (?serviceId=)." />
              <Endpoint method="POST" path="/api/health" desc="Run a real uptime probe now — one service, or all non-demo services." />
              <Endpoint method="POST" path="/api/crawl" desc="Run discovery adapters (manual URLs, GitHub, Farcaster/Virtuals placeholders); saves live endpoints as unclaimed." />
            </div>

            <Card className="mt-8 border-primary/30 bg-primary/[0.06] p-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-4 text-primary" /> Payment execution boundary
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Tollbooth performs live reachability, 402 detection, requirement parsing, wallet validation, and paid
                replay. Set <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">X402_EVM_PRIVATE_KEY</code>{" "}
                to a funded Base/Base Sepolia key so the official x402 SDK can sign the payment.
              </p>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
      <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">{icon}</span>
      {title}
    </h2>
  );
}

function FlowStep({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card className="p-4">
      <div className="mb-2 grid size-8 place-items-center rounded-lg bg-white/5 text-blue-400">{icon}</div>
      <h4 className="font-medium">{title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Card>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color =
    method === "GET" ? "success" : method === "POST" ? "default" : "muted";
  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-white/10 pl-4">
      <div className="flex items-center gap-2">
        <Badge variant={color as "success" | "default" | "muted"} className="font-mono">
          {method}
        </Badge>
        <code className="font-mono text-sm font-medium">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
