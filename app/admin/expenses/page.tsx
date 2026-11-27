import { Suspense } from "react";
import { connection } from "next/server";
import { createExpense, removeExpense } from "@/app/admin/actions/operations";
import { requirePermission } from "@/lib/admin";
import { listExpenses } from "@/lib/orders";
import { taka } from "@/lib/site";
import { addDays, dhakaToday } from "@/lib/time";

export const metadata = { title: "খরচ" };

const CATEGORIES = ["বিজ্ঞাপন", "প্যাকেজিং", "গ্যাস ও রান্না", "যাতায়াত", "বেতন", "ভাড়া", "ইন্টারনেট ও হোস্টিং", "অন্যান্য"];

export default function ExpensesPage() {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Expenses />
    </Suspense>
  );
}

async function Expenses() {
  await connection(); // database work happens only for a real request, never while prerendering
  await requirePermission("finance.manage");
  const today = dhakaToday();
  const list = await listExpenses(addDays(today, -60), today);
  const sum = list.reduce((a, e) => a + e.amount, 0);

  return (
    <>
      <div className="admin-head">
        <h1>খরচ</h1>
        <p className="lead">পণ্যের কেনা দাম আর কুরিয়ার ছাড়া অন্য সব খরচ এখানে লিখুন: বিজ্ঞাপন, বয়াম, গ্যাস, যাতায়াত। লাভ-ক্ষতির হিসাবে এগুলো বাদ যায়।</p>
      </div>

      <section className="panel" aria-labelledby="h-add">
        <h2 id="h-add">নতুন খরচ</h2>
        <form action={createExpense} className="admin-form inline-fields">
          <div className="field">
            <label htmlFor="ex-date">তারিখ</label>
            <input id="ex-date" name="spentOn" type="date" defaultValue={today} max={today} required />
          </div>
          <div className="field">
            <label htmlFor="ex-cat">ধরন</label>
            <select id="ex-cat" name="category" defaultValue="বিজ্ঞাপন">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ex-amt">টাকা</label>
            <input id="ex-amt" name="amount" inputMode="numeric" required placeholder="৳" />
          </div>
          <div className="field grow">
            <label htmlFor="ex-note">বিবরণ (ঐচ্ছিক)</label>
            <input id="ex-note" name="note" maxLength={200} placeholder="যেমন: ফেসবুক বিজ্ঞাপন, ২০০ বয়াম" />
          </div>
          <button className="btn btn-primary" type="submit">যোগ করুন</button>
        </form>
      </section>

      <section className="panel" aria-labelledby="h-list">
        <h2 id="h-list">গত ৬০ দিন · মোট <span className="num">{taka(sum)}</span></h2>
        {list.length === 0 ? (
          <p className="hint">এখনো কোনো খরচ লেখা হয়নি।</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">তারিখ</th><th scope="col">ধরন</th><th scope="col">বিবরণ</th><th scope="col">টাকা</th><th scope="col"><span className="sr-only-x">মুছুন</span></th></tr></thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id}>
                    <td className="num">{e.spent_on}</td>
                    <td>{e.category}</td>
                    <td>{e.note ?? ""}</td>
                    <td className="num">{taka(e.amount)}</td>
                    <td>
                      <form action={removeExpense}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="linkish" type="submit" aria-label={`${e.spent_on} তারিখের ${taka(e.amount)} খরচ মুছুন`}>মুছুন</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
