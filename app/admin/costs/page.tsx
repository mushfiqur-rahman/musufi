import { Suspense } from "react";
import { connection } from "next/server";
import { updateCost, updateSettings } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";
import { allCosts, getSettings } from "@/lib/orders";
import { categories, products } from "@/lib/products";
import { taka } from "@/lib/site";

export const metadata = { title: "পণ্যের কেনা দাম" };

export default function CostsPage() {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Costs />
    </Suspense>
  );
}

async function Costs() {
  await connection(); // database work happens only for a real request, never while prerendering
  await requireAdmin();
  const [costs, s] = await Promise.all([allCosts(), getSettings()]);

  return (
    <>
      <div className="admin-head">
        <h1>পণ্যের কেনা দাম</h1>
        <p className="lead">প্রতিটি সাইজের এক ইউনিট আপনার কত টাকায় পড়ে তা লিখুন। নতুন অর্ডারে এই দাম সংরক্ষিত হয়, পরে দাম বদলালে পুরোনো হিসাব বদলায় না।</p>
      </div>

      <section className="panel" aria-labelledby="h-set">
        <h2 id="h-set">প্রতি পার্সেলের খরচ</h2>
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
        <p className="hint">কুরিয়ার কোম্পানি আপনার কাছ থেকে প্রতি পার্সেলে যা নেয়। ফেরত আসা পার্সেলেও এই খরচ ধরা হয়।</p>
      </section>

      {categories.map((c) => (
        <section key={c.id} className="panel" aria-labelledby={`h-${c.id}`}>
          <h2 id={`h-${c.id}`}>{c.label}</h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th scope="col">পণ্য ও সাইজ</th><th scope="col">বিক্রয় দাম</th><th scope="col">কেনা দাম</th><th scope="col">লাভ</th></tr>
              </thead>
              <tbody>
                {products.filter((p) => p.category === c.id).flatMap((p) =>
                  p.variants.map((v, i) => {
                    const cost = costs.get(`${p.slug}:${i}`);
                    return (
                      <tr key={`${p.slug}:${i}`}>
                        <td>{p.name}<small>{v.label}</small></td>
                        <td className="num">{taka(v.price)}</td>
                        <td>
                          <form action={updateCost} className="cost-form">
                            <input type="hidden" name="slug" value={p.slug} />
                            <input type="hidden" name="variant" value={i} />
                            <label className="sr-only-x" htmlFor={`c-${p.slug}-${i}`}>{p.name} {v.label} কেনা দাম</label>
                            <input id={`c-${p.slug}-${i}`} name="cost" inputMode="numeric" defaultValue={cost ?? ""} placeholder="৳" />
                            <button className="btn btn-ghost" type="submit">সেভ</button>
                          </form>
                        </td>
                        <td className="num">{cost === undefined ? "–" : taka(v.price - cost)}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
