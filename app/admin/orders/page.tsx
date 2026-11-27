import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { bulkOrderStatus } from "@/app/admin/actions/operations";
import { requirePermission } from "@/lib/admin";
import { DISTRICTS } from "@/lib/geo";
import { filterQuery, parseOrderFilter } from "@/lib/order-filters";
import { listOrders, PAGE_SIZE, PAYMENT_STATUSES, paymentStatusLabel, phoneRisk, statusCounts, statusLabel, STATUSES } from "@/lib/orders";
import { can } from "@/lib/permissions";
import { bn, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "অর্ডার" };

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  await connection();
  const me = await requirePermission("orders.view");
  const canManage = can(me.role, "orders.manage");
  const sp = await searchParams;
  const f = parseOrderFilter(sp);
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));
  const [{ rows, total }, counts] = await Promise.all([listOrders(f, page), statusCounts()]);
  const risks = await Promise.all(rows.map((o) => phoneRisk(o.phone, o.id)));
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const districts = [...DISTRICTS].sort((a, b) => a.bn.localeCompare(b.bn, "bn"));

  return (
    <>
      <div className="admin-head row">
        <div>
          <h1>অর্ডার</h1>
          <p className="lead">নতুন অর্ডারে ফোন করে নিশ্চিত করুন, তারপর অবস্থা বদলান। ঝুঁকি দেখানো হয় এই নম্বরের আগের অর্ডার থেকে।</p>
        </div>
        <a className="btn btn-ghost" href={`/admin/orders/export${filterQuery(f)}`}>CSV ডাউনলোড ({bn(total)})</a>
      </div>

      <nav className="chips" aria-label="অবস্থা অনুযায়ী">
        <Link href={`/admin/orders${filterQuery({ ...f, status: undefined })}`} aria-current={!f.status ? "page" : undefined}>সব ({bn(all)})</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders${filterQuery({ ...f, status: s })}`} aria-current={f.status === s ? "page" : undefined}>
            {statusLabel[s]} ({bn(counts[s] ?? 0)})
          </Link>
        ))}
      </nav>

      <form className="filter-bar" role="search" action="/admin/orders">
        {f.status && <input type="hidden" name="status" value={f.status} />}
        <label className="mini-field wide"><span>খুঁজুন</span><input name="q" defaultValue={f.q} placeholder="অর্ডার নম্বর, নাম, ফোন বা ইমেইল" /></label>
        <label className="mini-field"><span>পেমেন্ট</span>
          <select name="payment" defaultValue={f.payment ?? ""}>
            <option value="">সব</option>
            {PAYMENT_STATUSES.map((p) => <option key={p} value={p}>{paymentStatusLabel[p]}</option>)}
          </select>
        </label>
        <label className="mini-field"><span>জেলা</span>
          <select name="district" defaultValue={f.districtId ?? ""}>
            <option value="">সব</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.bn}</option>)}
          </select>
        </label>
        <label className="mini-field"><span>থেকে</span><input type="date" name="from" defaultValue={f.from} /></label>
        <label className="mini-field"><span>পর্যন্ত</span><input type="date" name="to" defaultValue={f.to} /></label>
        <button className="btn btn-ghost" type="submit">দেখান</button>
      </form>

      {rows.length === 0 ? (
        <p className="reviews-empty">এই তালিকায় কোনো অর্ডার নেই।</p>
      ) : (
        <form action={bulkOrderStatus}>
          {canManage && (
            <div className="bulk-bar">
              <label className="mini-field"><span>বাছাই করা অর্ডার</span>
                <select name="status" defaultValue="confirmed">
                  {STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]} করুন</option>)}
                </select>
              </label>
              <button className="btn btn-primary" type="submit">একসাথে বদলান</button>
            </div>
          )}
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {canManage && <th scope="col"><span className="sr-only-x">বাছাই</span></th>}
                  <th scope="col">অর্ডার</th>
                  <th scope="col">ক্রেতা</th>
                  <th scope="col">পণ্য</th>
                  <th scope="col">মোট</th>
                  <th scope="col">অবস্থা</th>
                  <th scope="col">ঝুঁকি</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o, i) => (
                  <tr key={o.order_no}>
                    {canManage && (
                      <td><input type="checkbox" name="orderNo" value={o.order_no} aria-label={`${o.order_no} বাছাই`} /></td>
                    )}
                    <td>
                      <Link href={`/admin/orders/${o.order_no}`} className="strong-link num">{o.order_no}</Link>
                      <small>{dhakaDateTime(o.created_at)}</small>
                    </td>
                    <td>
                      {o.name}
                      <small><a href={`tel:${o.phone}`} className="num">{o.phone}</a> · {o.zone === "dhaka" ? "ঢাকা" : "ঢাকার বাইরে"}</small>
                    </td>
                    <td className="pre">{o.items}</td>
                    <td className="num">
                      {taka(o.total)}
                      <small className={o.payment_status === "paid" ? "" : "neg-text"}>{paymentStatusLabel[o.payment_status]}</small>
                    </td>
                    <td>
                      <span className={`pill st-${o.status}`}>{statusLabel[o.status]}</span>
                      {o.tracking_no && <small className="num">{o.courier ?? ""} {o.tracking_no}</small>}
                    </td>
                    <td>
                      <span className={`pill risk-${risks[i].level}`}>{risks[i].label}</span>
                      {risks[i].level !== "new" && <small className="num">{bn(risks[i].delivered)} পেয়েছেন · {bn(risks[i].returned)} ফেরত</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}

      {pages > 1 && (
        <nav className="pager" aria-label="পাতা">
          {page > 1 && <Link href={`/admin/orders${filterQuery(f, { page: page - 1 })}`}>← আগের</Link>}
          <span className="num">পাতা {bn(page)} / {bn(pages)}</span>
          {page < pages && <Link href={`/admin/orders${filterQuery(f, { page: page + 1 })}`}>পরের →</Link>}
        </nav>
      )}
    </>
  );
}
