"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/app/admin/actions/settings";
import type { StoreSettings } from "@/lib/store-config";
import type { ActionResult } from "@/lib/validate";

type DistrictGroup = { division: string; districts: { id: number; bn: string }[] };

/** Store settings form. Plain inputs; the server action validates everything. */
export function SettingsForm({ s, groups }: { s: StoreSettings; groups: DistrictGroup[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveSettingsAction, null);
  const dhaka = new Set(s.dhakaDistrictIds);
  return (
    <form action={action} className="admin-form product-form">
      <section className="panel" aria-labelledby="st-contact">
        <h2 id="st-contact">যোগাযোগ</h2>
        <div className="grid-2">
          <label className="mini-field"><span>ফোন (অর্ডারের জন্য)</span><input name="phone" defaultValue={s.contact.phone} inputMode="numeric" required /></label>
          <label className="mini-field"><span>হোয়াটসঅ্যাপ নম্বর</span><input name="whatsapp" defaultValue={s.contact.whatsapp.replace(/^88/, "")} inputMode="numeric" required /></label>
          <label className="mini-field"><span>ঠিকানা</span><input name="address" defaultValue={s.contact.address} maxLength={160} /></label>
          <label className="mini-field"><span>জেলা</span><input name="district" defaultValue={s.contact.district} maxLength={60} /></label>
          <label className="mini-field"><span>খোলা থাকার সময়</span><input name="hours" defaultValue={s.contact.hours} maxLength={80} /></label>
          <label className="mini-field"><span>প্রতিষ্ঠাতার নাম</span><input name="founder" defaultValue={s.contact.founder} maxLength={80} /></label>
        </div>
      </section>

      <section className="panel" aria-labelledby="st-delivery">
        <h2 id="st-delivery">ডেলিভারি চার্জ ও সময়</h2>
        <div className="grid-2">
          <fieldset className="field">
            <legend>ঢাকার ভেতরে</legend>
            <label className="mini-field"><span>নাম</span><input name="dhakaLabel" defaultValue={s.delivery.dhaka.label} maxLength={40} /></label>
            <label className="mini-field"><span>চার্জ ৳</span><input name="dhakaFee" defaultValue={s.delivery.dhaka.fee} inputMode="numeric" /></label>
            <label className="mini-field"><span>সময়</span><input name="dhakaDays" defaultValue={s.delivery.dhaka.days} maxLength={40} /></label>
          </fieldset>
          <fieldset className="field">
            <legend>ঢাকার বাইরে</legend>
            <label className="mini-field"><span>নাম</span><input name="outsideLabel" defaultValue={s.delivery.outside.label} maxLength={40} /></label>
            <label className="mini-field"><span>চার্জ ৳</span><input name="outsideFee" defaultValue={s.delivery.outside.fee} inputMode="numeric" /></label>
            <label className="mini-field"><span>সময়</span><input name="outsideDays" defaultValue={s.delivery.outside.days} maxLength={40} /></label>
          </fieldset>
        </div>
        <label className="mini-field"><span>এর বেশি কিনলে ডেলিভারি ফ্রি ৳ (খালি = কখনো না)</span><input name="freeOver" defaultValue={s.freeDeliveryOver ?? ""} inputMode="numeric" /></label>
        <fieldset className="field district-picker">
          <legend>যে জেলাগুলো ‘ঢাকার ভেতরে’ চার্জ পাবে</legend>
          <p className="hint">অন্য সব জেলা ‘ঢাকার বাইরে’। যেমন গাজীপুর বা নারায়ণগঞ্জে কম চার্জ নিতে চাইলে এখানে টিক দিন।</p>
          {groups.map((g) => (
            <details key={g.division} open={g.districts.some((d) => dhaka.has(d.id))}>
              <summary>{g.division} বিভাগ</summary>
              <div className="check-grid">
                {g.districts.map((d) => (
                  <label key={d.id} className="mini-field check"><input type="checkbox" name="dhakaDistrict" value={d.id} defaultChecked={dhaka.has(d.id)} /><span>{d.bn}</span></label>
                ))}
              </div>
            </details>
          ))}
        </fieldset>
      </section>

      <section className="panel" aria-labelledby="st-pay">
        <h2 id="st-pay">পেমেন্ট</h2>
        <label className="mini-field check"><input type="checkbox" name="cod" value="1" defaultChecked={s.payments.cod} /><span>ক্যাশ অন ডেলিভারি চালু</span></label>
        <div className="grid-2">
          <label className="mini-field"><span>বিকাশ নম্বর (খালি = বন্ধ)</span><input name="bkash" defaultValue={s.payments.bkash} inputMode="numeric" /></label>
          <label className="mini-field"><span>নগদ নম্বর (খালি = বন্ধ)</span><input name="nagad" defaultValue={s.payments.nagad} inputMode="numeric" /></label>
        </div>
      </section>

      <div className="form-bar">
        <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে..." : "সেটিংস সংরক্ষণ"}</button>
        {state && !state.ok && <p className="notice bad" role="status">{state.message}</p>}
      </div>
    </form>
  );
}
