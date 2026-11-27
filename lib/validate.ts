// Small input validators shared by every admin form and API.
// Server actions are public endpoints: never trust the browser, always parse here.

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Converts Bangla digits to Latin, e.g. "৭০০" → "700". */
export function latinDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export class ValidationError extends Error {
  readonly code = "INVALID";
  constructor(readonly field: string, message: string) {
    super(message);
  }
}

/** Trimmed string with length limits. `required` rejects empty. */
export function text(v: unknown, field: string, opts: { max: number; min?: number; required?: boolean }): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (opts.required && !s) throw new ValidationError(field, `${field}: দিতে হবে`);
  if (s.length > opts.max) throw new ValidationError(field, `${field}: সর্বোচ্চ ${opts.max} অক্ষর`);
  if (opts.min && s.length > 0 && s.length < opts.min) throw new ValidationError(field, `${field}: কমপক্ষে ${opts.min} অক্ষর`);
  return s;
}

/** Same as text(), but empty → null. */
export function optionalText(v: unknown, field: string, max: number): string | null {
  return text(v, field, { max }) || null;
}

/** Whole number in range; accepts Bangla digits, commas and ৳. Empty → null unless required. */
export function wholeNumber(v: unknown, field: string, opts: { min?: number; max: number; required?: boolean }): number | null {
  const raw = latinDigits(String(v ?? "")).replace(/[,\s৳]/g, "");
  if (raw === "") {
    if (opts.required) throw new ValidationError(field, `${field}: দিতে হবে`);
    return null;
  }
  const n = Number(raw);
  const min = opts.min ?? 0;
  if (!Number.isInteger(n) || n < min || n > opts.max) throw new ValidationError(field, `${field}: ${min} থেকে ${opts.max}-এর মধ্যে পূর্ণ সংখ্যা দিন`);
  return n;
}

/** URL slug: lowercase latin letters, digits and hyphens. */
export function slug(v: unknown, field = "স্লাগ"): string {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) || s.length > 80) {
    throw new ValidationError(field, `${field}: শুধু ছোট হাতের ইংরেজি অক্ষর, সংখ্যা আর হাইফেন, যেমন padma-hilsa`);
  }
  return s;
}

/** One of a fixed list. */
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  throw new ValidationError(field, `${field}: সঠিক মান বেছে নিন`);
}

/** Parses a JSON payload produced by an admin form (hidden input). */
export function jsonPayload<T>(v: unknown, field: string): T {
  if (typeof v !== "string" || v.length > 200_000) throw new ValidationError(field, `${field}: তথ্য পাওয়া যায়নি`);
  try {
    return JSON.parse(v) as T;
  } catch {
    throw new ValidationError(field, `${field}: তথ্য পড়া যায়নি`);
  }
}

/** List of {q,a} pairs; empty rows are dropped. */
export function qaList(v: unknown, field: string, maxItems = 20): { q: string; a: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({ q: text((x as { q?: unknown })?.q, field, { max: 200 }), a: text((x as { a?: unknown })?.a, field, { max: 2000 }) }))
    .filter((x) => x.q && x.a)
    .slice(0, maxItems);
}

/** List of {label,value} pairs; empty rows are dropped. */
export function factList(v: unknown, field: string, maxItems = 30): { label: string; value: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => ({ label: text((x as { label?: unknown })?.label, field, { max: 60 }), value: text((x as { value?: unknown })?.value, field, { max: 300 }) }))
    .filter((x) => x.label && x.value)
    .slice(0, maxItems);
}

/** "2026-12-01T09:30" in Dhaka time → UTC Date, or null when empty. */
export function dhakaDateTimeLocal(v: unknown, field: string): Date | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) throw new ValidationError(field, `${field}: সঠিক তারিখ ও সময় দিন`);
  const d = new Date(`${s}:00+06:00`);
  if (Number.isNaN(d.getTime())) throw new ValidationError(field, `${field}: সঠিক তারিখ ও সময় দিন`);
  return d;
}

/** Result type returned by admin server actions to their forms. */
export type ActionResult = { ok: true; message: string; id?: number | string } | { ok: false; message: string; field?: string };

/** Turns any thrown error into a safe ActionResult (details are logged, not shown). */
export function actionError(where: string, e: unknown): ActionResult {
  if (e instanceof ValidationError) return { ok: false, message: e.message, field: e.field };
  const code = (e as { code?: unknown })?.code;
  if (code === "FORBIDDEN") return { ok: false, message: "এই কাজের অনুমতি আপনার নেই।" };
  if (code === "ER_DUP_ENTRY") return { ok: false, message: "একই স্লাগ বা SKU আগে থেকেই আছে। অন্য একটি দিন।" };
  console.error(`[${where}]`, e instanceof Error ? e.message : e);
  return { ok: false, message: "সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।" };
}
