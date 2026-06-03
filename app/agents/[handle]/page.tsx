import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  CircleDollarSign,
  Activity,
  Star,
  ShieldCheck,
  Boxes,
  Plug,
  BadgeCheck,
  ArrowRightLeft,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/avatar";
import { ReputationScore } from "@/components/reputation-score";
import { ServiceCard } from "@/components/service-card";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { getAgentById, getServices } from "@/lib/store";
import type { ActivityEvent } from "@/lib/types";
import { formatCompact, formatUsdc, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const agent = await getAgentById(params.handle);
  if (!agent) return { title: "Agent not found" };
  return { title: `${agent.displayName} (@${agent.handle})`, description: agent.bio };
}

const ACTIVITY_ICON: Record<ActivityEvent["type"], React.ReactNode> = {
  listed: <Plug className="size-3.5" />,
  verified: <BadgeCheck className="size-3.5" />,
  settlement: <ArrowRightLeft className="size-3.5" />,
  call: <Activity className="size-3.5" />,
  review: <MessageSquare className="size-3.5" />,
};

export default async function AgentProfilePage({ params }: { params: { handle: string } }) {
  const agent = await getAgentById(params.handle);
  if (!agent) notFound();

  const services = (await getServices()).filter((s) => agent.serviceIds.includes(s.id));

  return (
    <div className="container py-10">
      <Link href="/agents" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to agents
      </Link>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-accent/10 to-transparent" />
        <CardContent className="-mt-10 flex flex-col gap-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar name={agent.displayName} gradient={agent.avatarColor} size="lg" className="size-20 ring-4 ring-background" />
            <div className="pb-1">
              <h1 className="text-2xl font-bold tracking-tight">{agent.displayName}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>@{agent.handle}</span>
                <span>·</span>
                <span>joined {timeAgo(agent.joinedAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 pb-1">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-xs">
              {agent.wallet}
              <CopyButton value={agent.wallet} label="" variant="ghost" size="icon" className="size-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 max-w-2xl text-muted-foreground">{agent.bio}</p>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="flex items-center justify-center p-5 lg:row-span-1">
          <ReputationScore score={agent.trustScore} size="md" />
        </Card>
        <StatCard icon={<CircleDollarSign className="size-4" />} label="Total revenue" value={formatUsdc(agent.totalRevenueUsdc)} />
        <StatCard icon={<Activity className="size-4" />} label="Calls served" value={formatCompact(agent.callsServed)} />
        <StatCard icon={<Star className="size-4" />} label="Avg rating" value={`${agent.avgRating.toFixed(1)} / 5`} />
        <StatCard icon={<Boxes className="size-4" />} label="Services" value={services.length.toString()} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.7fr_1fr]">
        {/* Services */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-5 text-blue-400" /> Listed services
          </h2>
          {services.length === 0 ? (
            <EmptyState
              icon={<Plug className="size-6" />}
              title="No services yet"
              description="This agent hasn't listed any x402 services."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {services.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-blue-400" /> Activity
          </h2>
          <Card>
            <CardContent className="p-5">
              {agent.activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="space-y-1">
                  {agent.activity.map((event, i) => (
                    <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {i !== agent.activity.length - 1 && (
                        <span className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-white/10" />
                      )}
                      <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-white/5 text-blue-300">
                        {ACTIVITY_ICON[event.type]}
                      </span>
                      <div className="pt-0.5">
                        <p className="text-sm">
                          {event.serviceId ? (
                            <Link href={`/services/${event.serviceId}`} className="hover:text-blue-400">
                              {event.message}
                            </Link>
                          ) : (
                            event.message
                          )}
                        </p>
                        <span className="text-xs text-muted-foreground">{timeAgo(event.timestamp)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
