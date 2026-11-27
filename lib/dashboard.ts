// Numbers for the admin dashboard home. Server-only.
// "Sales" here = value of orders PLACED (cancelled excluded), which is what an
// owner watches day to day. Profit (counted at delivery) lives in lib/reports.ts.
import { select, selectOne } from "./db";
import { addDays, dhakaDayStartUtc, dhakaToday, monthStart, sqlUtc, weekStart } from "./time";

export type Kpi = { orders: number; sales: number; aov: number; prevOrders: number; prevSales: number };

async function salesBetween(fromDate: string, toDateExclusive: string): Promise<{ orders: number; sales: number }> {
  const r = await selectOne<{ orders: number; sales: number | null }>(
    "SELECT COUNT(*) AS orders, SUM(total) AS sales FROM orders WHERE status <> 'cancelled' AND created_at >= ? AND created_at < ?",
    [sqlUtc(dhakaDayStartUtc(fromDate)), sqlUtc(dhakaDayStartUtc(toDateExclusive))],
  );
  return { orders: Number(r?.orders ?? 0), sales: Number(r?.sales ?? 0) };
}

/** KPI for [from, today] compared with the same number of days just before it. */
async function kpi(from: string, today: string): Promise<Kpi> {
  const end = addDays(today, 1);
  const days = Math.round((dhakaDayStartUtc(end).getTime() - dhakaDayStartUtc(from).getTime()) / 864e5);
  const [cur, prev] = await Promise.all([salesBetween(from, end), salesBetween(addDays(from, -days), from)]);
  return { ...cur, aov: cur.orders ? Math.round(cur.sales / cur.orders) : 0, prevOrders: prev.orders, prevSales: prev.sales };
}

export async function dashboardKpis() {
  const today = dhakaToday();
  const [d, w, m] = await Promise.all([kpi(today, today), kpi(weekStart(today), today), kpi(monthStart(today), today)]);
  return { today: d, week: w, month: m };
}

export type DayPoint = { date: string; orders: number; sales: number };

/** Orders and sales per Dhaka day for the last `days` days (zero-filled). */
export async function dailySeries(days: number): Promise<DayPoint[]> {
  const today = dhakaToday();
  const from = addDays(today, -(days - 1));
  const rows = await select<{ day: string; orders: number; sales: number | null }>(
    `SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+06:00'), '%Y-%m-%d') AS day, COUNT(*) AS orders, SUM(total) AS sales
     FROM orders WHERE status <> 'cancelled' AND created_at >= ? GROUP BY day`,
    [sqlUtc(dhakaDayStartUtc(from))],
  );
  const by = new Map(rows.map((r) => [r.day, r]));
  const out: DayPoint[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const r = by.get(d);
    out.push({ date: d, orders: Number(r?.orders ?? 0), sales: Number(r?.sales ?? 0) });
  }
  return out;
}

export async function todoCounts() {
  const r = await selectOne<{ fresh: number; stale: number; toShip: number; shipped: number }>(
    `SELECT
       COALESCE(SUM(status = 'new'), 0) AS fresh,
       COALESCE(SUM(status = 'new' AND created_at < UTC_TIMESTAMP() - INTERVAL 24 HOUR), 0) AS stale,
       COALESCE(SUM(status = 'confirmed'), 0) AS toShip,
       COALESCE(SUM(status = 'shipped'), 0) AS shipped
     FROM orders`,
  );
  return { fresh: Number(r?.fresh ?? 0), stale: Number(r?.stale ?? 0), toShip: Number(r?.toShip ?? 0), shipped: Number(r?.shipped ?? 0) };
}

export async function topProducts(days = 30) {
  return select<{ name: string; qty: number; sales: number }>(
    `SELECT i.product_name AS name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_price) AS sales
     FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.status <> 'cancelled' AND o.created_at >= UTC_TIMESTAMP() - INTERVAL ? DAY
     GROUP BY i.product_name ORDER BY qty DESC LIMIT 5`,
    [days],
  );
}

export async function topCustomers(limit = 5) {
  return select<{ name: string | null; email: string; orders: number; spent: number }>(
    `SELECT c.name, c.email, COUNT(o.id) AS orders, SUM(o.total) AS spent
     FROM customers c JOIN orders o ON o.customer_id = c.id
     WHERE o.status = 'delivered' GROUP BY c.id ORDER BY spent DESC LIMIT ?`,
    [limit],
  );
}

export async function recentOrders(limit = 6) {
  return select<{ order_no: string; name: string; total: number; status: string; created_at: Date }>(
    "SELECT order_no, name, total, status, created_at FROM orders ORDER BY id DESC LIMIT ?",
    [limit],
  );
}

export async function newCustomers(limit = 5) {
  return select<{ email: string; name: string | null; created_at: Date }>(
    "SELECT email, name, created_at FROM customers WHERE role IS NULL ORDER BY id DESC LIMIT ?",
    [limit],
  );
}

/** Percentage change, or null when there's nothing to compare with. */
export function change(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 100);
}
