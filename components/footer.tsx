import Link from "next/link";
import { Hexagon, Github, BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/5">
      <div className="container py-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="relative grid size-8 place-items-center rounded-lg bg-primary/15">
                <Hexagon className="size-5 text-primary" strokeWidth={2.5} />
                <span className="absolute text-[9px] font-bold text-blue-300">402</span>
              </span>
              <span className="text-lg">
                Agent<span className="text-gradient-blue">402</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              The trust layer for x402 agents on Base. Discover, verify, and pay for agent APIs in USDC.
            </p>
          </div>

          <FooterCol
            title="Platform"
            links={[
              { href: "/services", label: "Services" },
              { href: "/discover", label: "Discover" },
              { href: "/agents", label: "Agents" },
              { href: "/dashboard", label: "Dashboard" },
              { href: "/verify", label: "Verification" },
              { href: "/list", label: "List a Service" },
            ]}
          />
          <FooterCol
            title="Developers"
            links={[
              { href: "/docs", label: "Documentation" },
              { href: "/manifest", label: "Manifest Import" },
              { href: "/claim", label: "Claim a Service" },
              { href: "/monitoring", label: "Monitoring" },
              { href: "/payments", label: "Payments" },
              { href: "/docs#api", label: "API Reference" },
            ]}
          />
          <FooterCol
            title="Ecosystem"
            links={[
              { href: "https://www.base.org", label: "Base", external: true },
              { href: "https://x402.org", label: "x402", external: true },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Tollbooth. Built on Base.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
              Settling in USDC on Base
            </span>
            <Link href="/docs" className="inline-flex items-center gap-1 hover:text-foreground">
              <BookOpen className="size-4" /> Docs
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Github className="size-4" /> GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {links.map((l) => (
          <li key={l.href + l.label}>
            {l.external ? (
              <a href={l.href} target="_blank" rel="noreferrer" className="hover:text-foreground">
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
