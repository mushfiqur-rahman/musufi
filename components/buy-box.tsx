"use client";

import { useEffect, useId, useState } from "react";
import type { Variant } from "@/lib/products";
import { bn, site, taka, whatsappLink, type DeliveryZone } from "@/lib/site";
import { PhoneIcon, WhatsAppIcon } from "./icons";

const BN = "০১২৩৪৫৬৭৮৯";
const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
const BD_MOBILE = /^01[3-9]\d{8}$/;

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "ok"; text: string } | { kind: "bad"; text: string };

export function BuyBox({ slug, name, variants, defaultVariant, zones }: { slug: string; name: string; variants: Variant[]; defaultVariant: number; zones: DeliveryZone[] }) {
  const [sel, setSel] = useState(defaultVariant);
  const [qty, setQty] = useState(1);
  const [zone, setZone] = useState<DeliveryZone>(zones[0] ?? "dhaka");
  const [phoneErr, setPhoneErr] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const id = useId();

  const v = variants[sel];
  const fee = site.delivery[zone].fee;
  const subtotal = v.price * qty;
  const total = subtotal + fee;

  // Leave room for the sticky mobile buy bar.
  useEffect(() => {
    document.body.classList.add("has-buybar");
    return () => document.body.classList.remove("has-buybar");
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const phone = toLatinDigits(String(data.get("phone") ?? "")).replace(/\D/g, "");
    const bad = !BD_MOBILE.test(phone);
    setPhoneErr(bad);
    if (bad) {
      (form.elements.namedItem("phone") as HTMLInputElement).focus();
      return;
    }
    if (!form.reportValidity()) return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          variant: sel,
          qty,
          zone,
          name: String(data.get("name") ?? "").trim(),
          phone,
          address: String(data.get("address") ?? "").trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setStatus(res.ok ? { kind: "ok", text: body.message ?? "অর্ডার পাওয়া গেছে। আমরা শিগগিরই ফোন করব।" } : { kind: "bad", text: body.message ?? "অর্ডার পাঠানো যায়নি। হোয়াটসঅ্যাপে বা ফোনে অর্ডার করুন।" });
    } catch {
      setStatus({ kind: "bad", text: "ইন্টারনেট সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন বা ফোনে অর্ডার করুন।" });
    }
  }

  const waText = `আসসালামু আলাইকুম, আমি অর্ডার করতে চাই: ${name} ${v.label} × ${bn(qty)}`;

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
        <h2 id={`${id}-oh`}>অর্ডারের তথ্য দিন</h2>
        <div className="field">
          <label htmlFor={`${id}-name`}>আপনার নাম</label>
          <input id={`${id}-name`} name="name" autoComplete="name" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>মোবাইল নম্বর</label>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="০১XXXXXXXXX"
            required
            aria-invalid={phoneErr}
            aria-describedby={`${id}-ph ${id}-pe`}
          />
          <span className="hint" id={`${id}-ph`}>এই নম্বরে ফোন করে অর্ডার নিশ্চিত করব</span>
          {phoneErr && <span className="err" id={`${id}-pe`}>১১ সংখ্যার মোবাইল নম্বর দিন, যেমন ০১৭১২৩৪৫৬৭৮</span>}
        </div>
        <div className="field">
          <label htmlFor={`${id}-addr`}>পুরো ঠিকানা</label>
          <textarea id={`${id}-addr`} name="address" autoComplete="street-address" placeholder="বাসা, রাস্তা, এলাকা, থানা, জেলা" required minLength={10} />
        </div>
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
        <div className="total num" aria-live="polite">
          <div><span>{name} {v.label} × {bn(qty)}</span><span>{taka(subtotal)}</span></div>
          <div><span>ডেলিভারি</span><span>{taka(fee)}</span></div>
          <div className="grand"><span>মোট, হাতে পেয়ে দিবেন</span><span>{taka(total)}</span></div>
        </div>
        <button className="btn btn-primary btn-lg" type="submit" disabled={status.kind === "sending"}>
          {status.kind === "sending" ? "পাঠানো হচ্ছে..." : "অর্ডার নিশ্চিত করুন"}
        </button>
        {(status.kind === "ok" || status.kind === "bad") && (
          <p className={`notice ${status.kind}`} role="status">{status.text}</p>
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
