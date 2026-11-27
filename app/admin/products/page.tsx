import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { setProductStatusAction } from "@/app/admin/actions/products";
import { requirePermission } from "@/lib/admin";
import { listCategoriesAdmin, listProductsAdmin, PRODUCT_STATUSES, productStatusLabel, type ProductStatus } from "@/lib/admin-catalog";
import { can } from "@/lib/permissions";
import { bn, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "পণ্য" };

export default function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Products searchParams={searchParams} />
    </Suspense>
  );
}

async function Products({ searchParams }: { searchParams: PageProps<"/admin/products">["searchParams"] }) {
  await connection();
  const me = await requirePermission("products.view");
  const canEdit = can(me, "products.manage");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const statusRaw = typeof sp.status === "string" ? sp.status : "";
  const status = statusRaw === "scheduled" || (PRODUCT_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as ProductStatus | "scheduled") : undefined;
  const category = Number(sp.category) || undefined;
  const [all, categories] = await Promise.all([listProductsAdmin({ q, status, category }), listCategoriesAdmin()]);
  const rows = sp.stock === "low" ? all.filter((p) => p.low > 0) : all;

  return (
    <>
      <div className="admin-head row">
        <div>
          <h1>পণ্য</h1>
          <p className="lead">{bn(rows.length)}টি পণ্য। প্রকাশিত পণ্যই শুধু দোকানে দেখায়।</p>
        </div>
        {canEdit && <Link className="btn btn-primary" href="/admin/products/new">+ নতুন পণ্য</Link>}
      </div>

      <form className="filter-bar" role="search" action="/admin/products">
        <label className="mini-field wide"><span>খুঁজুন</span><input name="q" defaultValue={q} placeholder="নাম, স্লাগ বা SKU" /></label>
        <label className="mini-field"><span>অবস্থা</span>
          <select name="status" defaultValue={statusRaw}>
            <option value="">সব</option>
            {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{productStatusLabel[s]}</option>)}
            <option value="scheduled">নির্ধারিত সময়ে প্রকাশ</option>
          </select>
        </label>
        <label className="mini-field"><span>ক্যাটাগরি</span>
          <select name="category" defaultValue={category ?? ""}>
            <option value="">সব</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="mini-field"><span>স্টক</span>
          <select name="stock" defaultValue={typeof sp.stock === "string" ? sp.stock : ""}>
            <option value="">সব</option>
            <option value="low">কম স্টক</option>
          </select>
        </label>
        <button className="btn btn-ghost" type="submit">দেখান</button>
      </form>

      {rows.length === 0 ? (
        <p className="reviews-empty">কোনো পণ্য পাওয়া যায়নি।</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">পণ্য</th><th scope="col">ক্যাটাগরি</th><th scope="col">দাম</th><th scope="col">স্টক</th><th scope="col">অবস্থা</th>{canEdit && <th scope="col">দ্রুত কাজ</th>}</tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const scheduled = Boolean(Number(p.scheduled));
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="prod-cell">
                        {p.image_id
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={`/img/${p.image_id}?v=admin`} alt="" width={44} height={44} loading="lazy" />
                          : <span className="thumb-empty" aria-hidden="true" />}
                        <span>
                          <Link className="strong-link" href={`/admin/products/${p.id}`}>{p.name}</Link>
                          <small>/products/{p.slug}</small>
                        </span>
                      </div>
                    </td>
                    <td>{p.category}</td>
                    <td className="num">{p.min_price === null ? "–" : p.min_price === p.max_price ? taka(p.min_price) : `${taka(p.min_price)}–${taka(p.max_price!)}`}</td>
                    <td className="num">
                      {p.stock === null ? <small>গোনা হয় না</small> : bn(Number(p.stock))}
                      {p.low > 0 && <small className="neg-text">{bn(p.low)} সাইজ কম</small>}
                    </td>
                    <td>
                      <span className={`pill ps-${scheduled ? "scheduled" : p.status}`}>{scheduled ? "নির্ধারিত" : productStatusLabel[p.status]}</span>
                      {scheduled && <small>{dhakaDateTime(p.publish_at!)}</small>}
                    </td>
                    {canEdit && (
                      <td>
                        <form action={setProductStatusAction} className="inline-actions">
                          <input type="hidden" name="id" value={p.id} />
                          {p.status !== "published" && <button className="linkish" name="status" value="published" type="submit">প্রকাশ</button>}
                          {p.status === "published" && <button className="linkish" name="status" value="hidden" type="submit">লুকান</button>}
                          <Link className="linkish" href={`/products/${p.slug}`} target="_blank">দেখুন</Link>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
