// Admin-side catalogue data access: products, variants, images, categories.
// Server-only. Callers (server actions) must check permissions and validate
// input first; this module only talks to the database.
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { json } from "./catalog";
import { execute, select, selectOne, transaction } from "./db";
import type { Taste } from "./products";
import type { DeliveryZone } from "./site";

export const PRODUCT_STATUSES = ["draft", "published", "hidden"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const productStatusLabel: Record<ProductStatus, string> = { draft: "খসড়া", published: "প্রকাশিত", hidden: "লুকানো" };

export const ARTS = ["bottle", "jar", "ghee", "pickle", "gur", "muri", "fish", "prawn", "stem"] as const;

// ---------- Types ----------

export type AdminVariant = {
  id?: number;
  label: string;
  price: number;
  compareAt: number | null;
  cost: number | null;
  sku: string | null;
  stock: number | null;
  lowStock: number;
};

export type ProductInput = {
  slug: string;
  name: string;
  short: string;
  categoryId: number;
  badge: string | null;
  summary: string;
  origin: string;
  facts: { label: string; value: string }[];
  sections: { q: string; a: string }[];
  faq: { q: string; a: string }[];
  taste: Taste | null;
  related: string[];
  art: string | null;
  status: ProductStatus;
  publishAt: Date | null;
  metaTitle: string | null;
  metaDescription: string | null;
  defaultVariant: number;
  sort: number;
  variants: AdminVariant[];
};

export type AdminProduct = ProductInput & { id: number; categorySlug: string; updatedAt: Date };

export type AdminProductRow = {
  id: number;
  slug: string;
  name: string;
  status: ProductStatus;
  publish_at: Date | null;
  category: string;
  min_price: number | null;
  max_price: number | null;
  stock: number | null; // sum of tracked stock, NULL if none tracked
  low: number; // variants at/below their low-stock level
  image_id: number | null;
  /** Published with a publish time still in the future. */
  scheduled: number;
  sort: number;
  updated_at: Date;
};

// ---------- Products ----------

export async function listProductsAdmin(f: { q?: string; status?: ProductStatus | "scheduled"; category?: number }): Promise<AdminProductRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.q) {
    where.push("(p.name LIKE ? OR p.slug LIKE ? OR EXISTS (SELECT 1 FROM product_variants s WHERE s.product_id = p.id AND s.sku LIKE ?))");
    const like = `%${f.q.replace(/[%_]/g, "\\$&")}%`;
    params.push(like, like, like);
  }
  if (f.status === "scheduled") where.push("p.status = 'published' AND p.publish_at > UTC_TIMESTAMP()");
  else if (f.status) { where.push("p.status = ?"); params.push(f.status); }
  if (f.category) { where.push("p.category_id = ?"); params.push(f.category); }
  return select<AdminProductRow>(
    `SELECT p.id, p.slug, p.name, p.status, p.publish_at, c.label AS category, p.sort, p.updated_at,
            (p.status = 'published' AND p.publish_at IS NOT NULL AND p.publish_at > UTC_TIMESTAMP()) AS scheduled,
            (SELECT MIN(price) FROM product_variants v WHERE v.product_id = p.id AND v.active = 1) AS min_price,
            (SELECT MAX(price) FROM product_variants v WHERE v.product_id = p.id AND v.active = 1) AS max_price,
            (SELECT SUM(stock) FROM product_variants v WHERE v.product_id = p.id AND v.active = 1 AND v.stock IS NOT NULL) AS stock,
            (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.active = 1 AND v.stock IS NOT NULL AND v.stock <= v.low_stock) AS low,
            (SELECT i.id FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort, i.id LIMIT 1) AS image_id
     FROM products p JOIN categories c ON c.id = p.category_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY p.sort, p.id`,
    params,
  );
}

type ProductRow = {
  id: number; slug: string; name: string; short: string; category_id: number; category_slug: string; badge: string | null;
  summary: string | null; origin: string; facts: unknown; sections: unknown; faq: unknown; taste: unknown; related: unknown;
  art: string | null; status: ProductStatus; publish_at: Date | null; meta_title: string | null; meta_description: string | null;
  default_variant: number; sort: number; updated_at: Date;
};

