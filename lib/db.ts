// MySQL/MariaDB connection pool. Server-only.
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

const env = (k: string) => process.env[k]?.trim() ?? "";

export function dbConfigured(): boolean {
  return Boolean(env("DB_HOST") && env("DB_NAME") && env("DB_USER") && env("DB_PASSWORD"));
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** How the pool reaches the database (shown, without names, in error reasons). */
function via(): "socket" | "tcp-local" | "tcp-remote" {
  if (env("DB_SOCKET")) return "socket";
  return LOCAL_HOSTS.has(env("DB_HOST").toLowerCase()) ? "tcp-local" : "tcp-remote";
}

// Keep one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { musufiPool?: Pool };

function pool(): Pool {
  if (globalForDb.musufiPool) return globalForDb.musufiPool;
  // DB_SOCKET (optional): connect through MySQL's local socket file instead of TCP,
  // e.g. /var/lib/mysql/mysql.sock, when the host only accepts socket connections.
  const socketPath = env("DB_SOCKET");
  const p = mysql.createPool({
    ...(socketPath ? { socketPath } : { host: env("DB_HOST"), port: Number(env("DB_PORT")) || 3306 }),
    user: env("DB_USER"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME"),
    connectionLimit: 5,
    // Fail fast: a page should not hang for 15 s if the database is unreachable.
    connectTimeout: 5_000,
    // Reuse warm connections instead of reconnecting (a new connection costs a full handshake).
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    maxIdle: 5,
    idleTimeout: 300_000,
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

/**
 * Short, safe reason for a database failure, e.g. "ECONNREFUSED via=tcp-local" or
 * "ER_ACCESS_DENIED_ERROR via=tcp-remote seen-as=remote". Never the message, host,
 * user or password: only the error code, how we connect, and (for access denied)
 * whether the database saw us as a local or a remote client. That is enough to
 * tell "wrong DB_HOST" from "wrong password" without exposing anything.
 */
export function dbErrorReason(e: unknown): string {
  const raw = (e as { code?: unknown })?.code;
  const code = typeof raw === "string" && /^[A-Z_0-9]{3,40}$/.test(raw) ? raw : "UNKNOWN";
  if (code === "UNKNOWN") return code;
  let reason = `${code} via=${via()}`;
  if (code === "ER_ACCESS_DENIED_ERROR") {
    const msg = e instanceof Error ? e.message : "";
    const host = /@'([^']*)'/.exec(msg)?.[1];
    if (host) reason += ` seen-as=${LOCAL_HOSTS.has(host.toLowerCase()) ? "local" : "remote"}`;
    if (msg.includes("using password: NO")) reason += " no-password";
  }
  return reason;
}

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
