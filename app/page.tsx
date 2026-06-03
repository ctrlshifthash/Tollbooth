import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  Wallet,
  BadgeCheck,
  CircleDollarSign,
  Server,
  Gauge,
  Boxes,
  LineChart,
  Store,
  Bot,
  Sparkles,
  Radar,
  Cpu,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/section-heading";
import { ServiceCard } from "@/components/service-card";
import { CodeBlock } from "@/components/code-block";
import { HomeSidebar } from "@/components/home-sidebar";
import { getServices, getAgents } from "@/lib/store";
import { formatCompact, formatUsdc } from "@/lib/utils";

const HTTP_402_EXAMPLE = `HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "20000",
    "asset": "0x8335…2913",
    "payTo": "0x7857…4cEf",
    "description": "Tollbooth AI Chat — one prompt"
  }]
}`;

const CAPABILITIES = [
  {
    href: "/services",
    icon: <Sparkles className="size-5" />,
    title: "AI services on x402",
    body: "Pay-per-prompt LLM chat, summarize, translate, and extract — settled in USDC per call. Any frontier model.",
  },
  {
    href: "/router",
    icon: <Zap className="size-5" />,
    title: "Hermes Router",
    body: "Pay once. Hermes reads your task, calls the right x402 tools to do the work, and returns the real result.",
  },
  {
    href: "/agents",
    icon: <Bot className="size-5" />,
    title: "Autonomous agents",
    body: "Give an agent a budget and a task — it pays for and calls services on its own, on a schedule, until done.",
  },
  {
    href: "/marketplace",
    icon: <Store className="size-5" />,
    title: "Marketplace",
    body: "Buy and sell services, agents, and automations. Buyers pay via x402; it settles straight to the seller.",
  },
  {
    href: "/verify",
    icon: <ShieldCheck className="size-5" />,
    title: "Real verification",
    body: "Every endpoint is probed against a live 402 and a paid replay. No service is ever marked verified on trust.",
  },
  {
    href: "/services",
    icon: <Radar className="size-5" />,
    title: "Discovery",
    body: "Import the live Coinbase x402 Bazaar and crawl real endpoints — then verify and claim them.",
  },
];

const ABOUT_ITEMS = [
  {
    term: "Discover & verify",
    body: "Pull real x402 services from the live Coinbase x402 Bazaar or crawl any URL. Every endpoint is hit, checked for a genuine HTTP 402, its USDC payment terms parsed, and confirmed with a paid on-chain replay before it's ever marked verified.",
  },
  {
    term: "Pay per call (x402 + USDC on Base)",
    body: "Agents and people pay per request in USDC: connect a wallet, the endpoint returns 402 with terms, the wallet signs, and Coinbase's CDP facilitator settles it on Base. Sub-cent pricing, no API keys, no accounts, no checkout.",
  },
  {
    term: "AI services",
    body: "Built-in payable endpoints — AI Chat, Summarize, Translate, and Extract. Pay ~$0.02 USDC per call and get a real completion from any of 200+ models.",
  },
  {
    term: "Hermes Router",
    body: "Describe a task and pay one flat fee. Hermes reasons about it, calls the right paid x402 tools to actually do the work, and returns the finished result with every on-chain tx in the trace.",
  },
  {
    term: "Autonomous agents",
    body: "Give an agent a target service, a prompt, an interval, and a USDC budget. It pays for and calls that service on its own, on schedule, until the budget runs out — each run a real settlement you can watch live.",
  },
  {
    term: "Marketplace",
    body: "List a service, agent, or automation at your price. Buyers pay in USDC via x402 and it settles straight to your wallet; the buyer receives the deliverable on their dashboard.",
  },
  {
    term: "Reputation & dashboard",
    body: "Uptime, success rate, calls, and revenue roll up from real records into a transparent reputation score. Your dashboard shows the services and agents you own, what you've bought, and your on-chain settlements.",
  },
];

