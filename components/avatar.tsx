import { cn } from "@/lib/utils";

// Deterministic gradient avatar from a seed + initials.
export function Avatar({
  name,
  gradient = "from-blue-600 to-blue-400",
  size = "md",
  className,
}: {
  name: string;
  gradient?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const dim = size === "lg" ? "size-16 text-xl" : size === "sm" ? "size-8 text-xs" : "size-11 text-sm";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white/10",
        gradient,
        dim,
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}
