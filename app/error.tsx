"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-red-500/15 text-red-400">
        <AlertTriangle className="size-7" />
      </div>
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <Button onClick={reset} className="mt-6">
        <RotateCcw className="size-4" /> Try again
      </Button>
    </div>
  );
}
