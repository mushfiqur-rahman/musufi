"use client";

// The order form, shared by the product page (one item) and the cart (many):
// name, mobile, login (email code or password), structured address, coupon,
// totals and the order button. Prices shown here are for the customer only;
// /api/order recomputes everything from the database.

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { deliveryFee, type PublicConfig } from "@/lib/store-config";
import { bn, taka, type DeliveryZone } from "@/lib/site";
import { zoneForDistrict } from "@/lib/geo";
import { AddressPicker, checkAddress, emptyAddress, type AddressErrors, type AddressValue } from "./address-picker";

const BN = "০১২৩৪৫৬৭৮৯";
const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
const BD_MOBILE = /^01[3-9]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** One product line to order. */
export type CheckoutItem = { slug: string; variant: number; qty: number; name: string; label: string; price: number };

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "ok"; text: string } | { kind: "bad"; text: string } | { kind: "info"; text: string };
type Me = { email: string; name: string | null; phone: string | null; address: string | null; addressParts?: AddressValue | null };

async function postJson(url: string, data: unknown): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

export function CheckoutForm({ items, zones, config, disabled = false, onPlaced, formId = "order" }: {
  items: CheckoutItem[];
  /** Zones every item can be delivered to. */
  zones: DeliveryZone[];
  config: PublicConfig;
  /** E.g. the chosen size is sold out. */
  disabled?: boolean;
  /** Called with the confirmation text after the order is saved (the cart empties itself). */
  onPlaced?: (message: string) => void;
  /** DOM id, so "অর্ডার করুন" buttons can link to #order. */
  formId?: string;
}) {
  const id = useId();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Who is logged in. Pages are static, so this is asked after load.
  const [me, setMe] = useState<Me | null>(null);
  const [fields, setFields] = useState({ name: "", phone: "", email: "" });
  const [addr, setAddr] = useState<AddressValue>(emptyAddress);
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "email", string>>>({});
  const [addrErrors, setAddrErrors] = useState<AddressErrors>({});
  const [step, setStep] = useState<"form" | "code">("form");
  // Returning customers may log in with their password instead of an email code.
  const [usePw, setUsePw] = useState(false);
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  // Coupon: what the customer typed, and the server's preview of it.
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; message: string } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { customer: Me | null }) => {
        if (!alive || !d.customer) return;
        setMe(d.customer);
        setFields((f) => ({
          name: f.name || d.customer!.name || "",
          phone: f.phone || d.customer!.phone || "",
          email: d.customer!.email,
        }));
        // Pre-fill the saved structured address, if any.
        if (d.customer.addressParts) setAddr((a) => (a.divisionId ? a : { ...emptyAddress, ...d.customer!.addressParts }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  const lines = items.map(({ slug, variant, qty }) => ({ slug, variant, qty }));
  // The delivery zone follows the chosen district (Dhaka district = inside Dhaka).
  const zone: DeliveryZone | null = addr.districtId ? zoneForDistrict(addr.districtId, config.dhakaDistrictIds) : null;
  const zoneAllowed = zone === null || zones.includes(zone);
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const fee = zone ? deliveryFee(config, zone, subtotal) : 0;
  const discount = coupon ? Math.min(coupon.discount, subtotal + fee) : 0;
  const total = subtotal + fee - discount;
  const busy = status.kind === "sending";
  const empty = items.length === 0;

  async function applyCoupon() {
    const c = couponInput.trim();
    if (!c || empty) return;
    setCouponMsg(null);
    try {
      const r = await postJson("/api/coupon", { code: c, items: lines, districtId: addr.districtId || null });
      if (r.ok && r.body.ok) {
        setCoupon({ code: c.toUpperCase(), discount: Number(r.body.discount), message: String(r.body.message) });
        setCouponMsg({ ok: true, text: String(r.body.message) });
      } else {
        setCoupon(null);
        setCouponMsg({ ok: false, text: String(r.body.message ?? "কুপন কাজ করেনি।") });
      }
    } catch {
      setCouponMsg({ ok: false, text: "ইন্টারনেট সংযোগ পাওয়া যায়নি।" });
    }
  }

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  function check(): boolean {
    const phone = toLatinDigits(fields.phone).replace(/\D/g, "");
    const e: typeof errors = {};
    if (fields.name.trim().length < 2) e.name = "আপনার নাম দিন।";
    if (!BD_MOBILE.test(phone)) e.phone = "১১ সংখ্যার মোবাইল নম্বর দিন, যেমন ০১৭১২৩৪৫৬৭৮";
    if (!me && !EMAIL_RE.test(fields.email.trim())) e.email = "সঠিক ইমেইল ঠিকানা দিন, যেমন name@gmail.com";
    const ae = checkAddress(addr);
    setErrors(e);
    setAddrErrors(ae);
    const first = (["name", "phone"] as const).find((k) => e[k]) ?? (Object.keys(ae)[0] as keyof AddressValue | undefined) ?? (e.email ? "email" : undefined);
    if (first) document.getElementById(`${id}-${first}`)?.focus();
    if (first) return false;
    if (!zoneAllowed) {
      setStatus({ kind: "bad", text: "এই ঠিকানায় সব পণ্য পাঠানো যায় না (মাছ শুধু ঢাকার ভেতরে)। ঢাকার ঠিকানা দিন বা সেই পণ্য সরিয়ে দিন।" });
      return false;
    }
    return true;
  }

  async function placeOrder() {
    setStatus({ kind: "sending" });
    try {
      const r = await postJson("/api/order", {
        items: lines,
        name: fields.name.trim(),
        phone: toLatinDigits(fields.phone).replace(/\D/g, ""),
        address: {
          divisionId: addr.divisionId, districtId: addr.districtId, upazilaId: addr.upazilaId,
          localId: addr.localId === "" ? null : addr.localId, line: addr.line.trim(),
        },
        website: (document.getElementById(`${id}-web`) as HTMLInputElement | null)?.value ?? "",
        coupon: coupon?.code ?? "",
      });
      if (r.body.field === "coupon") { setCoupon(null); setCouponMsg({ ok: false, text: String(r.body.message) }); }
      if (r.status === 401) { setMe(null); setStep("form"); setStatus({ kind: "bad", text: String(r.body.message ?? "আবার লগইন করুন।") }); return; }
      if (r.ok) {
        setStatus({ kind: "ok", text: String(r.body.message) });
        onPlaced?.(String(r.body.message));
      } else {
        setStatus({ kind: "bad", text: String(r.body.message ?? "অর্ডার পাঠানো যায়নি। হোয়াটসঅ্যাপে বা ফোনে অর্ডার করুন।") });
      }
    } catch {
      setStatus({ kind: "bad", text: "ইন্টারনেট সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন বা ফোনে অর্ডার করুন।" });
    }
  }

  async function requestCode() {
    setStatus({ kind: "sending" });
    try {
      const r = await postJson("/api/auth/request-code", { email: fields.email.trim() });
      if (!r.ok) { setStatus({ kind: "bad", text: String(r.body.message) }); return; }
      setCode("");
      setStep("code");
      setStatus({ kind: "info", text: String(r.body.message) });
    } catch {
      setStatus({ kind: "bad", text: "ইন্টারনেট সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন।" });
    }
  }

  async function passwordLoginThenOrder() {
    setStatus({ kind: "sending" });
    try {
      const r = await postJson("/api/auth/password", { email: fields.email.trim(), password: pw });
      if (!r.ok) { setStatus({ kind: "bad", text: String(r.body.message) }); return; }
      setMe((r.body.customer as Me) ?? { email: fields.email.trim(), name: null, phone: null, address: null });
      setPw("");
      await placeOrder();
    } catch {
      setStatus({ kind: "bad", text: "ইন্টারনেট সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন।" });
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || status.kind === "ok" || empty) return;
    if (step === "code") {
      setStatus({ kind: "sending" });
      try {
        const r = await postJson("/api/auth/verify", { email: fields.email.trim(), code });
        if (!r.ok) { setStatus({ kind: "bad", text: String(r.body.message) }); return; }
        setMe((r.body.customer as Me) ?? { email: fields.email.trim(), name: null, phone: null, address: null });
        setStep("form");
        await placeOrder();
      } catch {
        setStatus({ kind: "bad", text: "ইন্টারনেট সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন।" });
      }
      return;
    }
    if (!check()) return;
    if (me) await placeOrder();
    else if (usePw) await passwordLoginThenOrder();
    else await requestCode();
  }

  async function switchAccount() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMe(null);
    setFields((f) => ({ ...f, email: "" }));
    setStatus({ kind: "idle" });
  }

  const err = (k: keyof typeof errors) => errors[k] ? <span className="err" id={`${id}-${k}-err`}>{errors[k]}</span> : null;
  const described = (k: keyof typeof errors, hint?: string) => [hint, errors[k] ? `${id}-${k}-err` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form className="order" id={formId} onSubmit={onSubmit} noValidate aria-labelledby={`${id}-oh`}>
      {/* Spam trap: hidden from people and screen readers; bots tend to fill it. */}
      <div className="sr-only-x" aria-hidden="true">
        <label htmlFor={`${id}-web`}>Website</label>
        <input id={`${id}-web`} name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <h2 id={`${id}-oh`}>অর্ডারের তথ্য দিন</h2>

      {me && (
        <p className="signed-in">
          লগইন করা আছে: <b>{me.email}</b> · <button type="button" className="linkish" onClick={switchAccount}>অন্য ইমেইল</button>
        </p>
      )}

      <fieldset disabled={step === "code" || status.kind === "ok"} className="order-fields">
        <div className="field">
          <label htmlFor={`${id}-name`}>আপনার নাম</label>
          <input id={`${id}-name`} value={fields.name} onChange={set("name")} autoComplete="name" aria-invalid={!!errors.name} aria-describedby={described("name")} />
          {err("name")}
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>মোবাইল নম্বর</label>
          <input id={`${id}-phone`} value={fields.phone} onChange={set("phone")} type="tel" inputMode="numeric" autoComplete="tel" placeholder="০১XXXXXXXXX" aria-invalid={!!errors.phone} aria-describedby={described("phone", `${id}-ph`)} />
          <span className="hint" id={`${id}-ph`}>এই নম্বরে ফোন করে অর্ডার নিশ্চিত করব</span>
          {err("phone")}
        </div>
        {!me && (
          <div className="field">
            <label htmlFor={`${id}-email`}>ইমেইল</label>
            <input id={`${id}-email`} value={fields.email} onChange={set("email")} type="email" inputMode="email" autoComplete="email" placeholder="name@gmail.com" aria-invalid={!!errors.email} aria-describedby={described("email", `${id}-eh`)} />
            <span className="hint" id={`${id}-eh`}>{usePw ? "আপনার অ্যাকাউন্টের ইমেইল।" : "এই ইমেইলে একটি কোড যাবে। এতে আপনার অ্যাকাউন্ট খুলবে, পরে অর্ডারের অবস্থা দেখতে পারবেন।"}</span>
            {err("email")}
          </div>
        )}
        {!me && (
          <label className="mini-field check pw-choice">
            <input type="checkbox" checked={usePw} onChange={(e) => setUsePw(e.target.checked)} />
            <span>আমার পাসওয়ার্ড আছে</span>
          </label>
        )}
        {!me && usePw && (
          <div className="field">
            <label htmlFor={`${id}-pw`}>পাসওয়ার্ড</label>
            <input id={`${id}-pw`} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} maxLength={128} />
          </div>
        )}
        <AddressPicker id={id} config={config} value={addr} onChange={(a) => { setAddr(a); setAddrErrors({}); }} errors={addrErrors} />
        {!zones.includes("outside") && <p className="zone-note">{items.length > 1 ? "কার্টের কিছু পণ্য" : "এই পণ্য"} এখন শুধু ঢাকার ভেতরে ডেলিভারি হয়।</p>}
        {!zoneAllowed && <p className="notice bad" role="alert">এই ঠিকানায় সব পণ্য পাঠানো যায় না। ঢাকা জেলার ঠিকানা দিন।</p>}
      </fieldset>

      <details className="coupon-box" open={Boolean(coupon)}>
        <summary>কুপন কোড আছে?</summary>
        <div className="coupon-row">
          <label className="sr-only-x" htmlFor={`${id}-coupon`}>কুপন কোড</label>
          <input id={`${id}-coupon`} value={couponInput} onChange={(e) => { setCouponInput(e.target.value); if (coupon) setCoupon(null); }} placeholder="যেমন: EID10" autoCapitalize="characters" maxLength={30} />
          <button type="button" className="btn btn-ghost" onClick={applyCoupon} disabled={!couponInput.trim()}>প্রয়োগ করুন</button>
        </div>
        {couponMsg && <p className={`notice ${couponMsg.ok ? "ok" : "bad"}`} role="status">{couponMsg.text}</p>}
      </details>

      <div className="total num" aria-live="polite">
        {items.map((it) => (
          <div key={`${it.slug}-${it.variant}`}><span>{it.name} {it.label} × {bn(it.qty)}</span><span>{taka(it.price * it.qty)}</span></div>
        ))}
        <div><span>ডেলিভারি</span><span>{zone ? taka(fee) : "জেলা বেছে নিলে দেখাবে"}</span></div>
        {discount > 0 && <div className="discount"><span>কুপন {coupon?.code}</span><span>−{taka(discount)}</span></div>}
        <div className="grand"><span>মোট, হাতে পেয়ে দিবেন</span><span>{taka(total)}</span></div>
      </div>

      {step === "code" && (
        <div className="code-step">
          <div className="field">
            <label htmlFor={`${id}-code`}>ইমেইলে পাওয়া ৬ সংখ্যার কোড</label>
            <input
              ref={codeRef}
              id={`${id}-code`}
              value={code}
              onChange={(e) => setCode(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="______"
              className="code-input num"
            />
          </div>
          <p className="code-links">
            <button type="button" className="linkish" onClick={requestCode} disabled={busy}>নতুন কোড পাঠান</button>
            {" · "}
            <button type="button" className="linkish" onClick={() => { setStep("form"); setStatus({ kind: "idle" }); }}>ইমেইল বদলান</button>
          </p>
        </div>
      )}

      <button className="btn btn-primary btn-lg" type="submit" disabled={busy || disabled || empty || status.kind === "ok" || (step === "code" && code.length !== 6) || (!me && usePw && step === "form" && !pw)}>
        {busy ? "অপেক্ষা করুন..." : step === "code" ? "কোড মিলিয়ে অর্ডার করুন" : me ? "অর্ডার নিশ্চিত করুন" : usePw ? "লগইন করে অর্ডার করুন" : "কোড পাঠিয়ে অর্ডার করুন"}
      </button>
      {(status.kind === "ok" || status.kind === "bad" || status.kind === "info") && (
        <p className={`notice ${status.kind === "info" ? "ok" : status.kind}`} role="status">
          {status.text}
          {status.kind === "ok" && <> <Link href="/account">আমার অর্ডার দেখুন</Link></>}
        </p>
      )}
    </form>
  );
}
