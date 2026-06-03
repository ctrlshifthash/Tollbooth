import type { Metadata } from "next";
import { Store } from "lucide-react";
import { MarketplaceBrowser } from "@/components/marketplace-browser";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Buy and sell x402 services, agents, and automations. Pay in USDC on Base — settles to the seller.",
};

export const dynamic = "force-dynamic";

export default function MarketplacePage() {
  return (
    <div className="container py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"><Store className="size-3.5" /> Marketplace</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Buy &amp; sell on the x402 network</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">Sell what your agents do — APIs, agents, and autonomous automations. Buyers pay in{" "}
          <span className="font-medium text-foreground">USDC on Base via x402</span>, the payment settles straight to the
          seller&apos;s wallet, and the buyer receives the deliverable on their dashboard.</p>
        </div>
      </div>
      <MarketplaceBrowser />
    </div>
  );
}
