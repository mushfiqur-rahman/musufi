// Customer list, segments and profile data for the admin. Server-only.
import { execute, select, selectOne } from "./db";

/**
 * Segments (computed, not stored):
 * - new: at most one order
 * - repeat: two or more orders
 * - vip: ≥ ৳10,000 delivered or ≥ 5 delivered orders
 * - inactive: last order more than 90 days ago
 * - blocked: login blocked by staff
 */
export const SEGMENTS = ["new", "repeat", "vip", "inactive", "blocked"] as const;
export type Segment = (typeof SEGMENTS)[number];
export const segmentLabel: Record<Segment, string> = { new: "নতুন", repeat: "বারবার কেনেন", vip: "VIP", inactive: "নিষ্ক্রিয় (৯০+ দিন)", blocked: "ব্লক করা" };

export const VIP_SPEND = 10_000;
export const VIP_ORDERS = 5;

export type CustomerRow = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  created_at: Date;
  blocked_at: Date | null;
  orders: number;
  delivered: number;
  returned: number;
  ltv: number; // taka from delivered orders
  last_order: Date | null;
  /** 1 when the last order is more than 90 days old (computed by the database). */
  inactive: number;
};

const BASE = `
  SELECT c.id, c.email, c.name, c.phone, c.created_at, c.blocked_at,
         COUNT(o.id) AS orders,
         COALESCE(SUM(o.status = 'delivered'), 0) AS delivered,
         COALESCE(SUM(o.status = 'returned'), 0) AS returned,
         COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total ELSE 0 END), 0) AS ltv,
         MAX(o.created_at) AS last_order,
         COALESCE(MAX(o.created_at) < UTC_TIMESTAMP() - INTERVAL 90 DAY, 0) AS inactive
  FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
  WHERE c.role IS NULL`;

const HAVING: Record<Segment, string> = {
  new: "COUNT(o.id) <= 1",
  repeat: "COUNT(o.id) >= 2",
  vip: `(COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total ELSE 0 END), 0) >= ${VIP_SPEND} OR COALESCE(SUM(o.status = 'delivered'), 0) >= ${VIP_ORDERS})`,
  inactive: "MAX(o.created_at) < UTC_TIMESTAMP() - INTERVAL 90 DAY",
  blocked: "c.blocked_at IS NOT NULL",
};

export function segmentsOf(c: Pick<CustomerRow, "orders" | "delivered" | "ltv" | "inactive" | "blocked_at">): Segment[] {
  const s: Segment[] = [];
  if (c.blocked_at) s.push("blocked");
  if (Number(c.ltv) >= VIP_SPEND || Number(c.delivered) >= VIP_ORDERS) s.push("vip");
  s.push(Number(c.orders) >= 2 ? "repeat" : "new");
  if (Number(c.inactive)) s.push("inactive");
  return s;
}

export const CUSTOMER_PAGE = 50;

export async function listCustomers(f: { q?: string; segment?: Segment; page?: number }): Promise<{ rows: CustomerRow[]; total: number }> {
  const params: unknown[] = [];
  let where = "";
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    where = " AND (c.email LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)";
    params.push(like, like, like);
  }
  const having = f.segment ? ` HAVING ${HAVING[f.segment]}` : "";
  const grouped = `${BASE}${where} GROUP BY c.id${having}`;
  const page = Math.max(1, f.page ?? 1);
  const [rows, count] = await Promise.all([
    select<CustomerRow>(`${grouped} ORDER BY last_order IS NULL, last_order DESC, c.id DESC LIMIT ? OFFSET ?`, [...params, CUSTOMER_PAGE, (page - 1) * CUSTOMER_PAGE]),
    selectOne<{ n: number }>(`SELECT COUNT(*) AS n FROM (${grouped}) x`, params),
  ]);
  return { rows, total: Number(count?.n ?? 0) };
}

export type CustomerProfile = CustomerRow & { address: string | null; notes: string | null; last_login_at: Date | null; role: string | null };

export async function getCustomer(id: number): Promise<CustomerProfile | null> {
  return selectOne<CustomerProfile>(
    `SELECT c.id, c.email, c.name, c.phone, c.address, c.notes, c.role, c.created_at, c.last_login_at, c.blocked_at,
            COUNT(o.id) AS orders,
            COALESCE(SUM(o.status = 'delivered'), 0) AS delivered,
            COALESCE(SUM(o.status = 'returned'), 0) AS returned,
            COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total ELSE 0 END), 0) AS ltv,
            MAX(o.created_at) AS last_order,
         COALESCE(MAX(o.created_at) < UTC_TIMESTAMP() - INTERVAL 90 DAY, 0) AS inactive
     FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
     WHERE c.id = ? GROUP BY c.id`,
    [id],
  );
}

/** Blocks or unblocks login. Blocking also ends all of the customer's sessions. Staff can't be blocked here. */
export async function setBlocked(id: number, blocked: boolean): Promise<boolean> {
  const r = await execute(`UPDATE customers SET blocked_at = ${blocked ? "UTC_TIMESTAMP()" : "NULL"} WHERE id = ? AND role IS NULL`, [id]);
  if (blocked && r.affectedRows === 1) await execute("DELETE FROM sessions WHERE customer_id = ?", [id]);
  return r.affectedRows === 1;
}

export async function setCustomerNotes(id: number, notes: string): Promise<void> {
  await execute("UPDATE customers SET notes = ? WHERE id = ?", [notes || null, id]);
}
