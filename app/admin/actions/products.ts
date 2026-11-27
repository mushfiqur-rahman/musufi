"use server";
// Product, image and category actions. Every action:
// 1) checks the permission (assertPermission), 2) validates input (lib/validate),
// 3) writes (lib/admin-catalog), 4) logs (lib/audit), 5) refreshes the shop (updateTag).

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/admin";
import {
  addImage, ARTS, deleteImage, deleteProduct, IMAGE_TYPES, MAX_IMAGE_BYTES, moveImage, PRODUCT_STATUSES, saveCategory,
  saveProduct, setProductStatus, updateImage, type AdminVariant, type CategoryInput, type ProductInput,
} from "@/lib/admin-catalog";
import { audit } from "@/lib/audit";
import { CATALOG_TAG } from "@/lib/catalog";
import { selectOne } from "@/lib/db";
import type { Taste, TasteKey } from "@/lib/products";
import {
  actionError, dhakaDateTimeLocal, factList, jsonPayload, oneOf, optionalText, qaList, slug, text, ValidationError, wholeNumber,
  type ActionResult,
} from "@/lib/validate";

const TASTE_KEYS: TasteKey[] = ["sweet", "sour", "spicy", "pungent", "bitter", "salty"];

function parseVariants(v: unknown): AdminVariant[] {
  if (!Array.isArray(v) || v.length === 0) throw new ValidationError("variants", "কমপক্ষে একটি সাইজ ও দাম দিন");
  if (v.length > 20) throw new ValidationError("variants", "সর্বোচ্চ ২০টি সাইজ");
  return v.map((raw, i) => {
    const x = raw as Record<string, unknown>;
    const n = `সাইজ ${i + 1}`;
    const price = wholeNumber(x.price, `${n}: দাম`, { min: 1, max: 1_000_000, required: true })!;
    const compareAt = wholeNumber(x.compareAt, `${n}: আগের দাম`, { max: 1_000_000 });
    if (compareAt !== null && compareAt <= price) throw new ValidationError("variants", `${n}: আগের দাম বর্তমান দামের চেয়ে বেশি হতে হবে`);
    const sku = optionalText(x.sku, `${n}: SKU`, 40);
    if (sku && !/^[A-Za-z0-9._-]+$/.test(sku)) throw new ValidationError("variants", `${n}: SKU-তে শুধু ইংরেজি অক্ষর, সংখ্যা, - _ .`);
    return {
      id: typeof x.id === "number" && x.id > 0 ? x.id : undefined,
      label: text(x.label, `${n}: নাম`, { max: 80, required: true }),
      price,
      compareAt,
      cost: wholeNumber(x.cost, `${n}: কেনা দাম`, { max: 1_000_000 }),
      sku,
      stock: wholeNumber(x.stock, `${n}: স্টক`, { max: 1_000_000 }),
      lowStock: wholeNumber(x.lowStock, `${n}: কম স্টকের সীমা`, { max: 100_000 }) ?? 5,
    };
  });
}

function parseTaste(v: unknown): Taste | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Record<string, unknown>;
  const oneLine = text(t.oneLine, "স্বাদ: এক লাইনে", { max: 120 });
  if (!oneLine) return null; // empty taste block = not a food product
  const levels: Taste["levels"] = {};
  const rawLevels = (t.levels ?? {}) as Record<string, unknown>;
  for (const k of TASTE_KEYS) {
    const n = Number(rawLevels[k]);
    if (Number.isInteger(n) && n >= 1 && n <= 5) levels[k] = n as 1 | 2 | 3 | 4 | 5;
  }
  const bestWith = Array.isArray(t.bestWith) ? t.bestWith.map((s) => text(s, "যা দিয়ে খায়", { max: 40 })).filter(Boolean).slice(0, 10) : [];
  return { oneLine, levels, texture: text(t.texture, "মুখে কেমন", { max: 200 }), aroma: text(t.aroma, "ঘ্রাণ", { max: 200 }), bestWith };
}

