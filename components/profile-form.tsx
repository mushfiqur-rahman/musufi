"use client";

// "আমার তথ্য": the customer's name, mobile number and default delivery address.
// Saved to /api/account/profile; the order form pre-fills from these.

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AddressPicker, checkAddress, emptyAddress, type AddressErrors, type AddressValue } from "@/components/address-picker";
import type { PublicConfig } from "@/lib/store-config";

const BN = "০১২৩৪৫৬৭৮৯";
const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

export function ProfileForm({ email, name, phone, address, config }: {
  email: string;
  name: string;
  phone: string;
  /** Saved structured address, or null. */
  address: Partial<AddressValue> | null;
  config: Pick<PublicConfig, "delivery" | "dhakaDistrictIds">;
}) {
  const id = useId();
  const router = useRouter();
  const [fields, setFields] = useState({ name, phone });
  const [addr, setAddr] = useState<AddressValue>({ ...emptyAddress, ...(address ?? {}) });
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [addrErrors, setAddrErrors] = useState<AddressErrors>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const addressStarted = Boolean(addr.divisionId || addr.districtId || addr.upazilaId || addr.line.trim());

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const phoneClean = toLatinDigits(fields.phone).replace(/[\s-]/g, "");
    const errs: typeof errors = {};
    if (fields.name.trim().length < 2) errs.name = "আপনার নাম দিন";
    if (!/^01[3-9]\d{8}$/.test(phoneClean)) errs.phone = "১১ সংখ্যার মোবাইল নম্বর দিন";
    const aErrs = addressStarted ? checkAddress(addr) : {};
    setErrors(errs);
    setAddrErrors(aErrs);
    if (Object.keys(errs).length || Object.keys(aErrs).length) {
      setMsg({ kind: "bad", text: "লাল চিহ্নিত ঘরগুলো ঠিক করুন।" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: fields.name.trim(), phone: phoneClean, address: addressStarted ? addr : null }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setMsg({ kind: res.ok ? "ok" : "bad", text: body.message ?? (res.ok ? "সংরক্ষণ হয়েছে।" : "সংরক্ষণ করা যায়নি।") });
      if (res.ok) router.refresh();
    } catch {
      setMsg({ kind: "bad", text: "ইন্টারনেট সংযোগ পাওয়া যায়নি। আবার চেষ্টা করুন।" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack profile-form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-email`}>ইমেইল</label>
        <input id={`${id}-email`} value={email} readOnly aria-describedby={`${id}-eh`} />
        <span className="hint" id={`${id}-eh`}>লগইনের ইমেইল বদলানো যায় না।</span>
      </div>
      <div className="field">
        <label htmlFor={`${id}-name`}>আপনার নাম</label>
        <input id={`${id}-name`} value={fields.name} onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
          autoComplete="name" maxLength={80} aria-invalid={!!errors.name} />
        {errors.name && <span className="err">{errors.name}</span>}
      </div>
      <div className="field">
        <label htmlFor={`${id}-phone`}>মোবাইল নম্বর</label>
        <input id={`${id}-phone`} value={fields.phone} onChange={(e) => setFields((f) => ({ ...f, phone: e.target.value }))}
          type="tel" inputMode="numeric" autoComplete="tel" placeholder="০১XXXXXXXXX" aria-invalid={!!errors.phone} />
        {errors.phone && <span className="err">{errors.phone}</span>}
      </div>
      <fieldset className="order-fields">
        <legend>ডেলিভারির ঠিকানা (ঐচ্ছিক)</legend>
        <AddressPicker id={`${id}-addr`} config={config} value={addr} onChange={(a) => { setAddr(a); setAddrErrors({}); }} errors={addrErrors} />
      </fieldset>
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "সংরক্ষণ হচ্ছে..." : "তথ্য সংরক্ষণ করুন"}</button>
      {msg && <p className={`notice ${msg.kind}`} role="status">{msg.text}</p>}
    </form>
  );
}
