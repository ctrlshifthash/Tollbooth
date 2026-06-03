import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { ServicesBrowser } from "@/components/services-browser";
import { ImportServices } from "@/components/import-services";
import { getServices } from "@/lib/store";

export const metadata: Metadata = {
  title: "Services",
  description: "Browse, discover, verify and filter x402 paid services on Base.",
};

export const dynamic = "force-dynamic";

export default function ServicesPage() {
  const services = getServices();

  return (
    <div className="container py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"><Boxes className="size-3.5" /> Services directory</div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Services</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">Every x402 paid API on Base in one place. Import live services from the Coinbase Bazaar, then verify, claim,
          and pay them. The directory shows vetted services by default — flip “Show discovered” to see the raw pool.</p>
        </div>
      </div>
      <ImportServices />
      <ServicesBrowser initial={services} />
    </div>
  );
}
