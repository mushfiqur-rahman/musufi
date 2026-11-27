// Orders, delivery-history risk, costs and settings. Server-only.
import { execute, select, selectOne, transaction } from "./db";
import { newOrderNo } from "./mailer";
import { addDays, dhakaDayStartUtc, sqlUtc } from "./time";
import type { Orderable } from "./catalog";
import type { AddressParts } from "./geo";
import type { DeliveryZone } from "./site";

export const STATUSES = ["new", "confirmed", "shipped", "delivered", "returned", "cancelled"] as const;
export type OrderStatus = (typeof STATUSES)[number];

export const statusLabel: Record<OrderStatus, string> = {
  new: "নতুন",
  confirmed: "নিশ্চিত",
  shipped: "পাঠানো হয়েছে",
  delivered: "ডেলিভারি হয়েছে",
  returned: "ফেরত এসেছে",
  cancelled: "বাতিল",
};

export type NewOrder = {
  customerId: number;
  /** Fresh from the database (lib/catalog.ts loadOrderable), never from the cache. */
  product: Orderable;
  variantIndex: number;
  qty: number;
  zone: DeliveryZone;
  deliveryFee: number;
  name: string;
  phone: string;
  /** Full address line (see lib/geo.ts formatAddress). */
  address: string;
  parts: AddressParts;
  /** Validated coupon (lib/coupons.ts evaluateCoupon), if any. */
  coupon?: { id: number; code: string; discount: number };
};

/** Thrown when a coupon reached its total usage limit while the order was being placed. */
export class CouponUsedUpError extends Error {
  readonly code = "COUPON_USED_UP";
}

/** Thrown when a tracked variant doesn't have enough stock left. */
export class OutOfStockError extends Error {
  readonly code = "OUT_OF_STOCK";
}

/**
 * Saves the order in one transaction: order row, item (with price and cost
 * snapshot), first history event, stock decrement, remembered contact details.
 * Stock is decremented with a guarded UPDATE, so two customers can never both
 * buy the last unit.
 */
