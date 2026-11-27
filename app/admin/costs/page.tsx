import { connection } from "next/server";
import { Suspense } from "react";
import { updateSettings } from "@/app/admin/actions/operations";
import { requirePermission } from "@/lib/admin";
import { getSettings } from "@/lib/orders";

export const metadata = { title: "পার্সেল খরচ" };

// Per-variant cost prices now live on the product form (Products → edit → sizes).
export default function ParcelCostsPage() {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <ParcelCosts />
    </Suspense>
  );
}

async function ParcelCosts() {
  await connection();
  await requirePermission("finance.manage");
  const s = await getSettings();
  return (
    <>
      <div className="admin-head">
        <h1>পার্সেল খরচ</h1>
        <p className="lead">প্রতিটি পার্সেলে আপনার যা খরচ হয়। লাভ-ক্ষতির হিসাবে ডেলিভারি হওয়া আর ফেরত আসা দুই রকম পার্সেলেই এটা ধরা হয়। পণ্যের কেনা দাম পণ্যের সম্পাদনা পেজে সাইজ অনুযায়ী দিন।</p>
      </div>
      <section className="panel" aria-labelledby="h-set">
        <h2 id="h-set">প্রতি পার্সেলে</h2>
        <form action={updateSettings} className="admin-form inline-fields">
          <div className="field">
            <label htmlFor="cd">কুরিয়ার, ঢাকায় (৳)</label>
            <input id="cd" name="courier_cost_dhaka" inputMode="numeric" defaultValue={s.courier_cost_dhaka} />
          </div>
          <div className="field">
            <label htmlFor="co">কুরিয়ার, ঢাকার বাইরে (৳)</label>
            <input id="co" name="courier_cost_outside" inputMode="numeric" defaultValue={s.courier_cost_outside} />
          </div>
          <div className="field">
            <label htmlFor="pk">প্যাকিং (৳)</label>
            <input id="pk" name="packing_cost" inputMode="numeric" defaultValue={s.packing_cost} />
          </div>
          <button className="btn btn-primary" type="submit">সংরক্ষণ</button>
        </form>
      </section>
    </>
  );
}
