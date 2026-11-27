import { loadOrderable, type Orderable } from "@/lib/catalog";
import { clientIp, currentCustomer } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { mailConfigured, sendOrderAlert, sendOrderConfirmation, smtpReady } from "@/lib/mailer";
import { createOrder, OutOfStockError } from "@/lib/orders";
import { serverTrouble } from "@/lib/api";
import { findDistrict, findDivision, findUpazila, formatAddress, localLabel, zoneForDistrict, type AddressParts } from "@/lib/geo";
import { findUnion } from "@/lib/geo-unions";
import { site, type DeliveryZone } from "@/lib/site";

const BD_MOBILE = /^01[3-9]\d{8}$/;

type OrderInput = {
  slug: string;
  variant: number;
  qty: number;
  /** Worked out from the district, never taken from the browser. */
  zone: DeliveryZone;
  name: string;
  phone: string;
  /** Full line for couriers and emails. */
  address: string;
  parts: AddressParts;
};

/** Validates the chosen areas against the official list and builds the address line. */
function parseAddress(v: unknown): { ok: true; parts: AddressParts; line: string } | { ok: false; message: string } {
  if (!v || typeof v !== "object") return { ok: false, message: "ঠিকানা দিন।" };
  const a = v as Record<string, unknown>;
  const division = findDivision(Number(a.divisionId));
  const district = findDistrict(Number(a.districtId));
  const upazila = findUpazila(Number(a.upazilaId));
  if (!division) return { ok: false, message: "বিভাগ বেছে নিন।" };
  if (!district || district.divisionId !== division.id) return { ok: false, message: "জেলা বেছে নিন।" };
  if (!upazila || upazila.districtId !== district.id) return { ok: false, message: "উপজেলা বা থানা বেছে নিন।" };
  const line = typeof a.line === "string" ? a.line.trim() : "";
  if (line.length < 5 || line.length > 200) return { ok: false, message: "গ্রাম/এলাকা, রাস্তা আর বাসার নম্বর লিখুন।" };
  let localId: number | null = null;
  let local = "";
  if (a.localId !== null && a.localId !== undefined && a.localId !== "") {
    const n = Number(a.localId);
    if (upazila.city) {
      if (!Number.isInteger(n) || !upazila.postOffices[n]) return { ok: false, message: "পোস্ট অফিস আবার বেছে নিন।" };
      localId = n;
      local = localLabel(upazila, n);
    } else {
      const union = Number.isInteger(n) ? findUnion(upazila.id, n) : undefined;
      if (!union) return { ok: false, message: "ইউনিয়ন আবার বেছে নিন।" };
      localId = n;
      local = `${union.bn} ইউনিয়ন`;
    }
  }
  return {
    ok: true,
    parts: { divisionId: division.id, districtId: district.id, upazilaId: upazila.id, localId, line },
    line: formatAddress({ line, local, upazila, district, division }),
  };
}

/** Checks the request's shape. Product, size, stock and zone are checked later against the database. */
function validate(body: unknown): { ok: true; order: OrderInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "অর্ডারের তথ্য পাওয়া যায়নি।" };
  const b = body as Record<string, unknown>;
  const slug = typeof b.slug === "string" ? b.slug.trim() : "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { ok: false, message: "পণ্যটি খুঁজে পাওয়া যায়নি।" };
  const variant = Number(b.variant);
  if (!Number.isInteger(variant) || variant < 0 || variant > 50) return { ok: false, message: "পরিমাণটি সঠিক নয়।" };
  const qty = Number(b.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { ok: false, message: "সংখ্যা ১ থেকে ২০-এর মধ্যে দিন।" };
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : "";
  if (name.length < 2 || name.length > 80) return { ok: false, message: "আপনার নাম দিন।" };
  if (!BD_MOBILE.test(phone)) return { ok: false, message: "১১ সংখ্যার মোবাইল নম্বর দিন।" };
  const addr = parseAddress(b.address);
  if (!addr.ok) return addr;
  return { ok: true, order: { slug, variant, qty, zone: zoneForDistrict(addr.parts.districtId), name, phone, address: addr.line, parts: addr.parts } };
}

/** Product rules against the live database row. */
function checkProduct(product: Orderable | null, o: OrderInput): string | null {
  if (!product) return "পণ্যটি এখন পাওয়া যাচ্ছে না।";
  const v = product.variants[o.variant];
  if (!v) return "পরিমাণটি সঠিক নয়। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।";
  if (v.stock !== null && v.stock < o.qty) return v.stock > 0 ? `এই সাইজের মাত্র ${v.stock}টি আছে।` : "এই সাইজ এখন স্টকে নেই।";
  if (!product.zones.includes(o.zone)) return "এই পণ্য এখন শুধু ঢাকার ভেতরে ডেলিভারি হয়।";
  return null;
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

  // An account is required to order. The form logs the customer in by email code first.
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
  let product: Orderable | null;
  try {
    product = await loadOrderable(o.slug);
  } catch (e) {
    return serverTrouble("order-product", e);
  }
  const problem = checkProduct(product, o);
  if (problem || !product) return Response.json({ message: problem }, { status: 409 });
  const v = product.variants[o.variant];
  const zone = site.delivery[o.zone];

  let saved: { orderNo: string; total: number };
  try {
    saved = await createOrder({
      customerId: customer.id,
      product,
      variantIndex: o.variant,
      qty: o.qty,
      zone: o.zone,
      deliveryFee: zone.fee,
      name: o.name,
      phone: o.phone,
      address: o.address,
      parts: o.parts,
    });
  } catch (err) {
    if (err instanceof OutOfStockError) {
      return Response.json({ message: "দুঃখিত, এইমাত্র এই সাইজের স্টক শেষ হয়ে গেছে।" }, { status: 409 });
    }
    return serverTrouble("order-save", err);
  }

  // The order is saved, so email problems are logged but do not fail the order.
  const alert = {
    orderNo: saved.orderNo,
    productName: product.name,
    variantLabel: v.label,
    unitPrice: v.price,
    qty: o.qty,
    zoneLabel: zone.label,
    deliveryFee: zone.fee,
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
