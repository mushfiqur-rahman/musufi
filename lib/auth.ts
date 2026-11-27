// Login (email code the first time or when a password is forgotten; email +
// password after that) and sessions. Server-only.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { execute, selectOne } from "./db";
import { sendLoginCode } from "./mailer";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { isRole, type Role } from "./permissions";

export const SESSION_COOKIE = "ms_session";
const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export type Customer = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  /** Last structured address (division/district/upazila/union ids + line), for pre-filling. */
  addressParts: unknown;
  /** Staff role, or null for an ordinary customer. Owners from ADMIN_EMAILS are always "owner". */
  role: Role | null;
  /** True for any staff role: may open /admin (each page checks its own permission). */
  isAdmin: boolean;
  /** A password has been set (otherwise only email codes work). */
  hasPassword: boolean;
  /** Two-factor login is turned on for this account. */
  totpEnabled: boolean;
  /** 2FA is on but this session hasn't entered an app code yet. */
  mfaPending: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

function secret(): string {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw Object.assign(new Error("SESSION_SECRET is missing or too short"), { code: "CONFIG_SESSION_SECRET" });
  return s;
}

const hmac = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export type CodeResult = { ok: true } | { ok: false; status: number; message: string };

/** Creates a login code and emails it. Limits: 3 per email per 15 min, 10 per IP per hour. */
export async function requestLoginCode(email: string, ip: string): Promise<CodeResult> {
  const recent = await selectOne<{ byEmail: number; byIp: number }>(
    `SELECT
       (SELECT COUNT(*) FROM login_codes WHERE email = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE) AS byEmail,
       (SELECT COUNT(*) FROM login_codes WHERE ip = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR) AS byIp`,
    [email, ip],
  );
  if (recent && (recent.byEmail >= 3 || recent.byIp >= 10)) {
    return { ok: false, status: 429, message: "অনেকবার কোড চাওয়া হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।" };
  }

  // A new code cancels any older unused ones, so only the latest email works.
  await execute("UPDATE login_codes SET used_at = UTC_TIMESTAMP() WHERE email = ? AND used_at IS NULL", [email]);
  const blocked = await selectOne<{ id: number }>("SELECT id FROM customers WHERE email = ? AND blocked_at IS NOT NULL", [email]);
  if (blocked) return { ok: false, status: 403, message: "এই অ্যাকাউন্টে লগইন বন্ধ আছে। আমাদের ফোন করুন।" };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await execute(
    "INSERT INTO login_codes (email, code_hash, ip, expires_at) VALUES (?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)",
    [email, hmac(`${email}:${code}`), ip, CODE_MINUTES],
  );
  try {
    await sendLoginCode(email, code);
  } catch (e) {
    console.error("[auth] login code email failed:", e instanceof Error ? e.message : e);
    return { ok: false, status: 502, message: "কোড পাঠানো যায়নি। ইমেইল ঠিকানা দেখে আবার চেষ্টা করুন।" };
  }
  return { ok: true };
}

export type VerifyResult = { ok: true; customer: Customer } | { ok: false; status: number; message: string };

