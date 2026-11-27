import { getCategory, getProduct } from "@/lib/products";
import { mailConfigured, newOrderNo, sendOrderAlert } from "@/lib/mailer";
import { site, type DeliveryZone } from "@/lib/site";

const BD_MOBILE = /^01[3-9]\d{8}$/;

type OrderInput = {
  slug: string;
  variant: number;
  qty: number;
  zone: DeliveryZone;
  name: string;
  phone: string;
  address: string;
};

function validate(body: unknown): { ok: true; order: OrderInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "অর্ডারের তথ্য পাওয়া যায়নি।" };
  const b = body as Record<string, unknown>;
  const product = typeof b.slug === "string" ? getProduct(b.slug) : undefined;
  if (!product) return { ok: false, message: "পণ্যটি খুঁজে পাওয়া যায়নি।" };
  const variant = Number(b.variant);
  if (!Number.isInteger(variant) || !product.variants[variant]) return { ok: false, message: "পরিমাণটি সঠিক নয়।" };
  const qty = Number(b.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { ok: false, message: "সংখ্যা ১ থেকে ২০-এর মধ্যে দিন।" };
  if (b.zone !== "dhaka" && b.zone !== "outside") return { ok: false, message: "ডেলিভারি এলাকা বেছে নিন।" };
  if (!getCategory(product.category).zones.includes(b.zone)) return { ok: false, message: "এই পণ্য এখন শুধু ঢাকার ভেতরে ডেলিভারি হয়।" };
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  const address = typeof b.address === "string" ? b.address.trim() : "";
  if (name.length < 2 || name.length > 80) return { ok: false, message: "আপনার নাম দিন।" };
  if (!BD_MOBILE.test(phone)) return { ok: false, message: "১১ সংখ্যার মোবাইল নম্বর দিন।" };
  if (address.length < 10 || address.length > 300) return { ok: false, message: "পুরো ঠিকানা দিন।" };
  return { ok: true, order: { slug: product.slug, variant, qty, zone: b.zone, name, phone, address } };
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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (tooMany(ip)) {
    return Response.json({ message: `অল্প সময়ে অনেক অর্ডার এসেছে। একটু পরে চেষ্টা করুন, অথবা ${FALLBACK}` }, { status: 429 });
  }

  // Until the database exists, an order is "received" only when the alert email
  // is accepted by the mail server. Otherwise refuse honestly instead of losing it.
  if (!mailConfigured()) {
    return Response.json({ message: `অনলাইন অর্ডার এখনো চালু হয়নি। ${FALLBACK}` }, { status: 503 });
  }

  // Prices are always recalculated on the server, never trusted from the browser.
  const o = result.order;
  const product = getProduct(o.slug)!;
  const v = product.variants[o.variant];
  const zone = site.delivery[o.zone];
  const orderNo = newOrderNo();

  try {
    await sendOrderAlert({
      orderNo,
      productName: product.name,
      variantLabel: v.label,
      unitPrice: v.price,
      qty: o.qty,
      zoneLabel: zone.label,
      deliveryFee: zone.fee,
      total: v.price * o.qty + zone.fee,
      name: o.name,
      phone: o.phone,
      address: o.address,
      placedAt: new Date(),
    });
  } catch (err) {
    console.error(`[order] alert email failed for ${orderNo}:`, err instanceof Error ? err.message : err);
    return Response.json({ message: `অর্ডার পাঠানো যায়নি। ${FALLBACK}` }, { status: 502 });
  }

  // TODO (backend): require a signed-in customer, save the order in MySQL,
  // and run the courier history check.
  return Response.json({
    orderNo,
    message: `অর্ডার পাওয়া গেছে। অর্ডার নম্বর ${orderNo}। আমরা শিগগিরই ${o.phone} নম্বরে ফোন করে নিশ্চিত করব।`,
  });
}