export async function getProductAdmin(id: number): Promise<AdminProduct | null> {
  const p = await selectOne<ProductRow>(
    `SELECT p.*, c.slug AS category_slug FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
    [id],
  );
  if (!p) return null;
  const variants = await select<{ id: number; label: string; price: number; compare_at: number | null; cost: number | null; sku: string | null; stock: number | null; low_stock: number }>(
    "SELECT id, label, price, compare_at, cost, sku, stock, low_stock FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY sort, id",
    [id],
  );
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    short: p.short,
    categoryId: p.category_id,
    categorySlug: p.category_slug,
    badge: p.badge,
    summary: p.summary ?? "",
    origin: p.origin,
    facts: json(p.facts, []),
    sections: json(p.sections, []),
    faq: json(p.faq, []),
    taste: json<Taste | null>(p.taste, null),
    related: json<string[]>(p.related, []),
    art: p.art,
    status: p.status,
    publishAt: p.publish_at,
    metaTitle: p.meta_title,
    metaDescription: p.meta_description,
    defaultVariant: p.default_variant,
    sort: p.sort,
    updatedAt: p.updated_at,
    variants: variants.map((v) => ({ id: v.id, label: v.label, price: v.price, compareAt: v.compare_at, cost: v.cost, sku: v.sku, stock: v.stock, lowStock: v.low_stock })),
  };
}

/**
 * Keeps the product's variants in line with the form: updates kept ones,
 * inserts new ones, and removes dropped ones. A dropped variant that already
 * appears in an order is only deactivated, so order history stays intact.
 */
async function syncVariants(conn: PoolConnection, productId: number, variants: AdminVariant[]): Promise<void> {
  const [rows] = await conn.query<import("mysql2").RowDataPacket[]>("SELECT id FROM product_variants WHERE product_id = ? AND active = 1", [productId]);
  const existing = new Set(rows.map((r) => Number(r.id)));
  const kept = new Set<number>();
  for (const [i, v] of variants.entries()) {
    if (v.id && existing.has(v.id)) {
      kept.add(v.id);
      await conn.query(
        "UPDATE product_variants SET label = ?, price = ?, compare_at = ?, cost = ?, sku = ?, stock = ?, low_stock = ?, sort = ? WHERE id = ? AND product_id = ?",
        [v.label, v.price, v.compareAt, v.cost, v.sku, v.stock, v.lowStock, i, v.id, productId],
      );
    } else {
      await conn.query(
        "INSERT INTO product_variants (product_id, label, price, compare_at, cost, sku, stock, low_stock, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [productId, v.label, v.price, v.compareAt, v.cost, v.sku, v.stock, v.lowStock, i],
      );
    }
  }
  for (const id of existing) {
    if (kept.has(id)) continue;
    const [used] = await conn.query<import("mysql2").RowDataPacket[]>("SELECT 1 FROM order_items WHERE variant_id = ? LIMIT 1", [id]);
    if (used.length) await conn.query("UPDATE product_variants SET active = 0, sku = NULL WHERE id = ?", [id]);
    else await conn.query("DELETE FROM product_variants WHERE id = ?", [id]);
  }
}

function productValues(p: ProductInput): unknown[] {
  return [
    p.slug, p.name, p.short, p.categoryId, p.badge, p.summary, p.origin,
    JSON.stringify(p.facts), JSON.stringify(p.sections), JSON.stringify(p.faq),
    p.taste ? JSON.stringify(p.taste) : null, JSON.stringify(p.related), p.art,
    p.status, p.publishAt, p.metaTitle, p.metaDescription, p.defaultVariant, p.sort,
  ];
}

/** Creates (id = null) or updates a product with its variants, in one transaction. Returns the id. */
export async function saveProduct(id: number | null, p: ProductInput): Promise<number> {
  return transaction(async (conn) => {
    let productId = id;
    if (productId === null) {
      const [res] = await conn.query<ResultSetHeader>(
        `INSERT INTO products (slug, name, short, category_id, badge, summary, origin, facts, sections, faq, taste, related, art,
                               status, publish_at, meta_title, meta_description, default_variant, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        productValues(p),
      );
      productId = res.insertId;
    } else {
      await conn.query(
        `UPDATE products SET slug = ?, name = ?, short = ?, category_id = ?, badge = ?, summary = ?, origin = ?, facts = ?, sections = ?,
                faq = ?, taste = ?, related = ?, art = ?, status = ?, publish_at = ?, meta_title = ?, meta_description = ?,
                default_variant = ?, sort = ?
         WHERE id = ?`,
        [...productValues(p), productId],
      );
    }
    await syncVariants(conn, productId, p.variants);
    return productId;
  });
}

export async function setProductStatus(id: number, status: ProductStatus): Promise<void> {
  await execute("UPDATE products SET status = ?, publish_at = IF(? = 'published', publish_at, NULL) WHERE id = ?", [status, status, id]);
}

/** Deletes a product that was never ordered. Ordered products can only be hidden. */
export async function deleteProduct(id: number): Promise<"deleted" | "has-orders" | "missing"> {
  const p = await selectOne<{ slug: string }>("SELECT slug FROM products WHERE id = ?", [id]);
  if (!p) return "missing";
  const used = await selectOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM order_items i JOIN product_variants v ON v.id = i.variant_id WHERE v.product_id = ?",
    [id],
  );
  if (Number(used?.n ?? 0) > 0) return "has-orders";
  await execute("DELETE FROM products WHERE id = ?", [id]);
  return "deleted";
}

