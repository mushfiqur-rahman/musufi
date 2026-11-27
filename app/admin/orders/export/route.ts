// CSV export of orders with the same filters as the order list.
// UTF-8 with BOM so Excel shows Bangla correctly. Staff only (orders.view).
import { assertPermission } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { parseOrderFilter } from "@/lib/order-filters";
import { exportOrders, paymentMethodLabel, paymentStatusLabel, statusLabel } from "@/lib/orders";

/** Quotes a CSV cell and neutralises spreadsheet formulas (=, +, -, @ at the start). */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  let me;
  try {
    me = await assertPermission("orders.view");
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  const filter = parseOrderFilter(new URL(request.url).searchParams);
  const rows = await exportOrders(filter);
  const header = ["অর্ডার নম্বর", "তারিখ (UTC)", "অবস্থা", "ক্রেতা", "ফোন", "ইমেইল", "ঠিকানা", "এলাকা", "পণ্য", "পণ্যের দাম", "ডেলিভারি চার্জ", "মোট", "কেনা দাম", "পেমেন্ট", "পেমেন্টের অবস্থা", "পাওয়া টাকা", "কুরিয়ার", "ট্র্যাকিং", "নোট"];
  const lines = rows.map((o) => [
    o.order_no, o.created_at, statusLabel[o.status], o.name, o.phone, o.email, o.address, o.zone === "dhaka" ? "ঢাকা" : "ঢাকার বাইরে",
    (o.items ?? "").replace(/\n/g, "; "), o.subtotal, o.delivery_fee, o.total, o.cost_total, paymentMethodLabel[o.payment_method],
    paymentStatusLabel[o.payment_status], o.paid_amount, o.courier, o.tracking_no, o.note,
  ].map(cell).join(","));
  await audit(me, "order.export", "order", null, { count: rows.length, filter });
  const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="musufi-orders-${date}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
