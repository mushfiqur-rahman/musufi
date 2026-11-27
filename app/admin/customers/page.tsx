import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requirePermission } from "@/lib/admin";
import { CUSTOMER_PAGE, listCustomers, segmentLabel, SEGMENTS, segmentsOf, type Segment } from "@/lib/customers";
import { bn, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "ক্রেতা" };

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

async function Customers({ searchParams }: { searchParams: PageProps<"/admin/customers">["searchParams"] }) {
  await connection();
  await requirePermission("customers.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const segment = typeof sp.segment === "string" && (SEGMENTS as readonly string[]).includes(sp.segment) ? (sp.segment as Segment) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listCustomers({ q: q || undefined, segment, page });
  const pages = Math.max(1, Math.ceil(total / CUSTOMER_PAGE));
  const link = (extra: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (segment) u.set("segment", segment);
    for (const [k, v] of Object.entries(extra)) if (v === undefined || v === "") u.delete(k); else u.set(k, String(v));
    const s = u.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="admin-head">
        <h1>ক্রেতা</h1>
        <p className="lead">{bn(total)} জন। LTV মানে ডেলিভারি হওয়া অর্ডার থেকে মোট আয়। VIP: {taka(10_000)}+ বা ৫টি+ ডেলিভারি।</p>
      </div>
      <nav className="chips" aria-label="ধরন">
        <Link href={link({ segment: undefined, page: undefined })} aria-current={!segment ? "page" : undefined}>সব</Link>
        {SEGMENTS.map((s) => <Link key={s} href={link({ segment: s, page: undefined })} aria-current={segment === s ? "page" : undefined}>{segmentLabel[s]}</Link>)}
      </nav>
      <form className="filter-bar" role="search" action="/admin/customers">
        {segment && <input type="hidden" name="segment" value={segment} />}
        <label className="mini-field wide"><span>খুঁজুন</span><input name="q" defaultValue={q} placeholder="নাম, ইমেইল বা ফোন" /></label>
        <button className="btn btn-ghost" type="submit">দেখান</button>
      </form>
      {rows.length === 0 ? <p className="reviews-empty">কেউ পাওয়া যায়নি।</p> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">ক্রেতা</th><th scope="col">অর্ডার</th><th scope="col">LTV</th><th scope="col">শেষ অর্ডার</th><th scope="col">ধরন</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link className="strong-link" href={`/admin/customers/${c.id}`}>{c.name || c.email}</Link>
                    <small className="break">{c.email}{c.phone ? ` · ${c.phone}` : ""}</small>
                  </td>
                  <td className="num">{bn(Number(c.orders))}<small>{bn(Number(c.delivered))} পেয়েছেন · {bn(Number(c.returned))} ফেরত</small></td>
                  <td className="num">{taka(Number(c.ltv))}</td>
                  <td>{c.last_order ? dhakaDateTime(c.last_order) : "–"}<small>যোগ দিয়েছেন {dhakaDateTime(c.created_at)}</small></td>
                  <td className="seg-cell">{segmentsOf(c).map((s) => <span key={s} className={`pill seg-${s}`}>{segmentLabel[s]}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="pager" aria-label="পাতা">
          {page > 1 && <Link href={link({ page: page - 1 })}>← আগের</Link>}
          <span className="num">পাতা {bn(page)} / {bn(pages)}</span>
          {page < pages && <Link href={link({ page: page + 1 })}>পরের →</Link>}
        </nav>
      )}
    </>
  );
}
