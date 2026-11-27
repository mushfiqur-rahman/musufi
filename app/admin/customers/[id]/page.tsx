import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { customerBlock, customerNotes } from "@/app/admin/actions/operations";
import { requirePermission } from "@/lib/admin";
import { isAdminEmail } from "@/lib/auth";
import { getCustomer, segmentLabel, segmentsOf } from "@/lib/customers";
import { customerOrders, paymentStatusLabel, phoneRisk, statusLabel } from "@/lib/orders";
import { can } from "@/lib/permissions";
import { bn, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "ক্রেতার প্রোফাইল" };

export default function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: PageProps<"/admin/customers/[id]">["params"] }) {
  await connection();
  const me = await requirePermission("customers.view");
  const canManage = can(me, "customers.manage");
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const c = await getCustomer(id);
  if (!c) notFound();
  const [orders, risk] = await Promise.all([customerOrders(id), c.phone ? phoneRisk(c.phone) : null]);
  const aov = Number(c.delivered) ? Math.round(Number(c.ltv) / Number(c.delivered)) : 0;

  return (
    <>
      <p className="crumbs"><Link href="/admin/customers">← সব ক্রেতা</Link></p>
      <div className="admin-head">
        <h1>{c.name || c.email}</h1>
        <p className="lead seg-cell">{segmentsOf(c).map((s) => <span key={s} className={`pill seg-${s}`}>{segmentLabel[s]}</span>)}{c.role ? <span className="pill">স্টাফ</span> : null}</p>
      </div>

      <div className="stat-row">
        <div className="stat"><span>অর্ডার</span><b className="num">{bn(Number(c.orders))}</b><small className="num">{bn(Number(c.delivered))} পেয়েছেন · {bn(Number(c.returned))} ফেরত</small></div>
        <div className="stat"><span>LTV</span><b className="num">{taka(Number(c.ltv))}</b><small className="num">গড় অর্ডার {taka(aov)}</small></div>
        <div className="stat"><span>শেষ অর্ডার</span><b>{c.last_order ? dhakaDateTime(c.last_order) : "–"}</b><small>যোগ দিয়েছেন {dhakaDateTime(c.created_at)}</small></div>
        {risk && <div className="stat"><span>ডেলিভারি-ঝুঁকি</span><b><span className={`pill risk-${risk.level}`}>{risk.label}</span></b><small className="num">এই ফোন নম্বরের সব অর্ডার থেকে</small></div>}
      </div>

      <div className="admin-grid">
        <section className="panel" aria-labelledby="h-info">
          <h2 id="h-info">যোগাযোগ</h2>
          <dl className="kv">
            <dt>ইমেইল</dt><dd className="break">{c.email}</dd>
            <dt>ফোন</dt><dd>{c.phone ? <a className="num strong-link" href={`tel:${c.phone}`}>{c.phone}</a> : "–"}</dd>
            <dt>শেষ ঠিকানা</dt><dd>{c.address ?? "–"}</dd>
            <dt>শেষ লগইন</dt><dd>{c.last_login_at ? dhakaDateTime(c.last_login_at) : "–"}</dd>
          </dl>
        </section>

        <section className="panel" aria-labelledby="h-notes">
          <h2 id="h-notes">নোট ও ব্লক</h2>
          {canManage ? (
            <>
              <form action={customerNotes} className="admin-form">
                <input type="hidden" name="id" value={c.id} />
                <label className="mini-field"><span>শুধু স্টাফ দেখবেন</span><textarea name="notes" defaultValue={c.notes ?? ""} maxLength={1000} /></label>
                <button className="btn btn-ghost" type="submit">নোট সংরক্ষণ</button>
              </form>
              {!c.role && !isAdminEmail(c.email) && c.id !== me.id && (
                <form action={customerBlock} className="danger-zone">
                  <input type="hidden" name="id" value={c.id} />
                  {c.blocked_at ? (
                    <><p>ব্লক করা হয়েছে {dhakaDateTime(c.blocked_at)}। এই ক্রেতা লগইন বা অর্ডার করতে পারবেন না।</p><button className="btn btn-ghost" name="block" value="0" type="submit">আনব্লক করুন</button></>
                  ) : (
                    <><p>সন্দেহজনক হলে ব্লক করুন: লগইন বন্ধ হবে, চালু সেশনও শেষ হবে।</p><button className="btn btn-ghost danger" name="block" value="1" type="submit">ব্লক করুন</button></>
                  )}
                </form>
              )}
            </>
          ) : <p>{c.notes ?? "–"}</p>}
        </section>
      </div>

      <section className="panel" aria-labelledby="h-orders">
        <h2 id="h-orders">অর্ডারের ইতিহাস</h2>
        {orders.length === 0 ? <p className="hint">এখনো কোনো অর্ডার নেই।</p> : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th scope="col">অর্ডার</th><th scope="col">পণ্য</th><th scope="col">মোট</th><th scope="col">অবস্থা</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_no}>
                    <td><Link className="strong-link num" href={`/admin/orders/${o.order_no}`}>{o.order_no}</Link><small>{dhakaDateTime(o.created_at)}</small></td>
                    <td className="pre">{o.items}<small>{o.address}</small></td>
                    <td className="num">{taka(o.total)}<small>{paymentStatusLabel[o.payment_status]}</small></td>
                    <td><span className={`pill st-${o.status}`}>{statusLabel[o.status]}</span></td>
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
