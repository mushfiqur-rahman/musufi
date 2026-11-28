// Places an order: one product (product page) or several (cart).
// Everything that matters is checked again here, never trusted from the browser:
// login, prices, stock, delivery zone, delivery fee and coupon.
import { clientIp, currentCustomer } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { mailConfigured, sendOrderAlert, sendOrderConfirmation, smtpReady } from "@/lib/mailer";
import { evaluateCoupon } from "@/lib/coupons";
import { CouponUsedUpError, createOrder, linesSubtotal, OutOfStockError } from "@/lib/orders";
import { loadLines, parseLines, type RawLine } from "@/lib/order-lines";
import { serverTrouble } from "@/lib/api";
import { type AddressParts } from "@/lib/geo";
import { BD_MOBILE, parseAddress } from "@/lib/address";
import { deliveryFee, zoneFor } from "@/lib/store-config";
import { loadStoreSettingsFresh } from "@/lib/store-settings";

type OrderInput = {
  lines: RawLine[];
  name: string;
  phone: string;
  /** Full line for couriers and emails. */
  address: string;
  parts: AddressParts;
};

/** Checks the request's shape. Products, stock and zone are checked later against the database. */
function validate(body: unknown): { ok: true; order: OrderInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "অর্ডারের তথ্য পাওয়া যায়নি।" };
  const b = body as Record<string, unknown>;
  const lines = parseLines(b);
  if (!lines.ok) return lines;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  if (name.length < 2 || name.length > 80) return { ok: false, message: "আপনার নাম দিন।" };
  if (!BD_MOBILE.test(phone)) return { ok: false, message: "১১ সংখ্যার মোবাইল নম্বর দিন।" };
  const addr = parseAddress(b.address);
  if (!addr.ok) return addr;
  return { ok: true, order: { lines: lines.lines, name, phone, address: addr.line, parts: addr.parts } };
}

// Simple spam guard: at most 5 orders per 10 minutes from one IP address.
// In-memory, so it resets when the server restarts; enough for a small shop.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > MAX_PER_WINDOW;
}

const FALLBACK = "দয়া করে হোয়াটসঅ্যাপে বা ফোনে অর্ডার করুন।";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // Honeypot: a hidden field real customers never fill. Bots get a fake success.
  if (body && typeof body === "object" && (body as Record<string, unknown>).website) {
    return Response.json({ message: "অর্ডার পাওয়া গেছে।" });
  }

  const result = validate(body);
  if (!result.ok) return Response.json({ message: result.message }, { status: 400 });

  if (!dbConfigured()) {
    return Response.json({ message: `অনলাইন অর্ডার এখনো চালু হয়নি। ${FALLBACK}` }, { status: 503 });
  }

  // An account is required to order. The form logs the customer in first.
  let customer;
  try {
    customer = await currentCustomer();
  } catch (e) {
    return serverTrouble("order-session", e);
  }
  if (!customer) {
    return Response.json({ needLogin: true, message: "অর্ডার করতে ইমেইল দিয়ে লগইন করুন।" }, { status: 401 });
  }

  if (tooMany(clientIp(request))) {
    return Response.json({ message: `অল্প সময়ে অনেক অর্ডার এসেছে। একটু পরে চেষ্টা করুন, অথবা ${FALLBACK}` }, { status: 429 });
  }

  // Prices, stock and zones come fresh from the database, never from the browser.
  const o = result.order;
  let settings;
  let checked;
  let zone;
  try {
    settings = await loadStoreSettingsFresh();
    // Zone from the district list in settings (which districts count as "inside Dhaka").
    zone = zoneFor(settings, o.parts.districtId);
    checked = await loadLines(o.lines, zone);
  } catch (e) {
    return serverTrouble("order-product", e);
  }
  if (!checked.ok) return Response.json({ message: checked.message }, { status: 409 });
  const lines = checked.lines;
  const subtotal = linesSubtotal(lines);
  const fee = deliveryFee(settings, zone, subtotal);

  // Coupon: checked again here (never trust the preview). A bad code stops the order
  // with a clear message instead of silently charging the full price.
  let coupon: { id: number; code: string; discount: number } | undefined;
  const rawCoupon = (body as Record<string, unknown>).coupon;
  if (typeof rawCoupon === "string" && rawCoupon.trim()) {
    const c = await evaluateCoupon(rawCoupon, { subtotal, deliveryFee: fee, customerId: customer.id });
    if (!c.ok) return Response.json({ message: c.message, field: "coupon" }, { status: 409 });
    coupon = { id: c.coupon.id, code: c.coupon.code, discount: c.discount };
  }

  let saved: { orderNo: string; total: number };
  try {
    saved = await createOrder({
      customerId: customer.id,
      lines,
      zone,
      deliveryFee: fee,
      name: o.name,
      phone: o.phone,
      address: o.address,
      parts: o.parts,
      coupon,
    });
  } catch (err) {
    if (err instanceof CouponUsedUpError) {
      return Response.json({ message: "দুঃখিত, এই কুপনের সব ব্যবহার শেষ হয়ে গেছে। কুপন ছাড়া আবার চেষ্টা করুন।", field: "coupon" }, { status: 409 });
    }
    if (err instanceof OutOfStockError) {
      return Response.json({ message: "দুঃখিত, এইমাত্র একটি পণ্যের স্টক শেষ হয়ে গেছে। কার্ট দেখে আবার চেষ্টা করুন।" }, { status: 409 });
    }
    return serverTrouble("order-save", err);
  }

  // The order is saved, so email problems are logged but do not fail the order.
  const alert = {
    orderNo: saved.orderNo,
    items: lines.map((l) => {
      const v = l.product.variants[l.variantIndex];
      return { productName: l.product.name, variantLabel: v.label, unitPrice: v.price, qty: l.qty };
    }),
    discount: coupon?.discount ?? 0,
    zoneLabel: settings.delivery[zone].label,
    deliveryFee: fee,
    total: saved.total,
    name: o.name,
    phone: o.phone,
    address: o.address,
    placedAt: new Date(),
  };
  const mails: Promise<void>[] = [];
  if (mailConfigured()) mails.push(sendOrderAlert(alert));
  if (smtpReady()) mails.push(sendOrderConfirmation(customer.email, alert));
  const results = await Promise.allSettled(mails);
  for (const r of results) {
    if (r.status === "rejected") console.error(`[order] email failed for ${saved.orderNo}:`, r.reason instanceof Error ? r.reason.message : r.reason);
  }

  return Response.json({
    orderNo: saved.orderNo,
    message: `অর্ডার পাওয়া গেছে। অর্ডার নম্বর ${saved.orderNo}। আমরা শিগগিরই ${o.phone} নম্বরে ফোন করে নিশ্চিত করব।`,
  });
}