export async function createOrder(o: NewOrder): Promise<{ orderNo: string; subtotal: number; total: number }> {
  const v = o.product.variants[o.variantIndex];
  const subtotal = v.price * o.qty;
  const discount = o.coupon?.discount ?? 0;
  const total = Math.max(0, subtotal + o.deliveryFee - discount);
  const cost = v.cost;

  for (let attempt = 0; attempt < 3; attempt++) {
    const orderNo = newOrderNo();
    try {
      await transaction(async (conn) => {
        const [stock] = await conn.query<import("mysql2").ResultSetHeader>(
          "UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL AND stock >= ?",
          [o.qty, v.id, o.qty],
        );
        if (v.stock !== null && stock.affectedRows !== 1) throw new OutOfStockError(`Not enough stock for variant ${v.id}`);
        if (o.coupon) {
          // Guarded increment: a coupon limited to N uses can never be used N+1 times.
          const [used] = await conn.query<import("mysql2").ResultSetHeader>(
            "UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND active = 1 AND (usage_limit IS NULL OR used_count < usage_limit)",
            [o.coupon.id],
          );
          if (used.affectedRows !== 1) throw new CouponUsedUpError("Coupon used up");
        }

        const [res] = await conn.query<import("mysql2").ResultSetHeader>(
          `INSERT INTO orders (order_no, customer_id, name, phone, address, division_id, district_id, upazila_id, local_id, address_line,
                               zone, subtotal, delivery_fee, coupon_code, discount, total, cost_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderNo, o.customerId, o.name, o.phone, o.address, o.parts.divisionId, o.parts.districtId, o.parts.upazilaId, o.parts.localId,
           o.parts.line, o.zone, subtotal, o.deliveryFee, o.coupon?.code ?? null, discount, total, cost === null ? null : cost * o.qty],
        );
        await conn.query(
          `INSERT INTO order_items (order_id, product_slug, product_name, variant_index, variant_id, variant_label, unit_price, unit_cost, qty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [res.insertId, o.product.slug, o.product.name, o.variantIndex, v.id, v.label, v.price, cost, o.qty],
        );
        await conn.query("INSERT INTO order_events (order_id, status, note) VALUES (?, 'new', 'ওয়েবসাইট থেকে অর্ডার')", [res.insertId]);
        await conn.query("UPDATE customers SET name = ?, phone = ?, address = ?, address_parts = ? WHERE id = ?", [o.name, o.phone, o.address, JSON.stringify(o.parts), o.customerId]);
      });
      return { orderNo, subtotal, total };
    } catch (e) {
      // Retry only on a duplicate order number (extremely unlikely).
      if ((e as { code?: string }).code !== "ER_DUP_ENTRY") throw e;
    }
  }
  throw new Error("Could not allocate an order number");
}

// ---------- Delivery-history risk ----------

export type Risk = {
  level: "new" | "low" | "medium" | "high";
  label: string;
  delivered: number;
  returned: number;
  cancelled: number;
  open: number;
};

/**
 * Risk from this shop's own history for a phone number.
 * Courier-wide history (Steadfast, Pathao…) can be added later on top of this.
 */
export async function phoneRisk(phone: string, excludeOrderId?: number): Promise<Risk> {
  const r = await selectOne<{ delivered: number; returned: number; cancelled: number; open: number }>(
    `SELECT
       COALESCE(SUM(status = 'delivered'), 0) AS delivered,
       COALESCE(SUM(status = 'returned'), 0) AS returned,
       COALESCE(SUM(status = 'cancelled'), 0) AS cancelled,
       COALESCE(SUM(status IN ('new','confirmed','shipped')), 0) AS open
     FROM orders WHERE phone = ? AND id <> ?`,
    [phone, excludeOrderId ?? 0],
  );
  const h = { delivered: Number(r?.delivered ?? 0), returned: Number(r?.returned ?? 0), cancelled: Number(r?.cancelled ?? 0), open: Number(r?.open ?? 0) };
  const finished = h.delivered + h.returned;
  let level: Risk["level"];
  if (finished === 0) level = "new";
  else if (h.returned >= 2 || h.returned / finished >= 0.5) level = "high";
  else if (h.returned > 0) level = "medium";
  else level = "low";
  const label = { new: "নতুন ক্রেতা", low: "ঝুঁকি কম", medium: "ঝুঁকি মাঝারি", high: "ঝুঁকি বেশি" }[level];
  return { level, label, ...h };
}

// ---------- Listing and detail ----------

export const PAYMENT_METHODS = ["cod", "bkash", "nagad"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const paymentMethodLabel: Record<PaymentMethod, string> = { cod: "ক্যাশ অন ডেলিভারি", bkash: "বিকাশ", nagad: "নগদ" };

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded", "partial_refund"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const paymentStatusLabel: Record<PaymentStatus, string> = { unpaid: "বাকি", paid: "পরিশোধিত", refunded: "ফেরত দেওয়া", partial_refund: "আংশিক ফেরত" };

export type OrderRow = {
  id: number;
  order_no: string;
  customer_id: number;
  status: OrderStatus;
  name: string;
  phone: string;
  address: string;
  district_id: number | null;
  zone: DeliveryZone;
  subtotal: number;
  delivery_fee: number;
  coupon_code: string | null;
  discount: number;
  total: number;
  cost_total: number | null;
  note: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_amount: number | null;
  refund_amount: number | null;
  payment_ref: string | null;
  courier: string | null;
  tracking_no: string | null;
  created_at: Date;
  shipped_at: Date | null;
  delivered_at: Date | null;
  email: string;
  items: string;
};

const ORDER_SELECT = `
  SELECT o.id, o.order_no, o.customer_id, o.status, o.name, o.phone, o.address, o.district_id, o.zone, o.subtotal, o.delivery_fee,
         o.coupon_code, o.discount, o.total, o.cost_total, o.note, o.payment_method, o.payment_status, o.paid_amount, o.refund_amount, o.payment_ref,
         o.courier, o.tracking_no, o.created_at, o.shipped_at, o.delivered_at, c.email,
         (SELECT GROUP_CONCAT(CONCAT(i.product_name, ' · ', i.variant_label, ' × ', i.qty) SEPARATOR '\\n')
            FROM order_items i WHERE i.order_id = o.id) AS items
  FROM orders o JOIN customers c ON c.id = o.customer_id`;

/** Filters shared by the order list, CSV export and bulk actions. */
export type OrderFilter = {
  q?: string; // order no, name, phone or email
  status?: OrderStatus;
  payment?: PaymentStatus;
  districtId?: number;
  customerId?: number;
  from?: string; // Dhaka date YYYY-MM-DD, inclusive
  to?: string; // Dhaka date YYYY-MM-DD, inclusive
};

function whereFor(f: OrderFilter): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    where.push("(o.order_no LIKE ? OR o.name LIKE ? OR o.phone LIKE ? OR c.email LIKE ?)");
    params.push(like, like, like, like);
  }
  if (f.status) { where.push("o.status = ?"); params.push(f.status); }
  if (f.payment) { where.push("o.payment_status = ?"); params.push(f.payment); }
  if (f.districtId) { where.push("o.district_id = ?"); params.push(f.districtId); }
  if (f.customerId) { where.push("o.customer_id = ?"); params.push(f.customerId); }
  if (f.from) { where.push("o.created_at >= ?"); params.push(sqlUtc(dhakaDayStartUtc(f.from))); }
  if (f.to) { where.push("o.created_at < ?"); params.push(sqlUtc(dhakaDayStartUtc(addDays(f.to, 1)))); }
  return { sql: where.length ? " WHERE " + where.join(" AND ") : "", params };
}

