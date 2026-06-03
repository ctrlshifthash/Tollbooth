"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X, LayoutGrid, Table2, ShieldCheck, Inbox } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServiceCard } from "@/components/service-card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { CATEGORIES, type Service } from "@/lib/types";
import { cn, formatCompact, formatUsdc, reputationTier, truncateAddress } from "@/lib/utils";

type SortKey = "reputation" | "price" | "uptime" | "calls" | "newest";

// Services surfaced by discovery. By default the directory hides the ones that
// are still raw (unverified AND unclaimed) so it stays curated — those live on
// the Discover page until someone verifies or claims them.
const DISCOVERY_SOURCES = new Set(["manual", "github", "farcaster", "virtuals", "bazaar"]);
const isRawDiscovered = (s: Service) =>
  DISCOVERY_SOURCES.has(s.source) && s.verificationStatus !== "verified" && !s.ownership?.walletVerified;

export function ServicesBrowser({ initial }: { initial: Service[] }) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [chain, setChain] = React.useState("all");
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [showDiscovered, setShowDiscovered] = React.useState(false);
  const [maxPrice, setMaxPrice] = React.useState<string>("");
  const [minUptime, setMinUptime] = React.useState(0);
  const [sort, setSort] = React.useState<SortKey>("reputation");
  const [view, setView] = React.useState<"grid" | "table">("grid");
  const [showFilters, setShowFilters] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = initial.slice();
    // Curate by default: keep raw discovered (unverified + unclaimed) listings out
    // of the directory unless the user opts in or filters by a status.
    if (status === "all" && !verifiedOnly && !showDiscovered) list = list.filter((s) => !isRawDiscovered(s));
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.tags.some((t) => t.toLowerCase().includes(query))
      );
    }
    if (category !== "all") list = list.filter((s) => s.category === category);
    if (status !== "all") list = list.filter((s) => s.verificationStatus === status);
    if (chain !== "all") list = list.filter((s) => s.chain === chain);
    if (verifiedOnly) list = list.filter((s) => s.verificationStatus === "verified");
    if (maxPrice !== "" && !Number.isNaN(Number(maxPrice))) list = list.filter((s) => s.priceUsdc <= Number(maxPrice));
    if (minUptime > 0) list = list.filter((s) => s.metrics.uptimePct >= minUptime);

    list.sort((a, b) => {
      switch (sort) {
        case "price":
          return a.priceUsdc - b.priceUsdc;
        case "uptime":
          return b.metrics.uptimePct - a.metrics.uptimePct;
        case "calls":
          return b.metrics.totalCalls - a.metrics.totalCalls;
        case "newest":
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        default:
          return b.metrics.reputationScore - a.metrics.reputationScore;
      }
    });
    return list;
  }, [initial, q, category, status, chain, verifiedOnly, showDiscovered, maxPrice, minUptime, sort]);

  const discoveredHidden = React.useMemo(
    () => (status === "all" && !verifiedOnly && !showDiscovered ? initial.filter(isRawDiscovered).length : 0),
    [initial, status, verifiedOnly, showDiscovered]
  );

  const activeFilterCount =
    (category !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (chain !== "all" ? 1 : 0) +
    (verifiedOnly ? 1 : 0) +
    (maxPrice !== "" ? 1 : 0) +
    (minUptime > 0 ? 1 : 0);

  function reset() {
    setCategory("all");
    setStatus("all");
    setChain("all");
    setVerifiedOnly(false);
    setMaxPrice("");
    setMinUptime(0);
    setQ("");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      {/* Filters sidebar */}
      <aside className={cn("space-y-6 lg:block", showFilters ? "block" : "hidden")}>
        <FilterGroup label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </FilterGroup>

        <FilterGroup label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Any status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="unverified">Unverified</option>
          </Select>
        </FilterGroup>

        <FilterGroup label="Chain">
          <Select value={chain} onChange={(e) => setChain(e.target.value)}>
            <option value="all">All chains</option>
            <option value="base">Base</option>
            <option value="base-sepolia">Base Sepolia</option>
          </Select>
        </FilterGroup>

        <FilterGroup label="Max price (USDC)">
          <Input
            type="number"
            min={0}
            step="0.001"
            placeholder="Any"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </FilterGroup>

        <FilterGroup label={`Min uptime: ${minUptime}%`}>
          <input
            type="range"
            min={0}
            max={100}
            value={minUptime}
            onChange={(e) => setMinUptime(Number(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]"
          />
        </FilterGroup>

        <button
          onClick={() => setVerifiedOnly((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
            verifiedOnly ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-border hover:bg-white/5"
          )}
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> Verified only
          </span>
          <span
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              verifiedOnly ? "bg-emerald-500" : "bg-white/10"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white transition-all",
                verifiedOnly ? "left-[18px]" : "left-0.5"
              )}
            />
          </span>
        </button>

        <button
          onClick={() => setShowDiscovered((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
            showDiscovered ? "border-blue-500/40 bg-blue-500/10 text-blue-300" : "border-border hover:bg-white/5"
          )}
        >
          <span className="flex items-center gap-2">
            <Inbox className="size-4" /> Show discovered
            {discoveredHidden > 0 && !showDiscovered && <Badge variant="muted">{discoveredHidden}</Badge>}
          </span>
          <span className={cn("relative h-5 w-9 rounded-full transition-colors", showDiscovered ? "bg-blue-500" : "bg-white/10")}>
            <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", showDiscovered ? "left-[18px]" : "left-0.5")} />
          </span>
        </button>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="w-full text-muted-foreground">
            <X className="size-4" /> Clear filters ({activeFilterCount})
          </Button>
        )}
      </aside>

      {/* Results */}
      <div>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search services, tags, descriptions…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button
            variant="outline"
            size="default"
            className="lg:hidden"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="size-4" /> Filters
            {activeFilterCount > 0 && <Badge variant="default">{activeFilterCount}</Badge>}
          </Button>

          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto min-w-[150px]">
            <option value="reputation">Top reputation</option>
            <option value="uptime">Highest uptime</option>
            <option value="calls">Most calls</option>
            <option value="price">Lowest price</option>
            <option value="newest">Newest</option>
          </Select>

          <div className="hidden rounded-lg border border-border p-0.5 sm:flex">
            <button
              onClick={() => setView("grid")}
              className={cn("grid size-8 place-items-center rounded-md", view === "grid" ? "bg-white/10" : "text-muted-foreground")}
              aria-label="Grid view"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setView("table")}
              className={cn("grid size-8 place-items-center rounded-md", view === "table" ? "bg-white/10" : "text-muted-foreground")}
              aria-label="Table view"
            >
              <Table2 className="size-4" />
            </button>
          </div>
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "service" : "services"}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="No services match your filters"
            description="Try widening your filters, clearing the search, or list a new service to the registry."
            action={
              <div className="flex gap-3">
                <Button variant="outline" onClick={reset}>
                  Clear filters
                </Button>
                <Link href="/list">
                  <Button>List a Service</Button>
                </Link>
              </div>
            }
          />
        ) : view === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        ) : (
          <ServicesTable services={filtered} />
        )}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ServicesTable({ services }: { services: Service[] }) {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border bg-white/[0.02] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Service</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 text-right font-medium">Price</th>
            <th className="px-4 py-3 text-right font-medium">Uptime</th>
            <th className="px-4 py-3 text-right font-medium">Calls</th>
            <th className="px-4 py-3 font-medium">Wallet</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => {
            const tier = reputationTier(s.metrics.reputationScore);
            return (
              <tr key={s.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/services/${s.slug}`} className="font-medium hover:text-blue-400">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {CATEGORIES.find((c) => c.value === s.category)?.label}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatUsdc(s.priceUsdc)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{s.metrics.uptimePct.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCompact(s.metrics.totalCalls)}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{truncateAddress(s.wallet)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.verificationStatus} />
                </td>
                <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", tier.color)}>
                  {s.metrics.reputationScore}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
