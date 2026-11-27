import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateOrderNote, updateOrderStatus } from "@/app/admin/actions/operations";
import { requirePermission } from "@/lib/admin";
import { getOrder, orderEvents, phoneRisk, statusLabel, STATUSES } from "@/lib/orders";
import { bn, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[no]">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <OrderDetail params={params} />
    </Suspense>
  );
}

async function OrderDetail({ params }: { params: PageProps<"/admin/orders/[no]">["params"] }) {
  await connection(); // database work happens only for a real request, never while prerendering
  await requirePermission("orders.view");
  const { no } = await params;
  const o = await getOrder(decodeURIComponent(no));
  if (!o) notFound();
  const [events, risk] = await Promise.all([orderEvents(o.id), phoneRisk(o.phone, o.id)]);
  const profit = o.cost_total === null ? null : o.subtotal - o.cost_total;

  return (
    <>
      <p className="crumbs"><Link href="/admin/orders">← সব অর্ডার</Link></p>
      <div className="admin-head">
        <h1 className="num">{o.order_no}</h1>
        <p className="lead">{dhakaDateTime(o.created_at)} · <span className={`pill st-${o.status}`}>{statusLabel[o.status]}</span></p>
      </div>

      <div className="admin-grid">
        <section className="panel" aria-labelledby="h-cust">
          <h2 id="h-cust">ক্রেতা</h2>
          <dl className="kv">
            <dt>নাম</dt><dd>{o.name}</dd>
            <dt>মোবাইল</dt><dd><a className="num strong-link" href={`tel:${o.phone}`}>{o.phone}</a></dd>
            <dt>ইমেইল</dt><dd className="break">{o.email}</dd>
            <dt>ঠিকানা</dt><dd>{o.address}</dd>
            <dt>এলাকা</dt><dd>{o.zone === "dhaka" ? "ঢাকার ভেতরে" : "ঢাকার বাইরে"}</dd>
          </dl>
        </section>

        <section className={`panel risk-panel risk-${risk.level}`} aria-labelledby="h-risk">
          <h2 id="h-risk">ঝুঁকি: <span className={`pill risk-${risk.level}`}>{risk.label}</span></h2>
          <p>এই নম্বরের আগের অর্ডার (মুসুফিতে):</p>
          <ul className="risk-stats num">
            <li><b>{bn(risk.delivered)}</b> পেয়েছেন</li>
            <li><b>{bn(risk.returned)}</b> ফেরত দিয়েছেন</li>
            <li><b>{bn(risk.cancelled)}</b> বাতিল</li>
            <li><b>{bn(risk.open)}</b> চলমান</li>
          </ul>
          <p className="hint">
            {risk.level === "high"
              ? "আগে একাধিকবার পার্সেল ফেরত দিয়েছেন। পাঠানোর আগে ডেলিভারি চার্জ বিকাশে নিয়ে নিন।"
              : risk.level === "new"
                ? "নতুন ক্রেতা। ফোনে কথা বলে নিশ্চিত হয়ে পাঠান। কুরিয়ারের ইতিহাস চেক পরে যোগ হবে।"
                : "আগের ইতিহাস ভালো।"}
          </p>
        </section>

        <section className="panel" aria-labelledby="h-items">
          <h2 id="h-items">পণ্য ও হিসাব</h2>
          <p className="pre">{o.items}</p>
          <dl className="kv num">
            <dt>পণ্যের দাম</dt><dd>{taka(o.subtotal)}</dd>
            <dt>ডেলিভারি চার্জ</dt><dd>{taka(o.delivery_fee)}</dd>
            <dt>ক্রেতা দেবেন</dt><dd><b>{taka(o.total)}</b></dd>
            <dt>কেনা দাম</dt><dd>{o.cost_total === null ? <Link href="/admin/costs">সেট করা নেই</Link> : taka(o.cost_total)}</dd>
            <dt>পণ্যে লাভ</dt><dd>{profit === null ? "–" : taka(profit)}</dd>
          </dl>
        </section>

        <section className="panel" aria-labelledby="h-status">
          <h2 id="h-status">অবস্থা বদলান</h2>
          <form action={updateOrderStatus} className="admin-form">
            <input type="hidden" name="orderNo" value={o.order_no} />
            <div className="field">
              <label htmlFor="st">নতুন অবস্থা</label>
              <select id="st" name="status" defaultValue={o.status}>
                {STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="st-note">কারণ বা নোট (ঐচ্ছিক)</label>
              <input id="st-note" name="note" placeholder="যেমন: ফোনে কথা হয়েছে, কাল পাঠাব" />
            </div>
            <button className="btn btn-primary" type="submit">সংরক্ষণ</button>
          </form>
        </section>

        <section className="panel" aria-labelledby="h-note">
          <h2 id="h-note">নিজের নোট</h2>
          <form action={updateOrderNote} className="admin-form">
            <input type="hidden" name="orderNo" value={o.order_no} />
            <div className="field">
              <label htmlFor="note">শুধু আপনি দেখবেন</label>
              <textarea id="note" name="note" defaultValue={o.note ?? ""} maxLength={500} />
            </div>
            <button className="btn btn-ghost" type="submit">নোট সংরক্ষণ</button>
          </form>
        </section>

        <section className="panel" aria-labelledby="h-log">
          <h2 id="h-log">ইতিহাস</h2>
          <ol className="log">
            {events.map((e, i) => (
              <li key={i}>
                <b>{statusLabel[e.status as keyof typeof statusLabel] ?? e.status}</b>
                <small>{dhakaDateTime(e.created_at)}{e.by_email ? ` · ${e.by_email}` : ""}</small>
                {e.note && <span>{e.note}</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