export const PAGE_SIZE = 50;

/** One page of orders (newest first) plus the total count for pagination. */
export async function listOrders(f: OrderFilter = {}, page = 1, pageSize = PAGE_SIZE): Promise<{ rows: OrderRow[]; total: number }> {
  const w = whereFor(f);
  const [rows, count] = await Promise.all([
    select<OrderRow>(`${ORDER_SELECT}${w.sql} ORDER BY o.id DESC LIMIT ? OFFSET ?`, [...w.params, pageSize, (Math.max(page, 1) - 1) * pageSize]),
    selectOne<{ n: number }>(`SELECT COUNT(*) AS n FROM orders o JOIN customers c ON c.id = o.customer_id${w.sql}`, w.params),
  ]);
  return { rows, total: Number(count?.n ?? 0) };
}

/** All matching orders for CSV export (capped to keep memory bounded). */
export async function exportOrders(f: OrderFilter, cap = 5000): Promise<OrderRow[]> {
  const w = whereFor(f);
  return select<OrderRow>(`${ORDER_SELECT}${w.sql} ORDER BY o.id DESC LIMIT ?`, [...w.params, cap]);
}

export async function customerOrders(customerId: number): Promise<OrderRow[]> {
  return select<OrderRow>(`${ORDER_SELECT} WHERE o.customer_id = ? ORDER BY o.id DESC LIMIT 50`, [customerId]);
}

/** Courier and tracking number. Returns true when the order exists. */
export async function setShipping(orderNo: string, courier: string | null, trackingNo: string | null): Promise<boolean> {
  const r = await execute("UPDATE orders SET courier = ?, tracking_no = ? WHERE order_no = ?", [courier, trackingNo, orderNo]);
  return r.affectedRows === 1;
}

export async function setPayment(
  orderNo: string,
  p: { method: PaymentMethod; status: PaymentStatus; paid: number | null; refund: number | null; ref: string | null },
): Promise<boolean> {
  const r = await execute(
    "UPDATE orders SET payment_method = ?, payment_status = ?, paid_amount = ?, refund_amount = ?, payment_ref = ? WHERE order_no = ?",
    [p.method, p.status, p.paid, p.refund, p.ref, orderNo],
  );
  return r.affectedRows === 1;
}

/** Marks that the shipping email went out, so it's only sent once. */
export async function markShippedEmail(orderNo: string): Promise<void> {
  await execute("UPDATE orders SET shipped_email_at = UTC_TIMESTAMP() WHERE order_no = ?", [orderNo]);
}

export async function shippedEmailSent(orderNo: string): Promise<boolean> {
  const r = await selectOne<{ at: Date | null }>("SELECT shipped_email_at AS at FROM orders WHERE order_no = ?", [orderNo]);
  return Boolean(r?.at);
}

export async function getOrder(orderNo: string): Promise<OrderRow | null> {
  return selectOne<OrderRow>(`${ORDER_SELECT} WHERE o.order_no = ?`, [orderNo]);
}

