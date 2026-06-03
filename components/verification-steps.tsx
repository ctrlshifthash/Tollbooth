import { BadgeCheck, XCircle, Clock, MinusCircle } from "lucide-react";
import type { VerificationStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON = {
  pass: { Icon: BadgeCheck, color: "text-emerald-400", ring: "bg-emerald-500/15" },
  fail: { Icon: XCircle, color: "text-red-400", ring: "bg-red-500/15" },
  pending: { Icon: Clock, color: "text-amber-400", ring: "bg-amber-500/15" },
  skipped: { Icon: MinusCircle, color: "text-muted-foreground", ring: "bg-white/5" },
} as const;

export function VerificationSteps({ steps, animate = false }: { steps: VerificationStep[]; animate?: boolean }) {
  return (
    <ol className="relative space-y-1">
      {steps.map((step, i) => {
        const { Icon, color, ring } = ICON[step.status];
        const isLast = i === steps.length - 1;
        return (
          <li
            key={step.id}
            className={cn("relative flex gap-4 pb-5", animate && "animate-fade-up")}
            style={animate ? { animationDelay: `${i * 90}ms`, opacity: 0 } : undefined}
          >
            {!isLast && <span className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-px bg-white/10" />}
            <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full", ring)}>
              <Icon className={cn("size-4", color)} />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{step.label}</span>
                <span className={cn("text-xs font-medium uppercase tracking-wide", color)}>{step.status}</span>
              </div>
              {step.detail && <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
