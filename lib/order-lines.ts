// Turns what the browser sent ({slug, variant, qty} lines) into checked order
// lines with fresh database prices. Shared by /api/order and /api/coupon.
// Server-only.
import { loadOrderable } from "./catalog";
import type { OrderLine } from "./orders";
import type { DeliveryZone } from "./site";

export type RawLine = { slug: string; variant: number; qty: number };

export const MAX_LINES = 20;
export const MAX_QTY = 20;

/**
 * Reads `items: [{slug, variant, qty}]`, or the older single-product fields
 * `slug, variant, qty`. Same product + size twice is merged. Returns an error
 * message (Bangla) for bad shapes.
 */
export function parseLines(body: Record<string, unknown>): { ok: true; lines: RawLine[] } | { ok: false; message: string } {
  const raw = Array.isArray(body.items) ? body.items : [{ slug: body.slug, variant: body.variant, qty: body.qty }];
  if (raw.length === 0) return { ok: false, message: "কার্ট খালি।" };
  if (raw.length > MAX_LINES) return { ok: false, message: `একবারে সর্বোচ্চ ${MAX_LINES.toLocaleString("bn-BD")} ধরনের পণ্য অর্ডার করা যায়।` };
  const merged = new Map<string, RawLine>();
  for (const r of raw) {
    const o = (r ?? {}) as Record<string, unknown>;
    const slug = typeof o.slug === "string" ? o.slug.trim() : "";
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { ok: false, message: "পণ্যটি খুঁজে পাওয়া যায়নি।" };
    const variant = Number(o.variant);
    if (!Number.isInteger(variant) || variant < 0 || variant > 50) return { ok: false, message: "পরিমাণটি সঠিক নয়।" };
    const qty = Number(o.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { ok: false, message: "সংখ্যা ১ থেকে ২০-এর মধ্যে দিন।" };
    const key = `${slug}:${variant}`;
    const prev = merged.get(key);
    const total = (prev?.qty ?? 0) + qty;
    if (total > MAX_QTY) return { ok: false, message: "একই পণ্য সর্বোচ্চ ২০টি অর্ডার করা যায়।" };
    merged.set(key, { slug, variant, qty: total });
  }
  return { ok: true, lines: [...merged.values()] };
}

/**
 * Loads each product fresh from the database and checks size, stock and
 * (when `zone` is given) delivery zone. Returns the first problem as a message.
 */
export async function loadLines(raw: RawLine[], zone?: DeliveryZone): Promise<{ ok: true; lines: OrderLine[] } | { ok: false; message: string }> {
  const slugs = [...new Set(raw.map((r) => r.slug))];
  const products = new Map((await Promise.all(slugs.map(async (s) => [s, await loadOrderable(s)] as const))));
  const lines: OrderLine[] = [];
  for (const r of raw) {
    const product = products.get(r.slug);
    if (!product) return { ok: false, message: "একটি পণ্য এখন পাওয়া যাচ্ছে না। কার্ট থেকে সরিয়ে আবার চেষ্টা করুন।" };
    const v = product.variants[r.variant];
    if (!v) return { ok: false, message: `${product.name}: পরিমাণটি সঠিক নয়। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।` };
    if (v.stock !== null && v.stock < r.qty) {
      return { ok: false, message: v.stock > 0 ? `${product.name} (${v.label}): মাত্র ${v.stock}টি আছে।` : `${product.name} (${v.label}) এখন স্টকে নেই।` };
    }
    if (zone && !product.zones.includes(zone)) return { ok: false, message: `${product.name} এখন শুধু ঢাকার ভেতরে ডেলিভারি হয়।` };
    lines.push({ product, variantIndex: r.variant, qty: r.qty });
  }
  return { ok: true, lines };
}
