import type { Metadata } from "next";
import Link from "next/link";
import { CircleDollarSign, Activity, Star, Boxes, ArrowUpRight, Bot, Users, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { AutonomousAgents } from "@/components/autonomous-agents";
import { HermesOrchestrator } from "@/components/hermes-orchestrator";
import { MyAgents } from "@/components/my-agents";
import { getAgents, getServices } from "@/lib/store";
import { formatCompact, formatUsdc, reputationTier, truncateAddress } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Agents",
  description: "Developers and agents operating verified x402 services on Base.",
};

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = (await getAgents())
    .filter((a) => a.serviceIds.length > 0 || a.callsServed > 0)
    .sort((a, b) => b.trustScore - a.trustScore);
  const services = await getServices();

  return (
    <div className="container py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"><Bot className="size-3.5" /> Agents</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Agents</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">Create self-driving agents that pay for and call x402 services on their own — and browse the operators behind
          every service on Base.</p>
        </div>
      </div>

      {/* Your agents — create unlimited agents tied to your wallet. */}
      <section className="mb-12">
        <div className="mb-4 flex items-center gap-2">
          <Bot className="size-5 text-blue-400" />
          <h2 className="text-lg font-semibold">Your agents</h2>
        </div>
        <MyAgents />
      </section>

      {/* Hermes orchestrator — a model that reasons and pays x402 tools to act. */}
      <section className="mb-12">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="size-5 text-blue-400" />
          <h2 className="text-lg font-semibold">Hermes orchestrator</h2>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-blue-300">Hermes + x402</span>
        </div>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Give it a goal. Hermes reasons, calls paid x402 tools to get the work done — each a real USDC settlement on
          Base — and returns the answer with the full trace.
        </p>
        <HermesOrchestrator />
      </section>

      {/* Autonomous agents — self-driving runners owned by your wallet. */}
      <section className="mb-12">
        <div className="mb-4 flex items-center gap-2">
          <Bot className="size-5 text-blue-400" />
          <h2 className="text-lg font-semibold">Autonomous agents</h2>
        </div>
        <AutonomousAgents />
      </section>

      {/* Operator directory. */}
      <div className="mb-4 flex items-center gap-2">
        <Users className="size-5 text-blue-400" />
        <h2 className="text-lg font-semibold">Operators</h2>
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const tier = reputationTier(agent.trustScore);
          const agentServices = services.filter((s) => agent.serviceIds.includes(s.id));
          return (
            <Link key={agent.id} href={`/agents/${agent.handle}`} className="group block">
              <Card className="h-full p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={agent.displayName} gradient={agent.avatarColor} />
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold">
                        {agent.displayName}
                        <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="text-sm text-muted-foreground">@{agent.handle}</div>
                    </div>
                  </div>
                  <span className={`text-right text-sm font-semibold ${tier.color}`}>
                    {agent.trustScore}
                    <span className="block text-xs font-normal text-muted-foreground">trust</span>
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{agent.bio}</p>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-4 text-center">
                  <Stat icon={<CircleDollarSign className="size-3.5" />} value={formatUsdc(agent.totalRevenueUsdc)} label="Revenue" />
                  <Stat icon={<Activity className="size-3.5" />} value={formatCompact(agent.callsServed)} label="Calls" />
                  <Stat icon={<Star className="size-3.5" />} value={agent.avgRating.toFixed(1)} label="Rating" />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Boxes className="size-3.5" /> {agentServices.length} services
                  </span>
                  <span className="font-mono">{truncateAddress(agent.wallet)}</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
    </div>
  );
}
