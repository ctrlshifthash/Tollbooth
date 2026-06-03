import Link from "next/link";
import { Activity, Wallet, Zap, ArrowUpRight, BadgeCheck, FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import type { Service } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { cn, formatCompact, formatUsdc, reputationTier, truncateAddress } from "@/lib/utils";

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function ServiceCard({ service }: { service: Service }) {
  const tier = reputationTier(service.metrics.reputationScore);
  return (
    <Link href={`/services/${service.slug}`} className="group block">
      <Card className="h-full p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/80">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{service.name}</h3>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <Badge variant="muted" className="mt-1.5">
              {categoryLabel(service.category)}
            </Badge>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge status={service.verificationStatus} />
            {service.ownership?.walletVerified && (
              <Badge variant="success">
                <BadgeCheck className="size-3" /> Owner
              </Badge>
            )}
            {service.demo && (
              <Badge variant="warning">
                <FlaskConical className="size-3" /> Demo
              </Badge>
            )}
            {!service.demo && service.ownership && !service.ownership.claimed && service.source !== "submission" && (
              <Badge variant="muted">Unclaimed</Badge>
            )}
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{service.description}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Metric icon={<Zap className="size-3.5" />} label="Price" value={`${formatUsdc(service.priceUsdc)}`} />
          <Metric
            icon={<Activity className="size-3.5" />}
            label="Uptime"
            value={`${service.metrics.uptimePct.toFixed(1)}%`}
          />
          <Metric label="Calls" value={formatCompact(service.metrics.totalCalls)} />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <Wallet className="size-3.5" />
            {truncateAddress(service.wallet)}
          </span>
          <span className={cn("flex items-center gap-1.5 text-sm font-semibold", tier.color)}>
            <span className="tabular-nums">{service.metrics.reputationScore}</span>
            <span className="text-xs font-normal text-muted-foreground">{tier.label}</span>
          </span>
        </div>
      </Card>
    </Link>
  );
}

function Metric({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
