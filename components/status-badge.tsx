import { BadgeCheck, Clock, CircleSlash, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAP: Record<
  VerificationStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "muted"; Icon: typeof BadgeCheck }
> = {
  verified: { label: "Verified", variant: "success", Icon: BadgeCheck },
  pending: { label: "Pending", variant: "warning", Icon: Clock },
  failed: { label: "Failed", variant: "destructive", Icon: XCircle },
  unverified: { label: "Unverified", variant: "muted", Icon: CircleSlash },
};

export function StatusBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  const { label, variant, Icon } = MAP[status];
  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
