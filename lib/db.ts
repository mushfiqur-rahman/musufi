// MySQL/MariaDB connection pool. Server-only.
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

const env = (k: string) => process.env[k]?.trim() ?? "";

export function dbConfigured(): boolean {
  return Boolean(env("DB_HOST") && env("DB_NAME") && env("DB_USER") && env("DB_PASSWORD"));
}

// Keep one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { musufiPool?: Pool };

function pool(): Pool {
  if (globalForDb.musufiPool) return globalForDb.musufiPool;
  const p = mysql.createPool({
    host: env("DB_HOST"),
    port: Number(env("DB_PORT")) || 3306,
    user: env("DB_USER"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME"),
    connectionLimit: 5,
    connectTimeout: 15_000,
    charset: "utf8mb4",
    timezone: "Z", // DATETIME values are UTC
    dateStrings: false,
  });
  // Hostinger's server runs without strict mode; turn it on so bad data is rejected, not truncated.
  p.on("connection", (conn) => {
    conn.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO', time_zone = '+00:00'");
  });
  globalForDb.musufiPool = p;
  return p;
}

export type Row = RowDataPacket;

export async function select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool().query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

export async function selectOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await select<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [res] = await pool().query<ResultSetHeader>(sql, params);
  return res;
}

/** Runs `fn` inside a transaction; rolls back if it throws. */
export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
