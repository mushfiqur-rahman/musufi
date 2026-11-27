// Copies the starter catalogue (lib/products.ts) into the database.
// Usage: npm run db:seed
// Safe to run more than once: categories/products whose slug already exists are skipped,
// so it never overwrites changes made in the admin panel.
// Needs Node 22.18+ (TypeScript type stripping); this project uses Node 24.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import nextEnv from "@next/env";
import { categories, products } from "../lib/products.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root, false, { info() {}, error() {} });

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4",
});

type Id = { id: number };
let addedCats = 0;
let addedProducts = 0;

try {
  await conn.beginTransaction();

  const catId = new Map<string, number>();
  for (const [i, c] of categories.entries()) {
    const [found] = await conn.query("SELECT id FROM categories WHERE slug = ?", [c.id]);
    const existing = (found as Id[])[0];
    if (existing) {
      catId.set(c.id, existing.id);
      continue;
    }
    const [res] = await conn.query(
      `INSERT INTO categories (slug, label, blurb, intro, facts_title, zones, policy, faq, art, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.label, c.blurb, c.intro, c.factsTitle, JSON.stringify(c.zones), c.policy, JSON.stringify(c.faq), c.art ?? null, i * 10],
    );
    catId.set(c.id, (res as mysql.ResultSetHeader).insertId);
    addedCats++;
  }

  // Old cost prices (from the first admin version), keyed "slug:variantIndex".
  const [costRows] = await conn.query("SELECT product_slug, variant_index, unit_cost FROM product_costs");
  const costs = new Map((costRows as { product_slug: string; variant_index: number; unit_cost: number }[]).map((r) => [`${r.product_slug}:${r.variant_index}`, r.unit_cost]));

  for (const [i, p] of products.entries()) {
    const [found] = await conn.query("SELECT id FROM products WHERE slug = ?", [p.slug]);
    if ((found as Id[])[0]) continue;
    const category = catId.get(p.category);
    if (!category) throw new Error(`Unknown category ${p.category} for ${p.slug}`);
    const [res] = await conn.query(
      `INSERT INTO products (slug, name, short, category_id, badge, summary, origin, facts, sections, faq, taste, related, art,
                             status, default_variant, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`,
      [
        p.slug, p.name, p.short, category, p.badge ?? null, p.summary, p.origin,
        JSON.stringify(p.facts), JSON.stringify(p.sections), JSON.stringify(p.faq),
        p.taste ? JSON.stringify(p.taste) : null, JSON.stringify(p.related), p.art ?? null,
        p.defaultVariant, i * 10,
      ],
    );
    const productId = (res as mysql.ResultSetHeader).insertId;
    for (const [vi, v] of p.variants.entries()) {
      await conn.query(
        "INSERT INTO product_variants (product_id, label, price, compare_at, cost, sort) VALUES (?, ?, ?, ?, ?, ?)",
        [productId, v.label, v.price, v.compareAt ?? null, costs.get(`${p.slug}:${vi}`) ?? null, vi],
      );
    }
    addedProducts++;
  }

  await conn.commit();
  console.log(`Seed done: ${addedCats} categories and ${addedProducts} products added (existing ones left untouched).`);
} catch (e) {
  await conn.rollback();
  console.error("Seed failed, nothing was changed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await conn.end();
}
