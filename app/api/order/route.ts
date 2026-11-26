import { getCategory, getProduct } from "@/lib/products";
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = validate(body);
  if (!result.ok) return Response.json({ message: result.message }, { status: 400 });

  // Prices are always recalculated on the server, never trusted from the browser.
  const product = getProduct(result.order.slug)!;
  const v = product.variants[result.order.variant];
  const total = v.price * result.order.qty + site.delivery[result.order.zone].fee;
  void total;

  // TODO (phase 2): require a signed-in customer, save the order in MySQL,
  // run the courier history check, and notify the owner.
  // Until storage exists, refuse honestly instead of losing the order.
  return Response.json(
    { message: "অনলাইন অর্ডার এখনো চালু হয়নি। দয়া করে হোয়াটসঅ্যাপে বা ফোনে অর্ডার করুন।" },
    { status: 503 },
  );
}