export async function orderEvents(orderId: number) {
  return select<{ status: string; note: string | null; by_email: string | null; created_at: Date }>(
    "SELECT status, note, by_email, created_at FROM order_events WHERE order_id = ? ORDER BY id DESC",
    [orderId],
  );
}

export async function statusCounts(): Promise<Record<string, number>> {
  const rows = await select<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM orders GROUP BY status");
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

const STAMP: Partial<Record<OrderStatus, string>> = {
  shipped: "shipped_at",
  delivered: "delivered_at",
  returned: "returned_at",
  cancelled: "cancelled_at",
};

/**
 * Changes an order's status and logs it. Cancelling an order that hasn't been
 * shipped yet puts its tracked stock back.
 */
export async function setStatus(orderNo: string, status: OrderStatus, note: string | null, byEmail: string): Promise<boolean> {
  const order = await selectOne<{ id: number; status: OrderStatus }>("SELECT id, status FROM orders WHERE order_no = ?", [orderNo]);
  if (!order) return false;
  if (order.status === status) return true;
  const stamp = STAMP[status];
  const markPaid = status === "delivered";
  const restock = status === "cancelled" && (order.status === "new" || order.status === "confirmed");
  await transaction(async (conn) => {
    if (restock) {
      // Give the coupon use back too.
      await conn.query(
        "UPDATE coupons c JOIN orders o ON o.coupon_code = c.code SET c.used_count = GREATEST(c.used_count - 1, 0) WHERE o.id = ?",
        [order.id],
      );
      await conn.query(
        `UPDATE product_variants v JOIN order_items i ON i.variant_id = v.id
         SET v.stock = v.stock + i.qty WHERE i.order_id = ? AND v.stock IS NOT NULL`,
        [order.id],
      );
    }
    await conn.query(
      `UPDATE orders SET status = ?${stamp ? `, ${stamp} = COALESCE(${stamp}, UTC_TIMESTAMP())` : ""}${
        markPaid ? ", payment_status = IF(payment_status = 'unpaid', 'paid', payment_status), paid_amount = COALESCE(paid_amount, total)" : ""
      } WHERE id = ?`,
      [status, order.id],
    );
    await conn.query("INSERT INTO order_events (order_id, status, note, by_email) VALUES (?, ?, ?, ?)", [order.id, status, note, byEmail]);
  });
  return true;
}

export async function setNote(orderNo: string, note: string): Promise<void> {
  await execute("UPDATE orders SET note = ? WHERE order_no = ?", [note || null, orderNo]);
}

// ---------- Costs, settings, expenses ----------

export const SETTING_KEYS = ["courier_cost_dhaka", "courier_cost_outside", "packing_cost"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export async function getSettings(): Promise<Record<SettingKey, number>> {
  const rows = await select<{ name: string; value: string }>("SELECT name, value FROM settings");
  const m = Object.fromEntries(rows.map((r) => [r.name, Number(r.value) || 0]));
  return { courier_cost_dhaka: m.courier_cost_dhaka ?? 0, courier_cost_outside: m.courier_cost_outside ?? 0, packing_cost: m.packing_cost ?? 0 };
}

export async function saveSetting(name: SettingKey, value: number): Promise<void> {
  await execute("INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [name, String(value)]);
}

export type Expense = { id: number; spent_on: string; category: string; amount: number; note: string | null };

export async function listExpenses(from: string, to: string): Promise<Expense[]> {
  return select<Expense>(
    "SELECT id, DATE_FORMAT(spent_on, '%Y-%m-%d') AS spent_on, category, amount, note FROM expenses WHERE spent_on BETWEEN ? AND ? ORDER BY spent_on DESC, id DESC",
    [from, to],
  );
}

export async function addExpense(e: { spentOn: string; category: string; amount: number; note: string | null }): Promise<void> {
  await execute("INSERT INTO expenses (spent_on, category, amount, note) VALUES (?, ?, ?, ?)", [e.spentOn, e.category, e.amount, e.note]);
}

export async function deleteExpense(id: number): Promise<void> {
  await execute("DELETE FROM expenses WHERE id = ?", [id]);
}
