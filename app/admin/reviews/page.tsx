import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { moderateReviewAction } from "@/app/admin/actions/marketing";
import { requirePermission } from "@/lib/admin";
import { listReviewsAdmin } from "@/lib/reviews";
import { bn } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "রিভিউ" };

const TABS = { pending: "অপেক্ষায়", approved: "প্রকাশিত", rejected: "বাতিল" } as const;
type Tab = keyof typeof TABS;

export default function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Reviews searchParams={searchParams} />
    </Suspense>
  );
}

async function Reviews({ searchParams }: { searchParams: PageProps<"/admin/reviews">["searchParams"] }) {
  await connection();
  await requirePermission("marketing.manage");
  const sp = await searchParams;
  const tab: Tab = typeof sp.status === "string" && sp.status in TABS ? (sp.status as Tab) : "pending";
  const list = await listReviewsAdmin(tab);
  return (
    <>
      <div className="admin-head">
        <h1>রিভিউ</h1>
        <p className="lead">শুধু যাঁদের অর্ডার ডেলিভারি হয়েছে তাঁরাই রিভিউ দিতে পারেন। আপনি অনুমোদন দিলে তবেই পণ্যের পেজে দেখায়।</p>
      </div>
      <nav className="chips small" aria-label="অবস্থা">
        {(Object.keys(TABS) as Tab[]).map((t) => <Link key={t} href={`/admin/reviews?status=${t}`} aria-current={t === tab ? "page" : undefined}>{TABS[t]}</Link>)}
      </nav>
      {list.length === 0 ? <p className="reviews-empty">এখানে কোনো রিভিউ নেই।</p> : list.map((r) => (
        <article key={r.id} className="panel">
          <div className="panel-head">
            <b>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} <span className="sr-only-x">{r.rating}/5</span></b>
            <small>{r.display_name} · {r.email} · {dhakaDateTime(r.created_at)} · অর্ডার <Link href={`/admin/orders/${r.order_no}`}>{r.order_no}</Link></small>
          </div>
          <p><Link href={`/products/${r.slug}`} target="_blank">{r.product}</Link></p>
          <blockquote className="review-body">{r.body}</blockquote>
          <form action={moderateReviewAction} className="admin-form">
            <input type="hidden" name="id" value={r.id} />
            <label className="mini-field"><span>আপনার উত্তর (ঐচ্ছিক, পেজে দেখাবে)</span><textarea name="reply" defaultValue={r.reply ?? ""} maxLength={1000} /></label>
            <div className="inline-actions">
              <button className="btn btn-primary" name="status" value="approved" type="submit">{tab === "approved" ? "উত্তর সংরক্ষণ" : "অনুমোদন দিন"}</button>
              {tab !== "rejected" && <button className="btn btn-ghost danger" name="status" value="rejected" type="submit">বাতিল</button>}
            </div>
          </form>
        </article>
      ))}
      <p className="hint">মোট {bn(list.length)}টি দেখানো হচ্ছে।</p>
    </>
  );
}
