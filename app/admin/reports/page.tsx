import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { buildReport } from "@/lib/reports";
import { bn, taka } from "@/lib/site";
import { addDays, dhakaToday, monthStart, weekStart } from "@/lib/time";

export const metadata = { title: "লাভ-ক্ষতি" };

const PERIODS = {
  today: "আজ",
  week: "এই সপ্তাহ",
  month: "এই মাস",
  "30d": "গত ৩০ দিন",
} as const;
type Period = keyof typeof PERIODS;

export default function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}

async function Reports({ searchParams }: { searchParams: PageProps<"/admin/reports">["searchParams"] }) {
  await connection(); // database work happens only for a real request, never while prerendering
  await requireAdmin();
  const sp = await searchParams;
  const today = dhakaToday();
  const period: Period = typeof sp.p === "string" && sp.p in PERIODS ? (sp.p as Period) : "month";
  const from = { today, week: weekStart(today), month: monthStart(today), "30d": addDays(today, -29) }[period];
  const r = await buildReport(from, today);
  const sign = (n: number) => (n < 0 ? `−${taka(-n)}` : taka(n));

  return (
    <>
      <div className="admin-head">
        <h1>লাভ-ক্ষতি</h1>
        <p className="lead">বিক্রি গোনা হয় পণ্য ডেলিভারি হলে, কারণ ক্যাশ অন ডেলিভারিতে টাকা তখনই আসে। ফেরত পার্সেলের কুরিয়ার আর প্যাকিং খরচ ক্ষতি হিসেবে ধরা হয়।</p>
      </div>
      <nav className="chips" aria-label="সময়">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <Link key={p} href={`/admin/reports?p=${p}`} aria-current={p === period ? "page" : undefined}>{PERIODS[p]}</Link>
        ))}
      </nav>

      <div className="stat-row">
        <div className={`stat big ${r.profit < 0 ? "neg" : "pos"}`}>
          <span>নিট লাভ</span>
          <b className="num">{sign(r.profit)}</b>
          <small className="num">{bn(r.from)} থেকে {bn(r.to)}</small>
        </div>
        <div className="stat"><span>বিক্রি (ডেলিভারি হওয়া)</span><b className="num">{taka(r.revenue)}</b><small className="num">{bn(r.delivered)}টি অর্ডার</small></div>
        <div className="stat"><span>নতুন অর্ডার এসেছে</span><b className="num">{bn(r.placed)}</b><small>এই সময়ে</small></div>
        <div className="stat"><span>ফেরত</span><b className="num">{bn(r.returned)}</b><small className="num">ক্ষতি {taka(r.returnLoss)}</small></div>
      </div>

      {r.missingCost > 0 && (
        <p className="zone-note">{bn(r.missingCost)}টি ডেলিভারি হওয়া অর্ডারে কেনা দাম সেট করা ছিল না, তাই লাভ আসলের চেয়ে বেশি দেখাচ্ছে। <Link href="/admin/costs">কেনা দাম সেট করুন</Link></p>
      )}

      <div className="admin-grid">
        <section className="panel" aria-labelledby="h-break">
          <h2 id="h-break">হিসাব</h2>
          <dl className="kv num ledger">
            <dt>পণ্য বিক্রি</dt><dd>{taka(r.itemSales)}</dd>
            <dt>ক্রেতার দেওয়া ডেলিভারি চার্জ</dt><dd>{taka(r.deliveryCharged)}</dd>
            <dt><b>মোট আয়</b></dt><dd><b>{taka(r.revenue)}</b></dd>
            <dt>পণ্যের কেনা দাম</dt><dd>−{taka(r.cogs)}</dd>
            <dt>কুরিয়ার খরচ</dt><dd>−{taka(r.courierCost)}</dd>
            <dt>প্যাকিং</dt><dd>−{taka(r.packingCost)}</dd>
            <dt>অন্যান্য খরচ</dt><dd>−{taka(r.expenses)}</dd>
            <dt><b>নিট লাভ</b></dt><dd><b>{sign(r.profit)}</b></dd>
          </dl>
        </section>

        <section className="panel" aria-labelledby="h-top">
          <h2 id="h-top">সবচেয়ে বেশি বিক্রি</h2>
          {r.topProducts.length === 0 ? (
            <p className="hint">এই সময়ে কোনো পণ্য ডেলিভারি হয়নি।</p>
          ) : (
            <ol className="top-list">
              {r.topProducts.map((t) => (
                <li key={t.name}><span>{t.name}</span><span className="num">{bn(t.qty)}টি · {taka(t.sales)}</span></li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {r.days.length > 1 && (
        <section className="panel" aria-labelledby="h-days">
          <h2 id="h-days">দিন অনুযায়ী</h2>
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">তারিখ</th><th scope="col">ডেলিভারি</th><th scope="col">আয়</th><th scope="col">লাভ</th></tr></thead>
              <tbody>
                {r.days.map((d) => (
                  <tr key={d.date}>
                    <td className="num">{bn(d.date)}</td>
                    <td className="num">{bn(d.delivered)}</td>
                    <td className="num">{taka(d.revenue)}</td>
                    <td className={`num ${d.profit < 0 ? "neg-text" : ""}`}>{sign(d.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
