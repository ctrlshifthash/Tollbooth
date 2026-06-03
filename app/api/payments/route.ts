import { NextResponse } from "next/server";
import { getServices } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/payments?serviceId=&onlyPaid=
// Flattens real CallRecords across services into a payment/attempt ledger.
// Only data the app actually produced — no fabricated tx hashes or amounts.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  const onlyPaid = searchParams.get("onlyPaid") === "true";

  const services = await getServices();
  const rows = services
    .filter((s) => !serviceId || s.id === serviceId || s.slug === serviceId)
    .flatMap((s) =>
      (s.callLog ?? []).map((c) => ({
        id: c.id,
        serviceId: s.id,
        serviceName: s.name,
        serviceSlug: s.slug,
        endpoint: s.endpoint,
        chain: s.chain,
        type: c.type,
        paid: c.paid,
        ok: c.ok,
        status: c.status,
        amountUsdc: c.amountUsdc ?? null,
        txHash: c.txHash ?? null,
        latencyMs: c.latencyMs,
        timestamp: c.timestamp,
        error: c.error ?? null,
      }))
    )
    .filter((r) => !onlyPaid || r.paid)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const settledRevenue = rows
    .filter((r) => r.paid && r.ok && typeof r.amountUsdc === "number")
    .reduce((sum, r) => sum + (r.amountUsdc ?? 0), 0);

  return NextResponse.json({
    payments: rows,
    count: rows.length,
    paidCount: rows.filter((r) => r.paid && r.ok).length,
    settledRevenue,
  });
}
