// Staff two-factor login: enrolment, per-session verification, reset. Server-only.
import { currentSessionHash } from "./auth";
import { execute, selectOne } from "./db";
import { decryptSecret, encryptSecret, newSecret, verifyCode } from "./totp";

type Row = { totp_secret: string | null; totp_enabled_at: Date | null; totp_last_step: number | null };

async function row(customerId: number): Promise<Row | null> {
  return selectOne<Row>("SELECT totp_secret, totp_enabled_at, totp_last_step FROM customers WHERE id = ?", [customerId]);
}

/** Marks the current browser session as having passed 2FA. */
async function markSessionVerified(): Promise<void> {
  const h = await currentSessionHash();
  if (h) await execute("UPDATE sessions SET mfa_at = UTC_TIMESTAMP() WHERE token_hash = ?", [h]);
}

/**
 * Step 1 of enrolment: creates (or reuses) a pending secret and returns it so
 * the person can add it to their authenticator app. Not active until confirmed.
 */
export async function startEnrolment(customerId: number): Promise<string> {
  const r = await row(customerId);
  if (r?.totp_enabled_at) throw new Error("already enabled");
  if (r?.totp_secret) return decryptSecret(r.totp_secret);
  const secret = newSecret();
  await execute("UPDATE customers SET totp_secret = ? WHERE id = ?", [encryptSecret(secret), customerId]);
  return secret;
}

/** The not-yet-confirmed secret, if enrolment has started (shown on the setup page). */
export async function pendingSecret(customerId: number): Promise<string | null> {
  const r = await row(customerId);
  return r?.totp_secret && !r.totp_enabled_at ? decryptSecret(r.totp_secret) : null;
}

/** Drops an unconfirmed secret (the "cancel" button during setup). */
export async function cancelEnrolment(customerId: number): Promise<void> {
  await execute("UPDATE customers SET totp_secret = NULL WHERE id = ? AND totp_enabled_at IS NULL", [customerId]);
}

/** Step 2: the first correct app code turns 2FA on and verifies this session. */
export async function confirmEnrolment(customerId: number, code: string): Promise<boolean> {
  const r = await row(customerId);
  if (!r?.totp_secret || r.totp_enabled_at) return false;
  const step = verifyCode(decryptSecret(r.totp_secret), code, r.totp_last_step);
  if (step === null) return false;
  await execute("UPDATE customers SET totp_enabled_at = UTC_TIMESTAMP(), totp_last_step = ? WHERE id = ?", [step, customerId]);
  await markSessionVerified();
  return true;
}

/** Per-login check. Each code works once (totp_last_step). */
export async function verifySession(customerId: number, code: string): Promise<boolean> {
  const r = await row(customerId);
  if (!r?.totp_secret || !r.totp_enabled_at) return false;
  const step = verifyCode(decryptSecret(r.totp_secret), code, r.totp_last_step);
  if (step === null) return false;
  // Guarded update: two simultaneous submissions of the same code can't both win.
  const u = await execute(
    "UPDATE customers SET totp_last_step = ? WHERE id = ? AND (totp_last_step IS NULL OR totp_last_step < ?)",
    [step, customerId, step],
  );
  if (u.affectedRows !== 1) return false;
  await markSessionVerified();
  return true;
}

/** Turns 2FA off (needs a valid code from the person themself). */
export async function disableWithCode(customerId: number, code: string): Promise<boolean> {
  if (!(await verifySession(customerId, code))) return false;
  await clearTotp(customerId);
  return true;
}

function clearTotp(customerId: number) {
  return execute("UPDATE customers SET totp_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = ?", [customerId]);
}

/** Owner reset, e.g. a lost phone. Ends the person's sessions too. */
export async function reset(customerId: number): Promise<void> {
  await clearTotp(customerId);
  await execute("DELETE FROM sessions WHERE customer_id = ?", [customerId]);
}

/** Wrong-code throttle: at most 6 attempts per account per 10 minutes (in memory). */
const attempts = new Map<number, number[]>();
export function tooManyAttempts(customerId: number): boolean {
  const now = Date.now();
  const list = (attempts.get(customerId) ?? []).filter((t) => now - t < 600_000);
  list.push(now);
  attempts.set(customerId, list);
  return list.length > 6;
}

/** App codes as typed: strips spaces, accepts Bangla digits. */
export function normalizeCode(v: unknown): string {
  return String(v ?? "").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\s+/g, "");
}
