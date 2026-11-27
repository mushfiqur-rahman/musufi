import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryForm } from "@/components/admin/category-form";
import { requirePermission } from "@/lib/admin";
import { listCategoriesAdmin } from "@/lib/admin-catalog";
import { bn } from "@/lib/site";

export const metadata = { title: "ক্যাটাগরি" };

export default function CategoriesPage() {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Categories />
    </Suspense>
  );
}

async function Categories() {
  await connection();
  await requirePermission("products.manage");
  const list = await listCategoriesAdmin();
  return (
    <>
      <div className="admin-head">
        <h1>ক্যাটাগরি</h1>
        <p className="lead">দোকানের বিভাগ। একটি খুলে সম্পাদনা করুন। লুকানো ক্যাটাগরির পণ্য দোকানে দেখায় না।</p>
      </div>
      {list.map((c) => (
        <details key={c.id} className="panel cat-edit">
          <summary>
            <b>{c.label}</b>
            <span className={`pill ${c.status === "active" ? "ps-published" : "ps-hidden"}`}>{c.status === "active" ? "চালু" : "লুকানো"}</span>
            <small className="num">{bn(c.products)}টি পণ্য · /category/{c.slug}</small>
          </summary>
          <CategoryForm category={c} />
        </details>
      ))}
      <details className="panel cat-edit">
        <summary><b>+ নতুন ক্যাটাগরি</b></summary>
        <CategoryForm category={null} />
      </details>
    </>
  );
}
