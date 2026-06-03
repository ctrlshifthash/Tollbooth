"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/connect-button";
import { cn } from "@/lib/utils";

// X (Twitter) logo — lucide doesn't ship the new X mark, so inline it.
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIALS = [
  {
    label: "Bankrbot",
    href: "https://bankr.bot",
    // eslint-disable-next-line @next/next/no-img-element
    icon: <img src="https://static.wixstatic.com/media/e2da02_94fb7378638b43738dd6eafe1de1d0da~mv2.png" alt="Bankrbot" className="size-full rounded-md object-cover" />,
  },
  { label: "X", href: "https://x.com", icon: <XLogo className="size-3.5" /> },
  { label: "GitHub", href: "https://github.com", icon: <Github className="size-4" /> },
];

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/router", label: "Router" },
  { href: "/services", label: "Services" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/agents", label: "Agents" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/monitoring", label: "Monitoring" },
  { href: "/docs", label: "Docs" },
];

// Secondary developer routes (surfaced in the mobile menu + footer).
const DEV_LINKS = [
  { href: "/verify", label: "Verify endpoint" },
  { href: "/manifest", label: "Manifest import" },
  { href: "/claim", label: "Claim a service" },
  { href: "/payments", label: "Payments" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="relative mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:pr-12">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight sm:ml-6 lg:ml-10" onClick={() => setOpen(false)}>
          <span className="size-6 rounded-[5px] bg-primary" />
          <span className="text-lg">Tollbooth</span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(l.href) ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ConnectButton />
          <Link href="/list">
            <Button size="sm">List a Service</Button>
          </Link>
          <div className="mx-1 h-6 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                title={s.label}
                aria-label={s.label}
                className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground transition-all duration-200 hover:-translate-y-1 hover:scale-110 hover:border-[#0000ff]/60 hover:bg-[#0000ff]/15 hover:text-white hover:shadow-[0_8px_24px_-8px_rgba(0,0,255,0.7)]"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        <button
          className="grid size-9 place-items-center rounded-md hover:bg-white/5 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 bg-background/95 px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm font-medium",
                  isActive(l.href) ? "bg-white/5 text-foreground" : "text-muted-foreground"
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="my-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Developer
            </div>
            {DEV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm font-medium",
                  isActive(l.href) ? "bg-white/5 text-foreground" : "text-muted-foreground"
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-white/5 pt-3">
              <ConnectButton />
              <Link href="/list" onClick={() => setOpen(false)}>
                <Button className="w-full">List a Service</Button>
              </Link>
              <div className="flex items-center gap-2 pt-1">
                {SOCIALS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className="grid size-10 flex-1 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground transition-colors hover:border-[#0000ff]/60 hover:bg-[#0000ff]/15 hover:text-white"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
