// Time-based one-time passwords (RFC 6238, the codes in Google Authenticator and
// similar apps), plus encryption of the secret at rest. Server-only, no
// dependencies: Node's crypto does HMAC-SHA1 and AES-256-GCM.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** New random secret (160 bits), base32 for authenticator apps. */
export function newSecret(): string {
  return base32Encode(randomBytes(20));
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

export function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Checks a code, allowing one step of clock drift either way. Returns the
 * matched step, or null. Steps at or before `lastStep` are refused, so a code
 * can't be used twice.
 */
export function verifyCode(secret: string, code: string, lastStep: number | null, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const s = currentStep(now);
  for (const step of [s - 1, s, s + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const a = Buffer.from(codeAt(secret, step));
    const b = Buffer.from(code);
    if (a.length === b.length && timingSafeEqual(a, b)) return step;
  }
  return null;
}

/** otpauth:// link; opening it on the phone adds the account to the app. */
export function otpauthUri(secret: string, account: string, issuer = "Musufi"): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// ---------- Encryption at rest ----------

function key(): Buffer {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw Object.assign(new Error("SESSION_SECRET is missing or too short"), { code: "CONFIG_SESSION_SECRET" });
  return createHash("sha256").update(`totp:${s}`).digest();
}

/** "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, enc] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("Bad TOTP secret format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}
