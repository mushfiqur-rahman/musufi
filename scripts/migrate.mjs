// Applies SQL files in db/migrations in name order, once each.
// Usage: npm run db:migrate
// Reads DB_* from the environment, or from .env files (same rules as Next.js).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import nextEnv from "@next/env";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Same loader Next.js uses, so quoting and $ escapes behave identically.
nextEnv.loadEnvConfig(root, false, { info() {}, error() {} });

const missing = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing settings: " + missing.join(", "));
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  connectTimeout: 15000,
});

try {
  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [rows] = await conn.query("SELECT version FROM schema_migrations");
  const done = new Set(rows.map((r) => r.version));
  const dir = join(root, "db", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    console.log("Applying " + f + " ...");
    await conn.query(readFileSync(join(dir, f), "utf8"));
    await conn.query("INSERT INTO schema_migrations (version) VALUES (?)", [f]);
    applied++;
  }
  console.log(applied ? `Done: ${applied} migration(s) applied.` : "Database is up to date.");
} finally {
  await conn.end();
}
