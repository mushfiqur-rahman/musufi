// Coupon preview for the order form. Prices and fees are computed here from the
// database, never taken from the browser; the order API checks the coupon again.
import { serverTrouble } from "@/lib/api";
import { currentCustomer } from "@/lib/auth";
import { loadOrderable } from "@/lib/catalog";
import { evaluateCoupon } from "@/lib/coupons";
import { dbConfigured } from "@/lib/db";
import { deliveryFee, zoneFor } from "@/lib/store-config";
import { loadStoreSettingsFresh } from "@/lib/store-settings";

// Small in-memory limit against code guessing: 20 checks per IP per 10 minutes.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 600_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 20;
}

export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ ok: false, message: "কুপন এখন যাচাই করা যাচ্ছে না।" }, { status: 503 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return Response.json({ ok: false, message: "অনেকবার চেষ্টা হয়েছে। একটু পরে আবার চেষ্টা করুন।" }, { status: 429 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = typeof b?.slug === "string" ? b.slug : "";
  const variant = Number(b?.variant);
  const qty = Number(b?.qty);
  const districtId = Number(b?.districtId);
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !Number.isInteger(variant) || !Number.isInteger(qty) || qty < 1 || qty > 20) {
    return Response.json({ ok: false, message: "তথ্য সঠিক নয়।" }, { status: 400 });
  }
  try {
    const [product, settings, me] = await Promise.all([loadOrderable(slug), loadStoreSettingsFresh(), currentCustomer().catch(() => null)]);
    const v = product?.variants[variant];
    if (!v) return Response.json({ ok: false, message: "পণ্যটি পাওয়া যায়নি।" }, { status: 404 });
    const subtotal = v.price * qty;
    const fee = Number.isInteger(districtId) && districtId > 0 ? deliveryFee(settings, zoneFor(settings, districtId), subtotal) : 0;
    const r = await evaluateCoupon(b?.code, { subtotal, deliveryFee: fee, customerId: me?.id ?? null });
    return Response.json(r.ok ? { ok: true, discount: r.discount, freeShipping: r.coupon.type === "free_shipping", message: r.message } : r);
  } catch (e) {
    return serverTrouble("coupon", e);
  }
}
