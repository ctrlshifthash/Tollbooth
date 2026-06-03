import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Tollbooth — The trust layer for x402 agents on Base",
    template: "%s · Tollbooth",
  },
  description:
    "Discover paid agent APIs, verify x402 endpoints, track reputation, and pay per request with USDC on Base.",
  metadataBase: new URL("https://agent402.example"),
  openGraph: {
    title: "Tollbooth — The trust layer for x402 agents on Base",
    description:
      "Discover, verify, and pay for x402 agent services in USDC on Base. Real endpoints, real reputation.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background">
        <Providers>
          <div className="pointer-events-none fixed inset-0 -z-10 spotlight" />
          <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[380px] aurora opacity-[0.16]" />
          <Nav />
          <main className="relative">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
