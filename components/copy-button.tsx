"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends Omit<ButtonProps, "onClick"> {
  value: string;
  label?: string;
}

export function CopyButton({ value, label, variant = "outline", size = "sm", className, ...props }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — fail silently.
    }
  }

  return (
    <Button variant={variant} size={size} onClick={copy} className={cn(className)} {...props}>
      {copied ? <Check className="text-emerald-400" /> : <Copy />}
      {label ?? (copied ? "Copied" : "Copy")}
    </Button>
  );
}
