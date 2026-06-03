import { reputationTier } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function ReputationScore({
  score,
  size = "md",
  showLabel = true,
  className,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const tier = reputationTier(score);
  const dim = size === "lg" ? 88 : size === "sm" ? 40 : 56;
  const stroke = size === "lg" ? 7 : size === "sm" ? 4 : 5;
  const r = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={tier.color}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-semibold tabular-nums",
            size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-sm"
          )}
        >
          {score}
        </span>
      </div>
      {showLabel && (
        <div className="leading-tight">
          <div className={cn("font-semibold", tier.color)}>{tier.label}</div>
          <div className="text-xs text-muted-foreground">Reputation</div>
        </div>
      )}
    </div>
  );
}