/** Checks a code; on success creates the customer if new and starts a session cookie. */
export async function verifyLoginCode(email: string, code: string, userAgent: string): Promise<VerifyResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, status: 400, message: "৬ সংখ্যার কোড লিখুন।" };

  const row = await selectOne<{ id: number; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts FROM login_codes
     WHERE email = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
     ORDER BY id DESC LIMIT 1`,
    [email],
  );
  const wrong = { ok: false as const, status: 400, message: "কোডটি সঠিক নয় বা মেয়াদ শেষ। নতুন কোড চেয়ে নিন।" };
  if (!row) return wrong;
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, message: "অনেকবার ভুল কোড দেওয়া হয়েছে। নতুন কোড চেয়ে নিন।" };
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const given = Buffer.from(hmac(`${email}:${code}`), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await execute("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?", [row.id]);
    return wrong;
  }

  // Single use: only the request that flips used_at wins.
  const used = await execute("UPDATE login_codes SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL", [row.id]);
  if (used.affectedRows !== 1) return wrong;
  await execute("UPDATE login_codes SET used_at = UTC_TIMESTAMP() WHERE email = ? AND used_at IS NULL", [email]);

  await execute(
    "INSERT INTO customers (email, last_login_at) VALUES (?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE last_login_at = UTC_TIMESTAMP()",
    [email],
  );
  const customer = await customerByEmail(email);
  if (!customer) return { ok: false, status: 500, message: "অ্যাকাউন্ট খোলা যায়নি। আবার চেষ্টা করুন।" };
  await startSession(customer.id, userAgent, "code");
  return { ok: true, customer };
}

/** New session row + HttpOnly cookie. */
async function startSession(customerId: number, userAgent: string, method: "code" | "password"): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await execute(
    "INSERT INTO sessions (token_hash, customer_id, expires_at, user_agent, login_method) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? DAY, ?, ?)",
    [sha256(token), customerId, SESSION_DAYS, userAgent.slice(0, 200), method],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

// ---------- Password login ----------

const PW_FAILS_PER_EMAIL = 5; // per 15 minutes
const PW_FAILS_PER_IP = 20; // per 15 minutes

/**
 * Email + password. Same answer for "no account", "no password yet" and
 * "wrong password", so it can't be used to find out who has an account.
 */
export async function loginWithPassword(email: string, password: string, ip: string, userAgent: string): Promise<VerifyResult> {
  const fails = await selectOne<{ byEmail: number; byIp: number }>(
    `SELECT
       (SELECT COUNT(*) FROM login_failures WHERE email = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE) AS byEmail,
       (SELECT COUNT(*) FROM login_failures WHERE ip = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE) AS byIp`,
    [email, ip],
  );
  if (fails && (fails.byEmail >= PW_FAILS_PER_EMAIL || fails.byIp >= PW_FAILS_PER_IP)) {
    return { ok: false, status: 429, message: "অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে চেষ্টা করুন, অথবা ইমেইলে কোড নিয়ে লগইন করুন।" };
  }
  const row = await selectOne<{ id: number; password_hash: string | null; blocked_at: Date | null }>(
    "SELECT id, password_hash, blocked_at FROM customers WHERE email = ?",
    [email],
  );
  const ok = await verifyPassword(password, row?.password_hash ?? null);
  if (!ok || !row) {
    await execute("INSERT INTO login_failures (email, ip) VALUES (?, ?)", [email, ip]);
    return { ok: false, status: 400, message: "ইমেইল বা পাসওয়ার্ড মেলেনি। পাসওয়ার্ড সেট না করে থাকলে বা ভুলে গেলে ইমেইলে কোড নিন।" };
  }
  if (row.blocked_at) return { ok: false, status: 403, message: "এই অ্যাকাউন্টে লগইন বন্ধ আছে। আমাদের ফোন করুন।" };
  await execute("UPDATE customers SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [row.id]);
  await execute("DELETE FROM login_failures WHERE email = ?", [email]);
  const customer = await customerByEmail(email);
  if (!customer) return { ok: false, status: 500, message: "লগইন করা যায়নি। আবার চেষ্টা করুন।" };
  await startSession(customer.id, userAgent, "password");
  return { ok: true, customer };
}

export type PasswordResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Sets or changes the logged-in person's password. The current password is
 * needed, except right after an email-code login (first time / forgot password).
 * Other sessions are signed out; this one stays.
 */
export async function setOwnPassword(newPassword: string, currentPassword: string): Promise<PasswordResult> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, status: 401, message: "আগে লগইন করুন।" };
  const r = await selectOne<{ id: number; password_hash: string | null; fresh_code: number }>(
    `SELECT c.id, c.password_hash,
            (s.login_method = 'code' AND s.created_at > UTC_TIMESTAMP() - INTERVAL 30 MINUTE) AS fresh_code
     FROM sessions s JOIN customers c ON c.id = s.customer_id
     WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND c.blocked_at IS NULL`,
    [sha256(token)],
  );
  if (!r) return { ok: false, status: 401, message: "আগে লগইন করুন।" };
  const problem = passwordProblem(newPassword);
  if (problem) return { ok: false, status: 400, message: problem };
  if (r.password_hash && !Number(r.fresh_code) && !(await verifyPassword(currentPassword, r.password_hash))) {
    return { ok: false, status: 400, message: "বর্তমান পাসওয়ার্ড মেলেনি। ভুলে গেলে লগআউট করে ইমেইলে কোড নিয়ে লগইন করুন।" };
  }
  await execute("UPDATE customers SET password_hash = ?, password_set_at = UTC_TIMESTAMP() WHERE id = ?", [await hashPassword(newPassword), r.id]);
  await execute("DELETE FROM sessions WHERE customer_id = ? AND token_hash <> ?", [r.id, sha256(token)]);
  return { ok: true };
}

type CustomerRow = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  address_parts: unknown;
  role: string | null;
  blocked_at: Date | null;
  has_password?: number;
  totp_enabled_at?: Date | null;
  mfa_at?: Date | null;
};

/** Effective role: ADMIN_EMAILS always wins (so the owner can never lock themselves out). */
export function effectiveRole(email: string, dbRole: string | null): Role | null {
  if (isAdminEmail(email)) return "owner";
  return isRole(dbRole) ? dbRole : null;
}

function toCustomer(r: CustomerRow): Customer {
  const role = effectiveRole(r.email, r.role);
  let addressParts: unknown = r.address_parts;
  if (typeof addressParts === "string") { try { addressParts = JSON.parse(addressParts); } catch { addressParts = null; } }
  const totpEnabled = Boolean(r.totp_enabled_at);
  return {
    id: r.id, email: r.email, name: r.name, phone: r.phone, address: r.address, addressParts, role, isAdmin: role !== null,
    hasPassword: Boolean(Number(r.has_password ?? 0)), totpEnabled, mfaPending: totpEnabled && !r.mfa_at,
  };
}

async function customerByEmail(email: string): Promise<Customer | null> {
  const r = await selectOne<CustomerRow>("SELECT id, email, name, phone, address, address_parts, role, blocked_at, password_hash IS NOT NULL AS has_password FROM customers WHERE email = ?", [email]);
  return r ? toCustomer(r) : null;
}

/**
 * The logged-in customer, or null. Reads the session cookie (request time).
 * Wrapped in React cache(): the menu, the page and the gate all ask for it, but
 * the database is queried once per request.
 */
export const currentCustomer = cache(async (): Promise<Customer | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return customerBySession(sha256(token));
});

async function customerBySession(tokenHash: string): Promise<Customer | null> {
  const r = await selectOne<CustomerRow>(
    `SELECT c.id, c.email, c.name, c.phone, c.address, c.address_parts, c.role, c.blocked_at, c.password_hash IS NOT NULL AS has_password, c.totp_enabled_at, s.mfa_at
     FROM sessions s JOIN customers c ON c.id = s.customer_id
     WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()`,
    [tokenHash],
  );
  // A blocked account behaves as logged out everywhere.
  return r && !r.blocked_at ? toCustomer(r) : null;
}

/** SHA-256 of the current session token (to mark this session as 2FA-verified), or null. */
export async function currentSessionHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await execute("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Housekeeping: old codes and expired sessions. Cheap; called occasionally. */
export async function pruneAuthTables(): Promise<void> {
  await execute("DELETE FROM login_codes WHERE created_at < UTC_TIMESTAMP() - INTERVAL 2 DAY");
  await execute("DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()");
  await execute("DELETE FROM login_failures WHERE created_at < UTC_TIMESTAMP() - INTERVAL 1 DAY");
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