/** Builds a validated ProductInput from the form's JSON payload. */
async function parseProduct(form: FormData): Promise<ProductInput> {
  const d = jsonPayload<Record<string, unknown>>(form.get("payload"), "পণ্যের তথ্য");
  const categoryId = wholeNumber(d.categoryId, "ক্যাটাগরি", { min: 1, max: 1_000_000, required: true })!;
  const cat = await selectOne<{ id: number }>("SELECT id FROM categories WHERE id = ?", [categoryId]);
  if (!cat) throw new ValidationError("categoryId", "ক্যাটাগরি বেছে নিন");
  const variants = parseVariants(d.variants);
  const status = oneOf(d.status, PRODUCT_STATUSES, "অবস্থা");
  const art = typeof d.art === "string" && (ARTS as readonly string[]).includes(d.art) ? d.art : null;
  const related = Array.isArray(d.related) ? d.related.filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s)).slice(0, 8) : [];
  return {
    slug: slug(d.slug),
    name: text(d.name, "নাম", { max: 120, required: true, min: 2 }),
    short: text(d.short, "ছোট বিবরণ", { max: 160 }),
    categoryId,
    badge: optionalText(d.badge, "ব্যাজ", 40),
    summary: text(d.summary, "এক কথায়", { max: 600 }),
    origin: text(d.origin, "উৎস", { max: 120 }),
    facts: factList(d.facts, "পণ্যের তথ্য"),
    sections: qaList(d.sections, "প্রশ্নভিত্তিক বিবরণ"),
    faq: qaList(d.faq, "প্রশ্ন-উত্তর"),
    taste: parseTaste(d.taste),
    related,
    art,
    status,
    publishAt: status === "published" ? dhakaDateTimeLocal(d.publishAt, "প্রকাশের সময়") : null,
    metaTitle: optionalText(d.metaTitle, "SEO শিরোনাম", 70),
    metaDescription: optionalText(d.metaDescription, "SEO বিবরণ", 170),
    defaultVariant: Math.min(wholeNumber(d.defaultVariant, "ডিফল্ট সাইজ", { max: 19 }) ?? 0, variants.length - 1),
    sort: wholeNumber(d.sort, "ক্রম", { max: 30_000 }) ?? 0,
    variants,
  };
}

/**
 * Creates or updates a product. On success it redirects to the edit page with
 * ?created / ?saved, so the confirmation survives the page reload that brings in
 * fresh data (new sizes need their database ids). On failure it returns the error.
 */
export async function saveProductAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  let savedId: number;
  let isNew: boolean;
  try {
    const me = await assertPermission("products.manage");
    const idRaw = String(form.get("id") ?? "");
    const id = idRaw ? wholeNumber(idRaw, "id", { min: 1, max: 100_000_000 }) : null;
    const input = await parseProduct(form);
    savedId = await saveProduct(id, input);
    isNew = id === null;
    await audit(me, isNew ? "product.create" : "product.update", "product", savedId, { name: input.name, status: input.status });
    updateTag(CATALOG_TAG);
  } catch (e) {
    return actionError("product.save", e);
  }
  // redirect() throws on purpose, so it must stay outside the try/catch.
  redirect(`/admin/products/${savedId}?${isNew ? "created" : "saved"}=1`);
}

export async function setProductStatusAction(form: FormData): Promise<void> {
  const me = await assertPermission("products.manage");
  const id = wholeNumber(form.get("id"), "id", { min: 1, max: 100_000_000, required: true })!;
  const status = oneOf(form.get("status"), PRODUCT_STATUSES, "অবস্থা");
  await setProductStatus(id, status);
  await audit(me, status === "published" ? "product.publish" : "product.unpublish", "product", id, { status });
  updateTag(CATALOG_TAG);
  refresh();
}

export async function deleteProductAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("products.manage");
    const id = wholeNumber(form.get("id"), "id", { min: 1, max: 100_000_000, required: true })!;
    const r = await deleteProduct(id);
    if (r === "has-orders") return { ok: false, message: "এই পণ্যের অর্ডার আছে, তাই মোছা যাবে না। লুকিয়ে রাখুন।" };
    if (r === "deleted") {
      await audit(me, "product.delete", "product", id);
      updateTag(CATALOG_TAG);
    }
    return { ok: true, message: "পণ্য মুছে ফেলা হয়েছে।" };
  } catch (e) {
    return actionError("product.delete", e);
  }
}

// ---------- Images ----------

