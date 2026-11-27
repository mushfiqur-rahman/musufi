"use client";

import { useActionState, useState } from "react";
import { saveCouponAction } from "@/app/admin/actions/marketing";
import type { Coupon, CouponType } from "@/lib/coupons";
import type { ActionResult } from "@/lib/validate";

const toLocal = (d: Date | string | null) => (d ? new Date(new Date(d).getTime() + 6 * 3600_000).toISOString().slice(0, 16) : "");

/** Create (coupon = null) or edit a coupon. */
export function CouponForm({ coupon }: { coupon: Coupon | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCouponAction, null);
  const [type, setType] = useState<CouponType>(coupon?.type ?? "percent");
  const p = coupon ? `cp${coupon.id}` : "cpnew";
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="id" value={coupon?.id ?? ""} />
      <div className="grid-2">
        <label className="mini-field"><span>কোড</span><input name="code" defaultValue={coupon?.code ?? ""} required maxLength={30} placeholder="যেমন: EID10" style={{ textTransform: "uppercase" }} /></label>
        <label className="mini-field"><span>ধরন</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as CouponType)}>
            <option value="percent">শতাংশ ছাড়</option>
            <option value="fixed">নির্দিষ্ট টাকা ছাড়</option>
            <option value="free_shipping">ফ্রি ডেলিভারি</option>
          </select>
        </label>
        {type !== "free_shipping" && (
          <label className="mini-field"><span>{type === "percent" ? "ছাড় %" : "ছাড় ৳"}</span><input name="value" inputMode="numeric" defaultValue={coupon?.value ?? ""} required /></label>
        )}
        {type === "percent" && (
          <label className="mini-field"><span>সর্বোচ্চ ছাড় ৳ (ঐচ্ছিক)</span><input name="maxDiscount" inputMode="numeric" defaultValue={coupon?.max_discount ?? ""} /></label>
        )}
        <label className="mini-field"><span>সর্বনিম্ন কেনাকাটা ৳</span><input name="minSubtotal" inputMode="numeric" defaultValue={coupon?.min_subtotal ?? 0} /></label>
        <label className="mini-field"><span>মোট কতবার ব্যবহার (খালি = সীমা নেই)</span><input name="usageLimit" inputMode="numeric" defaultValue={coupon?.usage_limit ?? ""} /></label>
        <label className="mini-field"><span>একজন ক্রেতা কতবার</span><input name="perCustomer" inputMode="numeric" defaultValue={coupon?.per_customer ?? 1} /></label>
        <label className="mini-field"><span>শুরু (ঢাকার সময়, ঐচ্ছিক)</span><input id={`${p}-s`} name="startsAt" type="datetime-local" defaultValue={toLocal(coupon?.starts_at ?? null)} /></label>
        <label className="mini-field"><span>শেষ (ঐচ্ছিক)</span><input id={`${p}-e`} name="endsAt" type="datetime-local" defaultValue={toLocal(coupon?.ends_at ?? null)} /></label>
        <label className="mini-field"><span>নোট (শুধু আপনি দেখবেন)</span><input name="note" defaultValue={coupon?.note ?? ""} maxLength={200} /></label>
      </div>
      <label className="mini-field check"><input type="checkbox" name="active" value="1" defaultChecked={coupon ? Boolean(coupon.active) : true} /><span>চালু</span></label>
      <div className="form-bar">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে..." : coupon ? "সংরক্ষণ" : "কুপন তৈরি করুন"}</button>
        {state && <p className={`notice ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</p>}
      </div>
    </form>
  );
}
