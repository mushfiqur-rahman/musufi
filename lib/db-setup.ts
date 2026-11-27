// Database self-setup, run once when the server starts (instrumentation.ts).
// 1. Applies any SQL files in db/migrations that this database hasn't had yet
//    (same bookkeeping table as `npm run db:migrate`, so both can be used).
// 2. If the shop has no categories at all (a brand-new database), copies the
//    starter catalogue in, the same way `npm run db:seed` does.
// So a fresh deploy on a fresh, empty database works without any manual step,
// and without needing remote database access from a PC.
// Server-only. Never throws: a failure is logged and the site keeps running.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { categories, products } from "./products";

const env = (k: string) => process.env[k]?.trim() ?? "";

async function connect() {
  const socketPath = env("DB_SOCKET");
  return mysql.createConnection({
    ...(socketPath ? { socketPath } : { host: env("DB_HOST"), port: Number(env("DB_PORT")) || 3306 }),
    user: env("DB_USER"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME"),
    charset: "utf8mb4",
    multipleStatements: true, // migration files hold several statements
    connectTimeout: 5_000,
  });
}

type Conn = Awaited<ReturnType<typeof connect>>;

async function migrate(conn: Conn): Promise<string[]> {
  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [rows] = await conn.query("SELECT version FROM schema_migrations");
  const done = new Set((rows as { version: string }[]).map((r) => r.version));
  const dir = join(process.cwd(), "db", "migrations");
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    await conn.query(readFileSync(join(dir, f), "utf8"));
    await conn.query("INSERT INTO schema_migrations (version) VALUES (?)", [f]);
    applied.push(f);
  }
  return applied;
}

/** Starter catalogue, only into an empty shop (never re-adds things the owner deleted). */
async function seedIfEmpty(conn: Conn): Promise<number> {
  const [[row]] = (await conn.query("SELECT COUNT(*) AS n FROM categories")) as unknown as [{ n: number }[]];
  if (Number(row.n) > 0) return 0;
  await conn.beginTransaction();
  try {
    const catId = new Map<string, number>();
    for (const [i, c] of categories.entries()) {
      const [res] = await conn.query(
        `INSERT INTO categories (slug, label, blurb, intro, facts_title, zones, policy, faq, art, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.label, c.blurb, c.intro, c.factsTitle, JSON.stringify(c.zones), c.policy, JSON.stringify(c.faq), c.art ?? null, i * 10],
      );
      catId.set(c.id, (res as mysql.ResultSetHeader).insertId);
    }
    for (const [i, p] of products.entries()) {
      const category = catId.get(p.category);
      if (!category) continue;
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
          "INSERT INTO product_variants (product_id, label, price, compare_at, sort) VALUES (?, ?, ?, ?, ?)",
          [productId, v.label, v.price, v.compareAt ?? null, vi],
        );
      }
    }
    await conn.commit();
    return products.length;
  } catch (e) {
    await conn.rollback();
    throw e;
  }
}

export async function setupDatabase(): Promise<void> {
  if (!env("DB_NAME") || !env("DB_USER") || !env("DB_PASSWORD") || (!env("DB_HOST") && !env("DB_SOCKET"))) return;
  let conn: Conn | null = null;
  try {
    conn = await connect();
    // One server at a time (e.g. during a redeploy overlap).
    const [[lock]] = (await conn.query("SELECT GET_LOCK('musufi_setup', 30) AS ok")) as unknown as [{ ok: number }[]];
    if (Number(lock.ok) !== 1) { console.warn("[db-setup] another server is setting up; skipped"); return; }
    const applied = await migrate(conn);
    const seeded = await seedIfEmpty(conn);
    console.log(`[db-setup] ${applied.length ? `applied ${applied.join(", ")}` : "schema up to date"}${seeded ? `; added starter catalogue (${seeded} products)` : ""}`);
  } catch (e) {
    const code = (e as { code?: unknown })?.code;
    console.error("[db-setup] failed:", typeof code === "string" ? code : e instanceof Error ? e.message : e);
  } finally {
    await conn?.query("SELECT RELEASE_LOCK('musufi_setup')").catch(() => {});
    await conn?.end().catch(() => {});
  }
}