export async function lowStockVariants(limit = 20) {
  return select<{ product_id: number; product: string; label: string; stock: number; low_stock: number }>(
    `SELECT p.id AS product_id, p.name AS product, v.label, v.stock, v.low_stock
     FROM product_variants v JOIN products p ON p.id = v.product_id
     WHERE v.active = 1 AND v.stock IS NOT NULL AND v.stock <= v.low_stock AND p.status = 'published'
     ORDER BY v.stock, p.name LIMIT ?`,
    [limit],
  );
}

// ---------- Images ----------

export const MAX_IMAGE_BYTES = 1_500_000;
export const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;

export type AdminImage = { id: number; alt: string; caption: string; width: number; height: number; bytes: number; sort: number };

export async function listImages(productId: number): Promise<AdminImage[]> {
  return select<AdminImage>("SELECT id, alt, caption, width, height, bytes, sort FROM product_images WHERE product_id = ? ORDER BY sort, id", [productId]);
}

export async function addImage(productId: number, img: { mime: string; data: Buffer; width: number; height: number; alt: string; caption: string }): Promise<number> {
  const next = await selectOne<{ s: number | null }>("SELECT MAX(sort) AS s FROM product_images WHERE product_id = ?", [productId]);
  const res = await execute(
    "INSERT INTO product_images (product_id, mime, data, bytes, width, height, alt, caption, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [productId, img.mime, img.data, img.data.length, img.width, img.height, img.alt, img.caption, Number(next?.s ?? -1) + 1],
  );
  return res.insertId;
}

export async function updateImage(id: number, productId: number, alt: string, caption: string): Promise<void> {
  await execute("UPDATE product_images SET alt = ?, caption = ? WHERE id = ? AND product_id = ?", [alt, caption, id, productId]);
}

export async function deleteImage(id: number, productId: number): Promise<void> {
  await execute("DELETE FROM product_images WHERE id = ? AND product_id = ?", [id, productId]);
}

/** Moves an image one place up or down by swapping sort values with its neighbour. */
export async function moveImage(id: number, productId: number, dir: "up" | "down"): Promise<void> {
  const list = await listImages(productId);
  const i = list.findIndex((x) => x.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  await transaction(async (conn) => {
    for (const [k, img] of list.entries()) {
      const sort = k === i ? j : k === j ? i : k;
      await conn.query("UPDATE product_images SET sort = ? WHERE id = ?", [sort, img.id]);
    }
  });
}

export async function getImageData(id: number): Promise<{ mime: string; data: Buffer; created_at: Date } | null> {
  return selectOne("SELECT mime, data, created_at FROM product_images WHERE id = ?", [id]);
}

// ---------- Categories ----------

export type CategoryInput = {
  slug: string;
  label: string;
  blurb: string;
  intro: string;
  factsTitle: string;
  zones: DeliveryZone[];
  policy: string;
  faq: { q: string; a: string }[];
  art: string | null;
  sort: number;
  status: "active" | "hidden";
};

export type AdminCategory = CategoryInput & { id: number; products: number };

export async function listCategoriesAdmin(): Promise<AdminCategory[]> {
  const rows = await select<{
    id: number; slug: string; label: string; blurb: string; intro: string | null; facts_title: string; zones: unknown;
    policy: string; faq: unknown; art: string | null; sort: number; status: "active" | "hidden"; products: number;
  }>(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS products
     FROM categories c ORDER BY c.sort, c.id`,
  );
  return rows.map((c) => ({
    id: c.id, slug: c.slug, label: c.label, blurb: c.blurb, intro: c.intro ?? "", factsTitle: c.facts_title,
    zones: json<DeliveryZone[]>(c.zones, ["dhaka", "outside"]), policy: c.policy, faq: json(c.faq, []), art: c.art,
    sort: c.sort, status: c.status, products: Number(c.products),
  }));
}

export async function saveCategory(id: number | null, c: CategoryInput): Promise<number> {
  const values = [c.slug, c.label, c.blurb, c.intro, c.factsTitle, JSON.stringify(c.zones), c.policy, JSON.stringify(c.faq), c.art, c.sort, c.status];
  if (id === null) {
    const res = await execute(
      "INSERT INTO categories (slug, label, blurb, intro, facts_title, zones, policy, faq, art, sort, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      values,
    );
    return res.insertId;
  }
  await execute(
    "UPDATE categories SET slug = ?, label = ?, blurb = ?, intro = ?, facts_title = ?, zones = ?, policy = ?, faq = ?, art = ?, sort = ?, status = ? WHERE id = ?",
    [...values, id],
  );
  return id;
}
