// Orders, delivery-history risk, costs and settings. Server-only.
import { execute, select, selectOne, transaction } from "./db";
import { newOrderNo } from "./mailer";
import type { Product } from "./products";
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
  product: Product;
  variantIndex: number;
  qty: number;
  zone: DeliveryZone;
  deliveryFee: number;
  name: string;
  phone: string;
  address: string;
};

export async function unitCost(slug: string, variantIndex: number): Promise<number | null> {
  const r = await selectOne<{ unit_cost: number }>(
    "SELECT unit_cost FROM product_costs WHERE product_slug = ? AND variant_index = ?",
    [slug, variantIndex],
  );
  return r ? r.unit_cost : null;
}

/** Saves the order and its item in one transaction. Returns the order number. */
export async function createOrder(o: NewOrder): Promise<{ orderNo: string; subtotal: number; total: number }> {
  const v = o.product.variants[o.variantIndex];
  const subtotal = v.price * o.qty;
  const total = subtotal + o.deliveryFee;
  const cost = await unitCost(o.product.slug, o.variantIndex);

  for (let attempt = 0; attempt < 3; attempt++) {
    const orderNo = newOrderNo();
    try {
      await transaction(async (conn) => {
        const [res] = await conn.query<import("mysql2").ResultSetHeader>(
          `INSERT INTO orders (order_no, customer_id, name, phone, address, zone, subtotal, delivery_fee, total, cost_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderNo, o.customerId, o.name, o.phone, o.address, o.zone, subtotal, o.deliveryFee, total, cost === null ? null : cost * o.qty],
        );
        await conn.query(
          `INSERT INTO order_items (order_id, product_slug, product_name, variant_index, variant_label, unit_price, unit_cost, qty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [res.insertId, o.product.slug, o.product.name, o.variantIndex, v.label, v.price, cost, o.qty],
        );
        await conn.query("INSERT INTO order_events (order_id, status, note) VALUES (?, 'new', 'ওয়েবসাইট থেকে অর্ডার')", [res.insertId]);
        // Remember contact details for the next order.
        await conn.query("UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?", [o.name, o.phone, o.address, o.customerId]);
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

export type OrderRow = {
  id: number;
  order_no: string;
  status: OrderStatus;
  name: string;
  phone: string;
  address: string;
  zone: DeliveryZone;
  subtotal: number;
  delivery_fee: number;
  total: number;
  cost_total: number | null;
  note: string | null;
  created_at: Date;
  delivered_at: Date | null;
  email: string;
  items: string;
};

const ORDER_SELECT = `
  SELECT o.id, o.order_no, o.status, o.name, o.phone, o.address, o.zone, o.subtotal, o.delivery_fee, o.total,
         o.cost_total, o.note, o.created_at, o.delivered_at, c.email,
         (SELECT GROUP_CONCAT(CONCAT(i.product_name, ' · ', i.variant_label, ' × ', i.qty) SEPARATOR '\\n')
            FROM order_items i WHERE i.order_id = o.id) AS items
  FROM orders o JOIN customers c ON c.id = o.customer_id`;

export async function listOrders(status: OrderStatus | "all", limit = 100): Promise<OrderRow[]> {
  return status === "all"
    ? select<OrderRow>(`${ORDER_SELECT} ORDER BY o.id DESC LIMIT ?`, [limit])
    : select<OrderRow>(`${ORDER_SELECT} WHERE o.status = ? ORDER BY o.id DESC LIMIT ?`, [status, limit]);
}

export async function customerOrders(customerId: number): Promise<OrderRow[]> {
  return select<OrderRow>(`${ORDER_SELECT} WHERE o.customer_id = ? ORDER BY o.id DESC LIMIT 50`, [customerId]);
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

export async function setStatus(orderNo: string, status: OrderStatus, note: string | null, byEmail: string): Promise<boolean> {
  const order = await selectOne<{ id: number }>("SELECT id FROM orders WHERE order_no = ?", [orderNo]);
  if (!order) return false;
  const stamp = STAMP[status];
  await transaction(async (conn) => {
    await conn.query(
      `UPDATE orders SET status = ?${stamp ? `, ${stamp} = COALESCE(${stamp}, UTC_TIMESTAMP())` : ""} WHERE id = ?`,
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

export async function allCosts(): Promise<Map<string, number>> {
  const rows = await select<{ product_slug: string; variant_index: number; unit_cost: number }>(
    "SELECT product_slug, variant_index, unit_cost FROM product_costs",
  );
  return new Map(rows.map((r) => [`${r.product_slug}:${r.variant_index}`, r.unit_cost]));
}

export async function saveCost(slug: string, variantIndex: number, unitCost: number | null): Promise<void> {
  if (unitCost === null) {
    await execute("DELETE FROM product_costs WHERE product_slug = ? AND variant_index = ?", [slug, variantIndex]);
  } else {
    await execute(
      "INSERT INTO product_costs (product_slug, variant_index, unit_cost) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE unit_cost = VALUES(unit_cost)",
      [slug, variantIndex, unitCost],
    );
  }
}

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
