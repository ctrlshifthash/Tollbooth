"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  language = "json",
  filename,
  className,
}: {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/10 bg-[#0a0e1a]", className)}>
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2">
        <span className="font-mono text-xs text-muted-foreground">{filename ?? language}</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-blue-100/90">{code}</code>
      </pre>
    </div>
  );
}
