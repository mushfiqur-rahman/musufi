import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requirePermission } from "@/lib/admin";
import { listOrders, phoneRisk, statusCounts, statusLabel, STATUSES, type OrderStatus } from "@/lib/orders";
import { bn, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  await connection(); // database work happens only for a real request, never while prerendering
  await requirePermission("orders.view");
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "all";
  const status = (STATUSES as readonly string[]).includes(raw) ? (raw as OrderStatus) : "all";
  const [orders, counts] = await Promise.all([listOrders(status), statusCounts()]);
  const risks = await Promise.all(orders.map((o) => phoneRisk(o.phone, o.id)));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="admin-head">
        <h1>অর্ডার</h1>
        <p className="lead">নতুন অর্ডারে ফোন করে নিশ্চিত করুন, তারপর অবস্থা বদলান। ঝুঁকি দেখানো হয় এই নম্বরের আগের অর্ডার থেকে।</p>
      </div>
      <nav className="chips" aria-label="অবস্থা অনুযায়ী">
        <Link href="/admin/orders" aria-current={status === "all" ? "page" : undefined}>সব ({bn(total)})</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} aria-current={status === s ? "page" : undefined}>
            {statusLabel[s]} ({bn(counts[s] ?? 0)})
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="reviews-empty">এই তালিকায় কোনো অর্ডার নেই।</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">অর্ডার</th>
                <th scope="col">ক্রেতা</th>
                <th scope="col">পণ্য</th>
                <th scope="col">মোট</th>
                <th scope="col">অবস্থা</th>
                <th scope="col">ঝুঁকি</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.order_no}>
                  <td>
                    <Link href={`/admin/orders/${o.order_no}`} className="strong-link num">{o.order_no}</Link>
                    <small>{dhakaDateTime(o.created_at)}</small>
                  </td>
                  <td>
                    {o.name}
                    <small><a href={`tel:${o.phone}`} className="num">{o.phone}</a> · {o.zone === "dhaka" ? "ঢাকা" : "ঢাকার বাইরে"}</small>
                  </td>
                  <td className="pre">{o.items}</td>
                  <td className="num">{taka(o.total)}</td>
                  <td><span className={`pill st-${o.status}`}>{statusLabel[o.status]}</span></td>
                  <td>
                    <span className={`pill risk-${risks[i].level}`}>{risks[i].label}</span>
                    {risks[i].level !== "new" && <small className="num">{bn(risks[i].delivered)} পেয়েছেন · {bn(risks[i].returned)} ফেরত</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
