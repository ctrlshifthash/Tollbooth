"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Receipt,
  Loader2,
  ExternalLink,
  CircleDollarSign,
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { explorerTxUrl, formatUsdc, truncateAddress, timeAgo } from "@/lib/utils";

interface PaymentRow {
  id: string;
  serviceName: string;
  serviceSlug: string;
  endpoint: string;
  chain: "base" | "base-sepolia";
  type: string;
  paid: boolean;
  ok: boolean;
  status: number;
  amountUsdc: number | null;
  txHash: string | null;
  latencyMs: number;
  timestamp: string;
  error: string | null;
}

function PaymentsInner() {
  const serviceId = useSearchParams().get("serviceId");
  const [rows, setRows] = React.useState<PaymentRow[] | null>(null);
  const [paidCount, setPaidCount] = React.useState(0);
  const [revenue, setRevenue] = React.useState(0);
  const [filter, setFilter] = React.useState<"all" | "paid">("all");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : "";
      const res = await fetch(`/api/payments${qs}`, { cache: "no-store" });
      const data = await res.json();
      setRows(data.payments as PaymentRow[]);
      setPaidCount(data.paidCount);
      setRevenue(data.settledRevenue);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const visible = (rows ?? []).filter((r) => (filter === "paid" ? r.paid : true));

  return (
    <div className="container py-12">
      <div className="base-hero base-dither relative mb-8 overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <Receipt className="size-3.5" /> Payments
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Payment &amp; call ledger</h1>
          <p className="mt-2 max-w-2xl text-blue-50/90">
            Every real test call and x402 payment attempt the app has made. Settlement tx hashes are captured only when
            the facilitator returns one — none are fabricated.
          </p>
        </div>
      </div>
      <div className="mb-8 flex flex-wrap items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as "all" | "paid")} className="w-auto">
            <option value="all">All attempts</option>
            <option value="paid">Paid only</option>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Kpi icon={<CreditCard className="size-4" />} label="Total attempts" value={(rows?.length ?? 0).toString()} />
        <Kpi icon={<CheckCircle2 className="size-4" />} label="Settled payments" value={paidCount.toString()} />
        <Kpi icon={<CircleDollarSign className="size-4" />} label="Revenue (settled)" value={formatUsdc(revenue)} accent />
      </div>

      {rows === null ? (
        <Card><CardContent className="flex justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></CardContent></Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="No payments recorded yet"
          description="Real test calls and paid x402 calls show up here. Open a service and use “Test Endpoint” or “Pay & Call” to create the first record."
          action={
            <Link href="/services">
              <Button>Browse services</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-white/[0.02] text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium">Endpoint</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Chain</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Tx / response</th>
                    <th className="px-4 py-3 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Link href={`/services/${r.serviceSlug}`} className="font-medium hover:text-blue-400">
                          {r.serviceName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.paid ? "payment" : "test call"}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[220px] truncate font-mono text-xs text-muted-foreground">{r.endpoint}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.amountUsdc != null ? formatUsdc(r.amountUsdc) : "—"}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{r.chain}</td>
                      <td className="px-4 py-3">
                        {r.ok ? (
                          <Badge variant="success"><CheckCircle2 className="size-3" /> {r.status || "ok"}</Badge>
                        ) : (
                          <Badge variant="destructive"><XCircle className="size-3" /> {r.status || "fail"}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.txHash ? (
                          <a
                            href={explorerTxUrl(r.chain, r.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs text-blue-400 hover:underline"
                          >
                            {truncateAddress(r.txHash, 10, 8)} <ExternalLink className="size-3" />
                          </a>
                        ) : r.error ? (
                          <span className="text-xs text-red-400/80">{r.error.slice(0, 40)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.paid ? "no tx returned" : "unpaid probe"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{timeAgo(r.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="container flex max-w-4xl items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <PaymentsInner />
    </React.Suspense>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/[0.06] p-5" : "p-5"}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
