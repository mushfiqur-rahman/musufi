// Password hashing with scrypt (built into Node, no native npm package, so it
// builds on Hostinger). Server-only.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))));

// N=2^15, r=8, p=1: ~32 MB and roughly 50-100 ms per hash on shared hosting.
const PARAMS = { N: 32768, r: 8, p: 1 };
const KEYLEN = 32;
const maxmem = 64 * 1024 * 1024;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Bangla message if the password is too weak, else null. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `পাসওয়ার্ড কমপক্ষে ${PASSWORD_MIN.toLocaleString("bn-BD")} অক্ষরের দিন।`;
  if (pw.length > PASSWORD_MAX) return "পাসওয়ার্ড অনেক লম্বা।";
  if (/^\d+$/.test(pw) || /^(.)\1+$/.test(pw)) return "শুধু সংখ্যা বা একই অক্ষর বারবার দিয়ে পাসওয়ার্ড হবে না।";
  return null;
}

/** "scrypt$N$r$p$<salt b64url>$<hash b64url>" */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize("NFKC"), salt, KEYLEN, { ...PARAMS, maxmem });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    // Same work as a real check, so a missing account isn't faster to detect.
    await scrypt(pw, randomBytes(16), KEYLEN, { ...PARAMS, maxmem });
    return false;
  }
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(pw.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem });
  return timingSafeEqual(key, expected);
}