/** Checks the first bytes, so a renamed file can't pretend to be an image. */
function sniffImage(buf: Buffer): (typeof IMAGE_TYPES)[number] | null {
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png";
  return null;
}

export async function uploadImageAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("products.manage");
    const productId = wholeNumber(form.get("productId"), "পণ্য", { min: 1, max: 100_000_000, required: true })!;
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "ছবি বেছে নিন।" };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: "ছবি ১.৫ MB-এর চেয়ে বড়। ছোট করে আবার দিন।" };
    const data = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(data);
    if (!mime) return { ok: false, message: "শুধু JPG, PNG বা WebP ছবি দেওয়া যাবে।" };
    const width = wholeNumber(form.get("width"), "প্রস্থ", { min: 1, max: 6000, required: true })!;
    const height = wholeNumber(form.get("height"), "উচ্চতা", { min: 1, max: 6000, required: true })!;
    const id = await addImage(productId, {
      mime, data, width, height,
      alt: text(form.get("alt"), "বিবরণ (alt)", { max: 160 }),
      caption: text(form.get("caption"), "ক্যাপশন", { max: 60 }),
    });
    await audit(me, "product.image.add", "product", productId, { imageId: id, bytes: data.length });
    updateTag(CATALOG_TAG);
    refresh();
    return { ok: true, message: "ছবি যোগ হয়েছে।", id };
  } catch (e) {
    return actionError("image.upload", e);
  }
}

export async function imageAction(form: FormData): Promise<void> {
  const me = await assertPermission("products.manage");
  const id = wholeNumber(form.get("imageId"), "ছবি", { min: 1, max: 100_000_000, required: true })!;
  const productId = wholeNumber(form.get("productId"), "পণ্য", { min: 1, max: 100_000_000, required: true })!;
  const op = oneOf(form.get("op"), ["save", "delete", "up", "down"] as const, "কাজ");
  if (op === "delete") {
    await deleteImage(id, productId);
    await audit(me, "product.image.delete", "product", productId, { imageId: id });
  } else if (op === "save") {
    await updateImage(id, productId, text(form.get("alt"), "বিবরণ (alt)", { max: 160 }), text(form.get("caption"), "ক্যাপশন", { max: 60 }));
    await audit(me, "product.image.update", "product", productId, { imageId: id });
  } else {
    await moveImage(id, productId, op);
  }
  updateTag(CATALOG_TAG);
  refresh();
}

// ---------- Categories ----------

export async function saveCategoryAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("products.manage");
    const d = jsonPayload<Record<string, unknown>>(form.get("payload"), "ক্যাটাগরির তথ্য");
    const idRaw = String(form.get("id") ?? "");
    const id = idRaw ? wholeNumber(idRaw, "id", { min: 1, max: 1_000_000 }) : null;
    const zones = (Array.isArray(d.zones) ? d.zones : []).filter((z): z is "dhaka" | "outside" => z === "dhaka" || z === "outside");
    if (zones.length === 0) throw new ValidationError("zones", "কমপক্ষে একটি ডেলিভারি এলাকা বেছে নিন");
    const input: CategoryInput = {
      slug: slug(d.slug),
      label: text(d.label, "নাম", { max: 80, required: true }),
      blurb: text(d.blurb, "ছোট বিবরণ", { max: 160 }),
      intro: text(d.intro, "ভূমিকা", { max: 1500 }),
      factsTitle: text(d.factsTitle, "তথ্য টেবিলের শিরোনাম", { max: 60 }) || "পণ্যের তথ্য",
      zones: [...new Set(zones)],
      policy: text(d.policy, "নীতি", { max: 200 }),
      faq: qaList(d.faq, "প্রশ্ন-উত্তর"),
      art: typeof d.art === "string" && (ARTS as readonly string[]).includes(d.art) ? d.art : null,
      sort: wholeNumber(d.sort, "ক্রম", { max: 30_000 }) ?? 0,
      status: oneOf(d.status, ["active", "hidden"] as const, "অবস্থা"),
    };
    const savedId = await saveCategory(id, input);
    await audit(me, id ? "category.update" : "category.create", "category", savedId, { label: input.label });
    updateTag(CATALOG_TAG);
    return { ok: true, message: "সংরক্ষণ হয়েছে।", id: savedId };
  } catch (e) {
    return actionError("category.save", e);
  }
}
