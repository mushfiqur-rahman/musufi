import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoutButton } from "@/components/login-form";
import { currentCustomer } from "@/lib/auth";
import { customerOrders, statusLabel } from "@/lib/orders";
import { reviewableItems } from "@/lib/reviews";
import { ReviewForm } from "@/components/review-form";
import { bn, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "আমার অর্ডার", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="wrap auth-page wide">
      <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  await connection(); // database work happens only for a real request, never while prerendering
  const me = await currentCustomer();
  if (!me) redirect("/login");
  const [orders, toReview] = await Promise.all([customerOrders(me.id), reviewableItems(me.id)]);

  return (
    <>
      <div className="account-head">
        <div>
          <h1>আমার অর্ডার</h1>
          <p className="lead">{me.name ? `${me.name} · ` : ""}{me.email}</p>
        </div>
        <div className="account-actions">
          {me.isAdmin && <Link className="btn btn-primary" href="/admin">অ্যাডমিন প্যানেল</Link>}
          <LogoutButton />
        </div>
      </div>

      {toReview.length > 0 && (
        <section className="panel" aria-labelledby="h-toreview">
          <h2 id="h-toreview">রিভিউ দিন</h2>
          <p className="hint">আপনার মতামত অন্য ক্রেতাদের সাহায্য করে।</p>
          {toReview.map((t) => <ReviewForm key={`${t.order_id}-${t.product_id}`} orderId={t.order_id} productId={t.product_id} productName={t.product_name} defaultName={me.name ?? ""} />)}
        </section>
      )}

      {orders.length === 0 ? (
        <div className="reviews-empty">
          <p>এখনো কোনো অর্ডার নেই।</p>
          <Link className="btn btn-primary" href="/#products">পণ্য দেখুন</Link>
        </div>
      ) : (
        <ul className="my-orders">
          {orders.map((o) => (
            <li key={o.order_no} className="panel">
              <div className="mo-top">
                <b className="num">{o.order_no}</b>
                <span className={`pill st-${o.status}`}>{statusLabel[o.status]}</span>
              </div>
              <p className="mo-items">{o.items}</p>
              <p className="meta num">{dhakaDateTime(o.created_at)} · মোট {taka(o.total)} · {bn(o.phone)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
