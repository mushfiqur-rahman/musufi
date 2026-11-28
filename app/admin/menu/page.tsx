import { connection } from "next/server";
import { Suspense } from "react";
import { MenuEditor } from "@/components/admin/menu-editor";
import { requirePermission } from "@/lib/admin";
import { getCatalog } from "@/lib/catalog";
import { publishedPages } from "@/lib/content";
import { loadMenuItems } from "@/lib/menu";

export const metadata = { title: "মেনু" };

/** Admin chooses which categories, products, pages and links the main menu shows. */
export default function MenuAdmin() {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Menu />
    </Suspense>
  );
}

async function Menu() {
  await connection();
  await requirePermission("content.manage");
  const [items, { categories, products }, pages] = await Promise.all([loadMenuItems(), getCatalog(), publishedPages()]);
  return (
    <>
      <div className="admin-head">
        <h1>মেনু</h1>
        <p className="lead">
          সাইটের উপরের সবুজ মেনুতে (ফোনে ☰ মেনুর “মূল মেনু” অংশে) কোন লিংক কোন ক্রমে দেখাবে, এখান থেকে ঠিক করুন।
          “সকল ক্যাটাগরি” বাটনে সব ক্যাটাগরি সবসময় থাকে। কোনো পণ্য বা পেজ পরে লুকানো বা মুছে ফেলা হলে তার লিংক নিজে থেকেই সরে যাবে।
        </p>
      </div>
      <section className="panel" aria-label="মেনুর লিংক">
        <MenuEditor
          initial={items}
          options={{
            categories: categories.map((c) => ({ ref: c.id, name: c.label })),
            products: products.map((p) => ({ ref: p.slug, name: p.name })),
            pages: pages.map((p) => ({ ref: p.slug, name: p.title })),
          }}
        />
      </section>
    </>
  );
}
