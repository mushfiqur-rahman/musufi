import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SalesChart } from "@/components/admin/sales-chart";
import { requirePermission } from "@/lib/admin";
import { lowStockVariants } from "@/lib/admin-catalog";
import { change, dailySeries, dashboardKpis, newCustomers, recentOrders, todoCounts, topCustomers, topProducts, type Kpi } from "@/lib/dashboard";
import { statusCounts, statusLabel, STATUSES, type OrderStatus } from "@/lib/orders";
import { can } from "@/lib/permissions";
import { bn, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "ড্যাশবোর্ড" };

const RANGES = [7, 30, 90] as const;

export default function DashboardPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const c = change(cur, prev);
  if (c === null) return <small className="delta">আগের সময়ে ছিল না</small>;
  const cls = c > 0 ? "up" : c < 0 ? "down" : "";
  return <small className={`delta ${cls}`}>{c > 0 ? "▲" : c < 0 ? "▼" : "–"} {bn(Math.abs(c))}% আগের তুলনায়</small>;
}

function KpiCard({ title, k }: { title: string; k: Kpi }) {
  return (
    <div className="stat">
      <span>{title}</span>
      <b className="num">{taka(k.sales)}</b>
      <small className="num">{bn(k.orders)}টি অর্ডার · গড় {taka(k.aov)}</small>
      <Delta cur={k.sales} prev={k.prevSales} />
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await connection();
  const me = await requirePermission("dashboard.view");
  const sp = await searchParams;
  const days = RANGES.find((r) => String(r) === sp.range) ?? 30;
  const showMoney = can(me.role, "orders.view");
  const showStock = can(me.role, "products.view");

  const [kpis, series, todos, counts, top, customers, recent, fresh, low] = await Promise.all([
    showMoney ? dashboardKpis() : null,
    showMoney ? dailySeries(days) : null,
    showMoney ? todoCounts() : null,
    showMoney ? statusCounts() : null,
    showMoney ? topProducts(30) : null,
    can(me.role, "customers.view") ? topCustomers() : null,
    showMoney ? recentOrders() : null,
    can(me.role, "customers.view") ? newCustomers() : null,
    showStock ? lowStockVariants(8) : null,
  ]);

  return (
    <>
      <div className="admin-head">
        <h1>ড্যাশবোর্ড</h1>
        <p className="lead">আজকের অবস্থা এক নজরে। বিক্রি মানে দেওয়া অর্ডারের মূল্য (বাতিল বাদে); লাভ দেখতে লাভ-ক্ষতি পেজ দেখুন।</p>
      </div>
      {sp.denied && <p className="zone-note">ওই পেজ দেখার অনুমতি আপনার ভূমিকায় নেই।</p>}

      {todos && (
        <ul className="todo-row" aria-label="করণীয়">
          <li className={todos.fresh ? "warn" : ""}><Link href="/admin/orders?status=new"><b className="num">{bn(todos.fresh)}</b> নতুন অর্ডারে ফোন করতে হবে{todos.stale ? ` (${bn(todos.stale)}টি ২৪ ঘণ্টার বেশি পুরোনো)` : ""}</Link></li>
          <li className={todos.toShip ? "warn" : ""}><Link href="/admin/orders?status=confirmed"><b className="num">{bn(todos.toShip)}</b> নিশ্চিত অর্ডার পাঠাতে হবে</Link></li>
          <li><Link href="/admin/orders?status=shipped"><b className="num">{bn(todos.shipped)}</b> পথে আছে</Link></li>
          {low && <li className={low.length ? "bad" : ""}><Link href="/admin/products?stock=low"><b className="num">{bn(low.length)}</b> সাইজের স্টক কম</Link></li>}
        </ul>
      )}

      {kpis && (
        <div className="stat-row">
          <KpiCard title="আজ" k={kpis.today} />
          <KpiCard title="এই সপ্তাহ" k={kpis.week} />
          <KpiCard title="এই মাস" k={kpis.month} />
        </div>
      )}

      {series && (
        <section className="panel" aria-labelledby="h-chart">
          <div className="panel-head">
            <h2 id="h-chart">দৈনিক বিক্রি</h2>
            <nav className="chips small" aria-label="সময়">
              {RANGES.map((r) => (
                <Link key={r} href={`/admin?range=${r}`} aria-current={r === days ? "page" : undefined}>{bn(r)} দিন</Link>
              ))}
            </nav>
          </div>
          <SalesChart data={series} />
        </section>
      )}

      <div className="admin-grid">
        {counts && (
          <section className="panel" aria-labelledby="h-status">
            <h2 id="h-status">অর্ডারের অবস্থা</h2>
            <ul className="status-list">
              {STATUSES.map((s) => (
                <li key={s}><Link href={`/admin/orders?status=${s}`}><span className={`pill st-${s}`}>{statusLabel[s as OrderStatus]}</span><b className="num">{bn(counts[s] ?? 0)}</b></Link></li>
              ))}
            </ul>
          </section>
        )}

        {low && (
          <section className="panel" aria-labelledby="h-low">
            <h2 id="h-low">কম স্টক</h2>
            {low.length === 0 ? <p className="hint">সব ঠিক আছে। স্টক ট্র্যাক করতে পণ্যের সাইজে স্টক সংখ্যা দিন।</p> : (
              <ul className="top-list plain">
                {low.map((v) => (
                  <li key={`${v.product_id}-${v.label}`}><Link href={`/admin/products/${v.product_id}`}>{v.product} · {v.label}</Link><span className={`num ${v.stock <= 0 ? "neg-text" : ""}`}>{bn(v.stock)}টি</span></li>
                ))}
              </ul>
            )}
          </section>
        )}

        {top && (
          <section className="panel" aria-labelledby="h-top">
            <h2 id="h-top">বেশি বিক্রি (৩০ দিন)</h2>
            {top.length === 0 ? <p className="hint">এখনো বিক্রি নেই।</p> : (
              <ol className="top-list">
                {top.map((t) => <li key={t.name}><span>{t.name}</span><span className="num">{bn(Number(t.qty))}টি · {taka(Number(t.sales))}</span></li>)}
              </ol>
            )}
          </section>
        )}

        {customers && (
          <section className="panel" aria-labelledby="h-cust">
            <h2 id="h-cust">সেরা ক্রেতা</h2>
            {customers.length === 0 ? <p className="hint">ডেলিভারি হওয়া অর্ডার এলে এখানে দেখাবে।</p> : (
              <ol className="top-list">
                {customers.map((c) => <li key={c.email}><span>{c.name || c.email}</span><span className="num">{bn(Number(c.orders))}টি · {taka(Number(c.spent))}</span></li>)}
              </ol>
            )}
          </section>
        )}

        {recent && (
          <section className="panel" aria-labelledby="h-recent">
            <h2 id="h-recent">সাম্প্রতিক অর্ডার</h2>
            {recent.length === 0 ? <p className="hint">এখনো কোনো অর্ডার নেই।</p> : (
              <ul className="top-list plain">
                {recent.map((o) => (
                  <li key={o.order_no}>
                    <Link href={`/admin/orders/${o.order_no}`} className="num">{o.order_no}</Link>
                    <span>{o.name} · <span className="num">{taka(o.total)}</span> · <span className={`pill st-${o.status}`}>{statusLabel[o.status as OrderStatus]}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {fresh && (
          <section className="panel" aria-labelledby="h-new">
            <h2 id="h-new">নতুন ক্রেতা</h2>
            {fresh.length === 0 ? <p className="hint">এখনো কেউ অ্যাকাউন্ট খোলেননি।</p> : (
              <ul className="top-list plain">
                {fresh.map((c) => <li key={c.email}><span className="break">{c.name || c.email}</span><small>{dhakaDateTime(c.created_at)}</small></li>)}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}