export default function HomePage() {
  const services = getServices();
  const agents = getAgents();

  const verified = services.filter((s) => s.verificationStatus === "verified");
  const totalCalls = services.reduce((a, s) => a + s.metrics.totalCalls, 0);
  const totalSettled = agents.reduce((a, ag) => a + ag.totalRevenueUsdc, 0);
  const avgUptime = services.length > 0 ? services.reduce((a, s) => a + s.metrics.uptimePct, 0) / services.length : 0;

  const featured = [...services].sort((a, b) => b.metrics.reputationScore - a.metrics.reputationScore).slice(0, 3);

  return (
    <div>
      <HomeSidebar />

      {/* ---------------- HERO (bold Base blue) ---------------- */}
      <section className="base-hero base-dither relative overflow-hidden">
        <div className="container relative z-10 pb-24 pt-20 text-center sm:pt-28">
          <div className="animate-rise mb-8 flex items-center justify-center gap-2.5">
            <span className="size-9 rounded-md bg-white animate-float" />
            <span className="text-2xl font-bold tracking-tight text-white">Tollbooth</span>
          </div>

          <div className="animate-rise mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur" style={{ animationDelay: "60ms" }}>
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-pulse-ring rounded-full bg-white/70" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            Live on Base mainnet · settling real USDC via x402
          </div>

          <h1 className="animate-rise mx-auto max-w-4xl text-balance text-4xl font-bold leading-[1.03] tracking-tight text-white sm:text-6xl" style={{ animationDelay: "120ms" }}>
            The economy where AI agents pay, work, and get paid.
          </h1>

          <p className="animate-rise mx-auto mt-6 max-w-2xl text-pretty text-lg text-blue-50/90" style={{ animationDelay: "160ms" }}>
            Tollbooth is the trust layer for x402 on Base. Discover paid agent APIs, run tasks with Hermes, deploy
            autonomous agents, and buy &amp; sell on the marketplace — every call settled in USDC, on-chain.
          </p>

          <div className="animate-rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "200ms" }}>
            <Link href="/router">
              <Button size="lg" className="w-full bg-white text-[#0000ff] hover:bg-white/90 sm:w-auto">
                <Zap className="size-4" /> Run a task with Hermes
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button size="lg" variant="outline" className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20 sm:w-auto">
                <Store className="size-4" /> Open the marketplace
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- LIVE DEMO (overlaps the hero) ---------------- */}
      <section className="container relative z-20 -mt-12 pb-16">
        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Card className="animate-rise glow overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Server className="size-4 text-blue-400" /> Endpoint challenge
              </div>
              <Badge variant="warning">402 Payment Required</Badge>
            </div>
            <CodeBlock code={HTTP_402_EXAMPLE} language="http" filename="GET /api/x402/llm" className="rounded-none border-0" />
          </Card>
          <div className="animate-rise grid gap-4" style={{ animationDelay: "80ms" }}>
            <HermesVisual />
          </div>
        </div>
      </section>

      {/* ---------------- STATS BAR ---------------- */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="container grid grid-cols-2 gap-px py-10 sm:grid-cols-4">
          <Stat label="Services listed" value={services.length.toString()} icon={<Boxes className="size-4" />} />
          <Stat label="Verified endpoints" value={verified.length.toString()} icon={<BadgeCheck className="size-4" />} />
          <Stat label="Calls served" value={formatCompact(totalCalls)} icon={<Activity className="size-4" />} />
          <Stat label="Settled in USDC" value={formatUsdc(totalSettled)} icon={<CircleDollarSign className="size-4" />} />
        </div>
      </section>

      {/* ---------------- ABOUT ---------------- */}
      <section id="about" className="container py-20 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="About"
            title="What is Tollbooth?"
            description="A working product on Base mainnet that lets AI agents discover, pay for, run, and sell x402 services — every transaction a real USDC settlement on-chain."
          />
          <p className="mt-6 text-muted-foreground">
            <span className="text-foreground">The problem:</span> x402 turns HTTP{" "}
            <span className="font-mono text-foreground">402 Payment Required</span> into a real payment handshake, so any
            API can charge per call in USDC — no keys, no accounts. But an open network of paid endpoints is useless
            without trust and tooling: which are real, which actually work, how do agents find them, pay them, and put
            them to use? Tollbooth is the layer that makes it usable. Here&apos;s exactly what it does:
          </p>

          <div className="mt-8 space-y-5">
            {ABOUT_ITEMS.map((it, i) => (
              <div key={it.term} className="flex gap-4">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[#0000ff]/15 font-mono text-xs font-bold text-blue-300">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">{it.term} — </span>
                  {it.body}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ---------------- CAPABILITIES ---------------- */}
      <section id="capabilities" className="container py-20 sm:py-24">
        <SectionHeading
          eyebrow="One network, end to end"
          title="Everything an agent economy needs"
          description="From discovering paid APIs to running them autonomously and trading them — all on x402, all settled on Base."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c, i) => (
            <Link key={c.title} href={c.href} className="group">
              <Card className="lift animate-rise group h-full p-6" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/15 text-primary transition-colors group-hover:bg-primary/25">
                  {c.icon}
                </div>
                <h3 className="flex items-center gap-1.5 font-semibold">
                  {c.title}
                  <ArrowRight className="size-4 -translate-x-1 text-blue-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- HOW IT WORKS (white band) ---------------- */}
      <section id="how" className="bg-white text-[#0a0b0d]">
        <div className="container py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#0000ff]/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0000ff]">
              How it works
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">The x402 loop, made real</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-black/60">
              No accounts, no API keys, no invoices — just HTTP 402, a wallet, and USDC on Base.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <LightStep n="01" icon={<Server className="size-5" />} title="Request → 402" body="An agent calls a service with no payment. The endpoint replies HTTP 402 with the exact terms — amount in USDC, the seller's payTo wallet, and the Base network." />
            <LightStep n="02" icon={<Wallet className="size-5" />} title="Wallet signs" body="The caller's wallet signs an x402 payment authorization (an EIP-3009 USDC transfer) for that amount — off-chain and instant, no approval gas." />
            <LightStep n="03" icon={<Coins className="size-5" />} title="Settle on Base" body="The signed payment is re-sent. Coinbase's CDP facilitator verifies it and settles the USDC on Base to the seller — a real transaction hash comes back." />
            <LightStep n="04" icon={<BadgeCheck className="size-5" />} title="Result returns" body="Only after payment clears does the endpoint return the actual result — the AI output, the data, the service response. Pay, then receive." />
          </div>
        </div>
      </section>

      {/* ---------------- AGENTS ---------------- */}
      <section id="agents" className="border-y border-white/5 bg-white/[0.015]">
        <div className="container py-20 sm:py-24">
          <SectionHeading
            eyebrow="Agents"
            title="Agents that pay for themselves"
            description="Not chatbots — operators that hold a USDC budget and spend it on x402 services to actually get work done, on-chain."
          />
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
            <AgentCard
              icon={<Sparkles className="size-5" />}
              title="Hermes Router"
              body="Give it a goal. Hermes reasons about the task, calls the right paid x402 tools to do the work, feeds the results back to itself, and returns the finished answer — with every on-chain payment shown in the trace."
            />
            <AgentCard
              icon={<Bot className="size-5" />}
              title="Autonomous agents"
              body="Set a target service, a prompt, an interval, and a USDC budget. The agent pays for and calls that service on its own, on schedule, until the budget runs out. Pause, resume, or stop it anytime."
            />
            <AgentCard
              icon={<Wallet className="size-5" />}
              title="They pay in USDC, on their own"
              body="Every agent action is a real x402 settlement on Base, hard-capped by the budget you set. No API keys, no human approving each payment, and it can never spend past the cap."
            />
            <AgentCard
              icon={<Boxes className="size-5" />}
              title="Create unlimited agents"
              body="Spin up as many agents as you want, each tied to your wallet. They appear on the Agents page and your dashboard with their services, calls served, revenue, and trust score."
            />
          </div>
          <div className="mt-10 text-center">
            <Link href="/agents">
              <Button>
                Explore &amp; create agents <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- WHY BASE / x402 ---------------- */}
      <section id="why" className="container py-20 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Why Base + x402"
              title={<>Micropayments that finally make agent APIs pay-per-call</>}
              description="x402 turns the dormant HTTP 402 status code into a real payment handshake. Base makes the USDC settlement underneath it fast and cheap enough for a single API request."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Feature icon={<Zap className="size-4" />} title="Sub-cent pricing" body="Charge $0.001 per call without payment-processor minimums." />
              <Feature icon={<CircleDollarSign className="size-4" />} title="USDC settlement" body="Stable, on-chain settlement on Base — no invoices, no API keys to rotate." />
              <Feature icon={<Wallet className="size-4" />} title="Wallet-native" body="Agents pay from a wallet; you get paid to a wallet you control." />
              <Feature icon={<ShieldCheck className="size-4" />} title="Verifiable trust" body="402 challenges and settlements are checkable — reputation isn't self-reported." />
            </div>
          </div>

          <Card className="lift p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <LineChart className="size-4 text-blue-400" /> Network reputation snapshot
            </div>
            <div className="space-y-4">
              <BarStat label="Average uptime" value={avgUptime} suffix="%" max={100} />
              <BarStat label="Verified share" value={(verified.length / Math.max(services.length, 1)) * 100} suffix="%" max={100} />
              <BarStat
                label="Success rate"
                value={
                  (services.reduce((a, s) => a + s.metrics.successfulCalls, 0) /
                    Math.max(services.reduce((a, s) => a + s.metrics.successfulCalls + s.metrics.failedCalls, 0), 1)) *
                  100
                }
                suffix="%"
                max={100}
              />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/5 pt-5 text-center">
              <MiniStat value={agents.length.toString()} label="Agents" />
              <MiniStat value={formatCompact(totalCalls)} label="Calls" />
              <MiniStat value={formatUsdc(totalSettled)} label="Settled" />
            </div>
          </Card>
        </div>
      </section>

      {/* ---------------- FEATURED SERVICES ---------------- */}
      <section id="featured" className="border-y border-white/5 bg-white/[0.015]">
        <div className="container py-20 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading align="left" eyebrow="Featured" title="Top-reputation services" description="The highest-trust x402 endpoints on the registry right now." />
            <Link href="/services">
              <Button variant="outline">
                View all services <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- MARKETPLACE BAND ---------------- */}
      <section id="market" className="container py-20 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Marketplace"
              title="Sell what your agents do"
              description="List an API, an agent, or an autonomous automation. Buyers pay in USDC on Base via x402 and it settles straight to your wallet — the buyer gets the deliverable on their dashboard."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/marketplace">
                <Button><Store className="size-4" /> Browse &amp; list</Button>
              </Link>
              <Link href="/agents">
                <Button variant="outline"><Bot className="size-4" /> Create an agent</Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MiniCard icon={<Boxes className="size-4" />} title="Services & APIs" body="Resell access to any x402 endpoint you operate." />
            <MiniCard icon={<Sparkles className="size-4" />} title="Automations" body="Package a Hermes automation buyers can deploy in one click." />
            <MiniCard icon={<Bot className="size-4" />} title="Agents" body="Sell cloneable agent profiles to other builders." />
            <MiniCard icon={<Coins className="size-4" />} title="Instant settlement" body="USDC lands in the seller's wallet on purchase." />
          </div>
        </div>
      </section>

      {/* ---------------- CTA (bold Base blue) ---------------- */}
      <section className="container pb-24">
        <div className="base-hero base-dither relative overflow-hidden rounded-3xl p-10 text-center sm:p-16">
          <div className="relative z-10">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ship something the agent economy can trust and pay for.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-blue-50/90">
              List your x402 endpoint, pass live verification, sell it on the marketplace, and let your reputation
              compound with every settled call.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/list">
                <Button size="lg" className="bg-white text-[#0000ff] hover:bg-white/90">
                  List a Service <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  Read the docs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// -------------------- local presentational helpers --------------------

function HermesVisual() {
  const steps = [
    { label: "Hermes reads the task", icon: <Cpu className="size-3.5" />, tone: "blue" as const },
    { label: "Pays x402 tool · summarize", icon: <Coins className="size-3.5" />, tone: "blue" as const },
    { label: "Pays x402 tool · translate", icon: <Coins className="size-3.5" />, tone: "blue" as const },
    { label: "Settled on Base ✓", icon: <BadgeCheck className="size-3.5" />, tone: "green" as const },
    { label: "Returns the real answer", icon: <Sparkles className="size-3.5" />, tone: "green" as const },
  ];
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-blue-400" /> Hermes runs a task
      </div>
      <ul className="flex-1 space-y-3">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            <span
              className={
                s.tone === "green"
                  ? "grid size-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"
                  : "grid size-5 place-items-center rounded-full bg-primary/15 text-blue-300"
              }
            >
              {s.icon}
            </span>
            <span className={s.tone === "green" ? "" : "text-muted-foreground"}>{s.label}</span>
          </li>
        ))}
      </ul>
      <Link href="/router" className="mt-4 text-sm font-medium text-blue-400 hover:underline">
        Run a task with Hermes →
      </Link>
    </Card>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="px-4 text-center sm:text-left">
      <div className="mb-1 flex items-center justify-center gap-1.5 text-muted-foreground sm:justify-start">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</div>
    </div>
  );
}

function LightStep({ n, icon, title, body }: { n: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="relative rounded-xl border border-black/10 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_10px_30px_-12px_rgba(0,0,255,0.35)]">
      <span className="absolute right-5 top-5 font-mono text-sm text-black/25">{n}</span>
      <div className="mb-4 grid size-11 place-items-center rounded-xl bg-[#0000ff] text-white">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-black/60">{body}</p>
    </div>
  );
}

function AgentCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card className="lift flex gap-4 p-6">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">{icon}</div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </Card>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-blue-400">{icon}</div>
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function MiniCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="lift rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 grid size-8 place-items-center rounded-lg bg-primary/15 text-blue-300">{icon}</div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function BarStat({ label, value, suffix, max }: { label: string; value: number; suffix?: string; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {value.toFixed(1)}
          {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
