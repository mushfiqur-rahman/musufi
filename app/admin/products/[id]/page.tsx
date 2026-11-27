import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DeleteProduct } from "@/components/admin/delete-product";
import { ImageManager } from "@/components/admin/image-manager";
import { ProductForm } from "@/components/admin/product-form";
import { requirePermission } from "@/lib/admin";
import { getProductAdmin, listCategoriesAdmin, listImages, listProductsAdmin, productStatusLabel } from "@/lib/admin-catalog";
import { listAudit, actionLabel } from "@/lib/audit";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "পণ্য সম্পাদনা" };

// /admin/products/new creates; /admin/products/<id> edits.
export default function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ params, searchParams }: { params: PageProps<"/admin/products/[id]">["params"]; searchParams: PageProps<"/admin/products/[id]">["searchParams"] }) {
  await connection();
  await requirePermission("products.manage");
  const { id: rawId } = await params;
  const sp = await searchParams;
  const isNew = rawId === "new";
  const id = isNew ? null : Number(rawId);
  if (!isNew && (!Number.isInteger(id) || id! <= 0)) notFound();

  const [product, categories, all, images, history] = await Promise.all([
    id ? getProductAdmin(id) : null,
    listCategoriesAdmin(),
    listProductsAdmin({}),
    id ? listImages(id) : [],
    id ? listAudit({ entity: "product", entityId: String(id), limit: 10 }) : [],
  ]);
  if (!isNew && !product) notFound();

  return (
    <>
      <p className="crumbs"><Link href="/admin/products">← সব পণ্য</Link></p>
      <div className="admin-head row">
        <div>
          <h1>{product ? product.name : "নতুন পণ্য"}</h1>
          {product && (
            <p className="lead">
              <span className={`pill ps-${product.status}`}>{productStatusLabel[product.status]}</span> · শেষ পরিবর্তন {dhakaDateTime(product.updatedAt)}
            </p>
          )}
        </div>
        {product && <Link className="btn btn-ghost" href={`/products/${product.slug}`} target="_blank">দোকানে দেখুন ↗</Link>}
      </div>
      {sp.created && <p className="notice ok" role="status">পণ্য তৈরি হয়েছে। এখন ছবি যোগ করুন, তারপর প্রকাশ করুন।</p>}
      {sp.saved && <p className="notice ok" role="status">সংরক্ষণ হয়েছে। দোকানে সাথে সাথে দেখাবে।</p>}
      {categories.length === 0 && <p className="zone-note">আগে একটি ক্যাটাগরি তৈরি করুন। <Link href="/admin/categories">ক্যাটাগরি</Link></p>}

      {product && <ImageManager productId={product.id} productName={product.name} images={images} />}

      <ProductForm
        key={product ? `${product.id}-${product.updatedAt.toString()}` : "new"}
        product={product}
        categories={categories.map((c) => ({ id: c.id, label: c.label }))}
        allProducts={all.map((p) => ({ slug: p.slug, name: p.name }))}
      />

      {product && history.length > 0 && (
        <section className="panel" aria-labelledby="h-hist">
          <h2 id="h-hist">পরিবর্তনের ইতিহাস</h2>
          <ol className="log">
            {history.map((h) => (
              <li key={h.id}><b>{actionLabel[h.action] ?? h.action}</b><small>{dhakaDateTime(h.created_at)} · {h.actor_email ?? "সিস্টেম"}</small></li>
            ))}
          </ol>
        </section>
      )}

      {product && <DeleteProduct id={product.id} name={product.name} />}
    </>
  );
}
