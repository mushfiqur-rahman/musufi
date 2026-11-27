// Turns URL search params into a safe OrderFilter. Shared by the order list
// page and the CSV export so both always filter the same way.
import { PAYMENT_STATUSES, STATUSES, type OrderFilter, type OrderStatus, type PaymentStatus } from "./orders";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(p: Params, k: string): string {
  const v = p instanceof URLSearchParams ? p.get(k) : p[k];
  return typeof v === "string" ? v.trim() : "";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseOrderFilter(p: Params): OrderFilter {
  const status = get(p, "status");
  const payment = get(p, "payment");
  const district = Number(get(p, "district"));
  const from = get(p, "from");
  const to = get(p, "to");
  return {
    q: get(p, "q").slice(0, 80) || undefined,
    status: (STATUSES as readonly string[]).includes(status) ? (status as OrderStatus) : undefined,
    payment: (PAYMENT_STATUSES as readonly string[]).includes(payment) ? (payment as PaymentStatus) : undefined,
    districtId: Number.isInteger(district) && district > 0 && district < 100 ? district : undefined,
    from: DATE.test(from) ? from : undefined,
    to: DATE.test(to) ? to : undefined,
  };
}

/** Back to a query string (for pagination, export and status chips). */
export function filterQuery(f: OrderFilter, extra: Record<string, string | number | undefined> = {}): string {
  const q = new URLSearchParams();
  if (f.q) q.set("q", f.q);
  if (f.status) q.set("status", f.status);
  if (f.payment) q.set("payment", f.payment);
  if (f.districtId) q.set("district", String(f.districtId));
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}
