"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { Variant } from "@/lib/products";
import { bn, site, taka, whatsappLink, type DeliveryZone } from "@/lib/site";
import { PhoneIcon, WhatsAppIcon } from "./icons";

const BN = "০১২৩৪৫৬৭৮৯";
const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
const BD_MOBILE = /^01[3-9]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "ok"; text: string } | { kind: "bad"; text: string } | { kind: "info"; text: string };
type Me = { email: string; name: string | null; phone: string | null; address: string | null };

async function postJson(url: string, data: unknown): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, body };
}

export function BuyBox({ slug, name, variants, defaultVariant, zones }: { slug: string; name: string; variants: Variant[]; defaultVariant: number; zones: DeliveryZone[] }) {
  const [sel, setSel] = useState(defaultVariant);
  const [qty, setQty] = useState(1);
  const [zone, setZone] = useState<DeliveryZone>(zones[0] ?? "dhaka");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const id = useId();

  // Who is logged in. Product pages are static, so this is asked after load.
  const [me, setMe] = useState<Me | null>(null);
  const [fields, setFields] = useState({ name: "", phone: "", address: "", email: "" });
  const [errors, setErrors] = useState<Partial<Record<"name" | "phone" | "address" | "email", string>>>({});
  const [step, setStep] = useState<"form" | "code">("form");
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.classList.add("has-buybar");
    return () => document.body.classList.remove("has-buybar");
  }, []);

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
          address: f.address || d.customer!.address || "",
          email: d.customer!.email,
        }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  const v = variants[sel];
  const fee = site.delivery[zone].fee;
  const subtotal = v.price * qty;
  const total = subtotal + fee;
  const busy = status.kind === "sending";
  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  function check(): boolean {
    const phone = toLatinDigits(fields.phone).replace(/\D/g, "");
    const e: typeof errors = {};
    if (fields.name.trim().length < 2) e.name = "আপনার নাম দিন।";
    if (!BD_MOBILE.test(phone)) e.phone = "১১ সংখ্যার মোবাইল নম্বর দিন, যেমন ০১৭১২৩৪৫৬৭৮";
    if (fields.address.trim().length < 10) e.address = "বাসা, রাস্তা, এলাকা আর জেলাসহ পুরো ঠিকানা দিন।";
    if (!me && !EMAIL_RE.test(fields.email.trim())) e.email = "সঠিক ইমেইল ঠিকানা দিন, যেমন name@gmail.com";
    setErrors(e);
    const first = (["name", "phone", "address", "email"] as const).find((k) => e[k]);
    if (first) document.getElementById(`${id}-${first}`)?.focus();
    return !first;
  }

  async function placeOrder() {
    setStatus({ kind: "sending" });
    try {
      const r = await postJson("/api/order", {
        slug, variant: sel, qty, zone,
        name: fields.name.trim(),
        phone: toLatinDigits(fields.phone).replace(/\D/g, ""),
        address: fields.address.trim(),
        website: (document.getElementById(`${id}-web`) as HTMLInputElement | null)?.value ?? "",
      });
      if (r.status === 401) { setMe(null); setStep("form"); setStatus({ kind: "bad", text: String(r.body.message ?? "আবার লগইন করুন।") }); return; }
      setStatus(r.ok ? { kind: "ok", text: String(r.body.message) } : { kind: "bad", text: String(r.body.message ?? "অর্ডার পাঠানো যায়নি। হোয়াটসঅ্যাপে বা ফোনে অর্ডার করুন।") });
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || status.kind === "ok") return;
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
    else await requestCode();
  }

  async function switchAccount() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMe(null);
    setFields((f) => ({ ...f, email: "" }));
    setStatus({ kind: "idle" });
  }

  const waText = `আসসালামু আলাইকুম, আমি অর্ডার করতে চাই: ${name} ${v.label} × ${bn(qty)}`;
  const err = (k: keyof typeof errors) => errors[k] ? <span className="err" id={`${id}-${k}-err`}>{errors[k]}</span> : null;
  const described = (k: keyof typeof errors, hint?: string) => [hint, errors[k] ? `${id}-${k}-err` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <div>
        <p className="big-price num">
          <b>{taka(v.price)}</b>
          {v.compareAt && (
            <>
              <s aria-label={`আগের দাম ${taka(v.compareAt)}`}>{taka(v.compareAt)}</s>
              <span className="save">{taka(v.compareAt - v.price)} সাশ্রয়</span>
            </>
          )}
        </p>
        <p className="unit">{v.label}</p>
      </div>

      {variants.length > 1 && (
        <fieldset>
          <legend>পরিমাণ বেছে নিন</legend>
          <div className="sizes lg">
            {variants.map((x, i) => (
              <button key={x.label} type="button" aria-pressed={i === sel} onClick={() => setSel(i)}>
                {x.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="qty-row">
        <span id={`${id}-q`} style={{ fontWeight: 600 }}>সংখ্যা</span>
        <div className="qty" role="group" aria-labelledby={`${id}-q`}>
          <button type="button" aria-label="একটি কমান" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <output className="num" aria-live="polite">{bn(qty)}</output>
          <button type="button" aria-label="একটি বাড়ান" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
        </div>
      </div>

      <div className="actions">
        <a className="btn btn-primary btn-lg" href="#order">এখনই অর্ডার করুন</a>
        <a className="btn btn-wa" href={whatsappLink(waText)} target="_blank" rel="noopener"><WhatsAppIcon />হোয়াটসঅ্যাপ</a>
        <a className="btn btn-ghost" href={`tel:${site.phone}`}><PhoneIcon />কল করুন</a>
      </div>

      <form className="order" id="order" onSubmit={onSubmit} noValidate aria-labelledby={`${id}-oh`}>
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
          <div className="field">
            <label htmlFor={`${id}-address`}>পুরো ঠিকানা</label>
            <textarea id={`${id}-address`} value={fields.address} onChange={set("address")} autoComplete="street-address" placeholder="বাসা, রাস্তা, এলাকা, থানা, জেলা" aria-invalid={!!errors.address} aria-describedby={described("address")} />
            {err("address")}
          </div>
          {!me && (
            <div className="field">
              <label htmlFor={`${id}-email`}>ইমেইল</label>
              <input id={`${id}-email`} value={fields.email} onChange={set("email")} type="email" inputMode="email" autoComplete="email" placeholder="name@gmail.com" aria-invalid={!!errors.email} aria-describedby={described("email", `${id}-eh`)} />
              <span className="hint" id={`${id}-eh`}>এই ইমেইলে একটি কোড যাবে। এতে আপনার অ্যাকাউন্ট খুলবে, পরে অর্ডারের অবস্থা দেখতে পারবেন।</span>
              {err("email")}
            </div>
          )}
          <fieldset className="field">
            <legend>ডেলিভারি এলাকা</legend>
            <div className="zones">
              {(Object.keys(site.delivery) as DeliveryZone[]).map((z) => (
                <label key={z}>
                  <input type="radio" name="zone" value={z} checked={zone === z} disabled={!zones.includes(z)} onChange={() => setZone(z)} />
                  <span>{site.delivery[z].label} · <span className="num">{taka(site.delivery[z].fee)}</span></span>
                  <small>{site.delivery[z].days}</small>
                </label>
              ))}
            </div>
            {!zones.includes("outside") && <p className="zone-note">এই পণ্য এখন শুধু ঢাকার ভেতরে ডেলিভারি হয়।</p>}
          </fieldset>
        </fieldset>

        <div className="total num" aria-live="polite">
          <div><span>{name} {v.label} × {bn(qty)}</span><span>{taka(subtotal)}</span></div>
          <div><span>ডেলিভারি</span><span>{taka(fee)}</span></div>
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

        <button className="btn btn-primary btn-lg" type="submit" disabled={busy || status.kind === "ok" || (step === "code" && code.length !== 6)}>
          {busy ? "অপেক্ষা করুন..." : step === "code" ? "কোড মিলিয়ে অর্ডার করুন" : me ? "অর্ডার নিশ্চিত করুন" : "কোড পাঠিয়ে অর্ডার করুন"}
        </button>
        {(status.kind === "ok" || status.kind === "bad" || status.kind === "info") && (
          <p className={`notice ${status.kind === "info" ? "ok" : status.kind}`} role="status">
            {status.text}
            {status.kind === "ok" && <> <Link href="/account">আমার অর্ডার দেখুন</Link></>}
          </p>
        )}
      </form>

      <div className="buybar" aria-label="দ্রুত অর্ডার">
        <div className="wrap">
          <div><b className="num">{taka(v.price * qty)}</b><small>{v.label}{qty > 1 ? ` × ${bn(qty)}` : ""}</small></div>
          <a className="btn btn-primary" href="#order">অর্ডার করুন</a>
        </div>
      </div>
    </>
  );
}
