// Coupons: validation, discount calculation and admin CRUD. Server-only.
// The same evaluateCoupon() is used for the checkout preview and the final
// order, so the customer never sees one price and pays another.
import { execute, select, selectOne } from "./db";

export const COUPON_TYPES = ["percent", "fixed", "free_shipping"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];
export const couponTypeLabel: Record<CouponType, string> = { percent: "শতাংশ ছাড়", fixed: "নির্দিষ্ট টাকা ছাড়", free_shipping: "ফ্রি ডেলিভারি" };

export type Coupon = {
  id: number;
  code: string;
  type: CouponType;
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  starts_at: Date | null;
  ends_at: Date | null;
  usage_limit: number | null;
  per_customer: number;
  used_count: number;
  active: number;
  note: string | null;
  created_at: Date;
};

/** Codes are case-insensitive: stored and compared upper-case, letters/digits/-/_ only. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,30}$/.test(c) ? c : null;
}

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number; message: string }
  | { ok: false; message: string };

/**
 * Checks a code against the order and returns the discount in taka.
 * `customerId` (when known) enforces the per-customer limit.
 */
export async function evaluateCoupon(rawCode: unknown, o: { subtotal: number; deliveryFee: number; customerId: number | null }): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, message: "কুপন কোডটি সঠিক নয়।" };
  const c = await selectOne<Coupon & { started: number; ended: number }>(
    `SELECT *, (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP()) AS started, (ends_at IS NOT NULL AND ends_at < UTC_TIMESTAMP()) AS ended
     FROM coupons WHERE code = ?`,
    [code],
  );
  if (!c || !c.active) return { ok: false, message: "এই কুপন কোড পাওয়া যায়নি।" };
  if (!Number(c.started)) return { ok: false, message: "এই কুপন এখনো চালু হয়নি।" };
  if (Number(c.ended)) return { ok: false, message: "এই কুপনের মেয়াদ শেষ।" };
  if (c.usage_limit !== null && c.used_count >= c.usage_limit) return { ok: false, message: "এই কুপন আর ব্যবহার করা যাবে না।" };
  if (o.subtotal < c.min_subtotal) return { ok: false, message: `এই কুপনের জন্য কমপক্ষে ৳${c.min_subtotal} কেনাকাটা করতে হবে।` };
  if (o.customerId !== null) {
    const used = await selectOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND coupon_code = ? AND status <> 'cancelled'",
      [o.customerId, code],
    );
    if (Number(used?.n ?? 0) >= c.per_customer) return { ok: false, message: "আপনি এই কুপন আগেই ব্যবহার করেছেন।" };
  }
  let discount = 0;
  if (c.type === "percent") discount = Math.floor((o.subtotal * c.value) / 100);
  else if (c.type === "fixed") discount = c.value;
  else discount = o.deliveryFee;
  if (c.type === "percent" && c.max_discount !== null) discount = Math.min(discount, c.max_discount);
  discount = Math.max(0, Math.min(discount, c.type === "free_shipping" ? o.deliveryFee : o.subtotal));
  const message = c.type === "free_shipping" ? "কুপন কাজ করেছে: ডেলিভারি ফ্রি।" : `কুপন কাজ করেছে: ৳${discount} ছাড়।`;
  return { ok: true, coupon: c, discount, message };
}

// ---------- Admin ----------

export async function listCoupons(): Promise<Coupon[]> {
  return select<Coupon>("SELECT * FROM coupons ORDER BY active DESC, id DESC");
}

export type CouponInput = {
  code: string;
  type: CouponType;
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  perCustomer: number;
  active: boolean;
  note: string | null;
};

export async function saveCoupon(id: number | null, c: CouponInput): Promise<number> {
  const v = [c.code, c.type, c.value, c.minSubtotal, c.maxDiscount, c.startsAt, c.endsAt, c.usageLimit, c.perCustomer, c.active ? 1 : 0, c.note];
  if (id === null) {
    const r = await execute(
      `INSERT INTO coupons (code, type, value, min_subtotal, max_discount, starts_at, ends_at, usage_limit, per_customer, active, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      v,
    );
    return r.insertId;
  }
  await execute(
    `UPDATE coupons SET code = ?, type = ?, value = ?, min_subtotal = ?, max_discount = ?, starts_at = ?, ends_at = ?, usage_limit = ?,
            per_customer = ?, active = ?, note = ? WHERE id = ?`,
    [...v, id],
  );
  return id;
}

/** Orders and discount given per coupon, for the admin list. */
export async function couponStats(): Promise<Map<string, { orders: number; discount: number }>> {
  const rows = await select<{ code: string; orders: number; discount: number }>(
    "SELECT coupon_code AS code, COUNT(*) AS orders, SUM(discount) AS discount FROM orders WHERE coupon_code IS NOT NULL AND status <> 'cancelled' GROUP BY coupon_code",
  );
  return new Map(rows.map((r) => [r.code, { orders: Number(r.orders), discount: Number(r.discount) }]));
}
