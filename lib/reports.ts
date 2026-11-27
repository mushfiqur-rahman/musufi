// Profit reports. Server-only. Sales count when an order is DELIVERED
// (cash on delivery: money only arrives then); returns count when they come back.
import { select, selectOne } from "./db";
import { getSettings } from "./orders";
import { addDays, dhakaDayStartUtc, sqlUtc } from "./time";

export type Report = {
  from: string;
  to: string;
  placed: number;
  delivered: number;
  returned: number;
  revenue: number; // what delivered customers paid (items + delivery fee)
  itemSales: number;
  deliveryCharged: number;
  cogs: number; // cost of goods for delivered orders
  missingCost: number; // delivered orders whose cost was not set
  courierCost: number; // courier for delivered + returned parcels
  packingCost: number;
  returnLoss: number; // courier + packing spent on returned parcels (part of the two above)
  expenses: number;
  profit: number;
  days: { date: string; delivered: number; revenue: number; profit: number }[];
  topProducts: { name: string; qty: number; sales: number }[];
};

/** Report for Dhaka dates from..to inclusive (YYYY-MM-DD). */
export async function buildReport(from: string, to: string): Promise<Report> {
  const start = sqlUtc(dhakaDayStartUtc(from));
  const end = sqlUtc(dhakaDayStartUtc(addDays(to, 1)));
  const s = await getSettings();

  const delivered = await select<{ id: number; zone: "dhaka" | "outside"; total: number; subtotal: number; delivery_fee: number; cost_total: number | null; day: string }>(
    `SELECT id, zone, total, subtotal, delivery_fee, cost_total,
            DATE_FORMAT(CONVERT_TZ(delivered_at, '+00:00', '+06:00'), '%Y-%m-%d') AS day
     FROM orders WHERE status = 'delivered' AND delivered_at >= ? AND delivered_at < ?`,
    [start, end],
  );
  const returned = await select<{ zone: "dhaka" | "outside"; day: string }>(
    `SELECT zone, DATE_FORMAT(CONVERT_TZ(returned_at, '+00:00', '+06:00'), '%Y-%m-%d') AS day
     FROM orders WHERE status = 'returned' AND returned_at >= ? AND returned_at < ?`,
    [start, end],
  );
  const placed = await selectOne<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE created_at >= ? AND created_at < ?", [start, end]);
  const exp = await select<{ day: string; amount: number }>(
    "SELECT DATE_FORMAT(spent_on, '%Y-%m-%d') AS day, SUM(amount) AS amount FROM expenses WHERE spent_on BETWEEN ? AND ? GROUP BY spent_on",
    [from, to],
  );
  const top = await select<{ name: string; qty: number; sales: number }>(
    `SELECT CONCAT(i.product_name, ' · ', i.variant_label) AS name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_price) AS sales
     FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.status = 'delivered' AND o.delivered_at >= ? AND o.delivered_at < ?
     GROUP BY i.product_slug, i.variant_index, name ORDER BY qty DESC LIMIT 5`,
    [start, end],
  );

  const courier = (zone: "dhaka" | "outside") => (zone === "dhaka" ? s.courier_cost_dhaka : s.courier_cost_outside);

  // Per-day buckets.
  const days = new Map<string, { delivered: number; revenue: number; profit: number }>();
  for (let d = from; d <= to; d = addDays(d, 1)) days.set(d, { delivered: 0, revenue: 0, profit: 0 });
  const bucket = (d: string) => days.get(d) ?? days.set(d, { delivered: 0, revenue: 0, profit: 0 }).get(d)!;

  let revenue = 0, itemSales = 0, deliveryCharged = 0, cogs = 0, missingCost = 0, courierCost = 0, packingCost = 0, returnLoss = 0;
  for (const o of delivered) {
    const c = courier(o.zone);
    revenue += o.total;
    itemSales += o.subtotal;
    deliveryCharged += o.delivery_fee;
    if (o.cost_total === null) missingCost++;
    cogs += o.cost_total ?? 0;
    courierCost += c;
    packingCost += s.packing_cost;
    const b = bucket(o.day);
    b.delivered++;
    b.revenue += o.total;
    b.profit += o.total - (o.cost_total ?? 0) - c - s.packing_cost;
  }
  for (const r of returned) {
    const loss = courier(r.zone) + s.packing_cost;
    courierCost += courier(r.zone);
    packingCost += s.packing_cost;
    returnLoss += loss;
    bucket(r.day).profit -= loss;
  }
  let expenses = 0;
  for (const e of exp) {
    expenses += Number(e.amount);
    bucket(e.day).profit -= Number(e.amount);
  }

  return {
    from,
    to,
    placed: Number(placed?.n ?? 0),
    delivered: delivered.length,
    returned: returned.length,
    revenue,
    itemSales,
    deliveryCharged,
    cogs,
    missingCost,
    courierCost,
    packingCost,
    returnLoss,
    expenses,
    profit: revenue - cogs - courierCost - packingCost - expenses,
    days: [...days.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([date, v]) => ({ date, ...v })),
    topProducts: top.map((t) => ({ name: t.name, qty: Number(t.qty), sales: Number(t.sales) })),
  };
}
