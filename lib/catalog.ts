// The live catalogue: categories and products from the database. Server-only.
//
// Storefront pages call getCatalog() (or the small helpers below). It is cached
// with the "catalog" tag; admin actions call updateTag(CATALOG_TAG) after a
// change so the shop updates immediately. cacheLife("minutes") makes scheduled
// products appear by themselves within a minute or so of their publish time.
//
// If the database is unreachable, the starter catalogue in lib/products.ts is
// served instead, so the shop stays browsable (ordering still needs the DB).
import { cacheLife, cacheTag } from "next/cache";
import { dbConfigured, select } from "./db";
import {
  categories as seedCategories,
  products as seedProducts,
  type Art,
  type CategoryInfo,
  type Product,
  type ProductImage,
  type Taste,
  type Variant,
} from "./products";
import type { DeliveryZone } from "./site";

export const CATALOG_TAG = "catalog";

export type Catalog = {
  categories: CategoryInfo[];
  products: Product[];
  /** "db" normally; "fallback" when the starter catalogue is being shown. */
  source: "db" | "fallback";
};

/** Parses a JSON column that mysql2 may return as a string or an object. */
export function json<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

/** URL of a stored product photo. `v` busts caches when the image changes. */
export function imageUrl(id: number, v: number | string = 0): string {
  return `/img/${id}?v=${v}`;
}

type CategoryRow = {
  id: number; slug: string; label: string; blurb: string; intro: string | null; facts_title: string;
  zones: unknown; policy: string; faq: unknown; art: string | null;
};
type ProductRow = {
  id: number; slug: string; name: string; short: string; category_slug: string; badge: string | null;
  summary: string | null; origin: string; facts: unknown; sections: unknown; faq: unknown; taste: unknown;
  related: unknown; art: string | null; meta_title: string | null; meta_description: string | null; default_variant: number;
};
type VariantRow = { id: number; product_id: number; label: string; price: number; compare_at: number | null; stock: number | null };
type ImageRow = { id: number; product_id: number; alt: string; caption: string; width: number; height: number; created_at: Date };

/** Loads only what the public shop may see: active categories, published products whose time has come. */
async function loadFromDb(): Promise<Catalog> {
  const [cats, prods, vars, imgs] = await Promise.all([
    select<CategoryRow>(
      "SELECT id, slug, label, blurb, intro, facts_title, zones, policy, faq, art FROM categories WHERE status = 'active' ORDER BY sort, id",
    ),
    select<ProductRow>(
      `SELECT p.id, p.slug, p.name, p.short, c.slug AS category_slug, p.badge, p.summary, p.origin, p.facts, p.sections,
              p.faq, p.taste, p.related, p.art, p.meta_title, p.meta_description, p.default_variant
       FROM products p JOIN categories c ON c.id = p.category_id
       WHERE p.status = 'published' AND (p.publish_at IS NULL OR p.publish_at <= UTC_TIMESTAMP()) AND c.status = 'active'
       ORDER BY p.sort, p.id`,
    ),
    select<VariantRow>("SELECT id, product_id, label, price, compare_at, stock FROM product_variants WHERE active = 1 ORDER BY product_id, sort, id"),
    select<ImageRow>("SELECT id, product_id, alt, caption, width, height, created_at FROM product_images ORDER BY product_id, sort, id"),
  ]);

  const variantsBy = new Map<number, Variant[]>();
  for (const v of vars) {
    const list = variantsBy.get(v.product_id) ?? [];
    list.push({ id: v.id, label: v.label, price: v.price, compareAt: v.compare_at ?? undefined, stock: v.stock ?? undefined });
    variantsBy.set(v.product_id, list);
  }
  const imagesBy = new Map<number, ProductImage[]>();
  for (const i of imgs) {
    const list = imagesBy.get(i.product_id) ?? [];
    list.push({ src: imageUrl(i.id, new Date(i.created_at).getTime()), alt: i.alt, caption: i.caption || "ছবি" });
    imagesBy.set(i.product_id, list);
  }

  const categories: CategoryInfo[] = cats.map((c) => ({
    id: c.slug,
    label: c.label,
    blurb: c.blurb,
    intro: c.intro ?? "",
    factsTitle: c.facts_title,
    zones: json<DeliveryZone[]>(c.zones, ["dhaka", "outside"]),
    policy: c.policy,
    faq: json(c.faq, []),
    art: (c.art as Art) ?? undefined,
  }));

  const products: Product[] = prods
    .map((p): Product => {
      const variants = variantsBy.get(p.id) ?? [];
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        short: p.short,
        category: p.category_slug,
        art: (p.art as Art) ?? undefined,
        badge: p.badge ?? undefined,
        variants,
        defaultVariant: Math.min(p.default_variant, Math.max(variants.length - 1, 0)),
        summary: p.summary ?? "",
        origin: p.origin,
        facts: json(p.facts, []),
        sections: json(p.sections, []),
        faq: json(p.faq, []),
        related: json<string[]>(p.related, []),
        taste: json<Taste | undefined>(p.taste, undefined),
        images: imagesBy.get(p.id),
        metaTitle: p.meta_title ?? undefined,
        metaDescription: p.meta_description ?? undefined,
      };
    })
    // A product without any active size can't be sold; keep it off the shop.
    .filter((p) => p.variants.length > 0);

  return { categories, products, source: "db" };
}

/** The public catalogue (cached). */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("minutes");
  if (!dbConfigured()) return { categories: seedCategories, products: seedProducts, source: "fallback" };
  try {
    return await loadFromDb();
  } catch (e) {
    console.error("[catalog] database unavailable, showing starter catalogue:", e instanceof Error ? e.message : e);
    return { categories: seedCategories, products: seedProducts, source: "fallback" };
  }
}

// ---------- Fresh (uncached) reads for checkout ----------

export type OrderableVariant = { id: number; label: string; price: number; cost: number | null; stock: number | null };
export type Orderable = {
  id: number;
  slug: string;
  name: string;
  zones: DeliveryZone[];
  variants: OrderableVariant[];
};

/**
 * Current price, cost and stock straight from the database, for placing an order.
 * Never cached: a price change or sell-out must apply to the very next order.
 * Returns null if the product isn't on sale right now.
 */
export async function loadOrderable(slug: string): Promise<Orderable | null> {
  const rows = await select<{ id: number; slug: string; name: string; zones: unknown }>(
    `SELECT p.id, p.slug, p.name, c.zones FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.slug = ? AND p.status = 'published' AND (p.publish_at IS NULL OR p.publish_at <= UTC_TIMESTAMP()) AND c.status = 'active'`,
    [slug],
  );
  const p = rows[0];
  if (!p) return null;
  const variants = await select<OrderableVariant>(
    "SELECT id, label, price, cost, stock FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY sort, id",
    [p.id],
  );
  return { id: p.id, slug: p.slug, name: p.name, zones: json<DeliveryZone[]>(p.zones, ["dhaka", "outside"]), variants };
}

// ---------- Small helpers over a loaded catalogue (pure, no I/O) ----------

export function findProduct(c: Catalog, slug: string): Product | undefined {
  return c.products.find((p) => p.slug === slug);
}

export function findCategory(c: Catalog, slug: string): CategoryInfo | undefined {
  return c.categories.find((x) => x.id === slug);
}

export function productsInCategory(c: Catalog, slug: string): Product[] {
  return c.products.filter((p) => p.category === slug);
}

/** In stock? Untracked stock always counts as available. */
export function inStock(v: Variant): boolean {
  return v.stock === undefined || v.stock > 0;
}
