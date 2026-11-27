import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-shelf";
import { getCatalog } from "@/lib/catalog";
import { toCard } from "@/lib/products";
import { MAX_QUERY, searchItems, toSearchItem } from "@/lib/search";
import { bn } from "@/lib/site";

// Search result pages are thin and endless; keep them out of search engines.
export const metadata: Metadata = { title: "পণ্য খুঁজুন", robots: { index: false, follow: true } };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="wrap">
      <Suspense fallback={<p className="lead" style={{ padding: "32px 0" }}>খোঁজা হচ্ছে...</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, MAX_QUERY);
  const { products, categories } = await getCatalog();
  const label = new Map(categories.map((c) => [c.id, c.label]));
  const indexed = products.map((p) => ({ ...toSearchItem(p, label.get(p.category) ?? ""), product: p }));
  const found = searchItems(indexed, q);

  return (
    <>
      <nav className="crumbs" aria-label="আপনি এখানে আছেন">
        <ol>
          <li><Link href="/">হোম</Link></li>
          <li aria-current="page">খুঁজুন</li>
        </ol>
      </nav>

      <header className="cat-head">
        <h1>{q ? <>“{q}” খুঁজে {bn(found.length)}টি পণ্য পাওয়া গেছে</> : "পণ্য খুঁজুন"}</h1>
        {!q && <p className="lead">উপরের খোঁজার ঘরে পণ্যের নাম লিখুন, যেমন: মধু, চিংড়ি, চুইঝাল।</p>}
      </header>

      <section className="block" style={{ paddingTop: 24 }} aria-label="খোঁজার ফল">
        {found.length > 0 ? (
          <div className="grid">
            {found.map((r) => <ProductCard key={r.slug} p={toCard(r.product)} />)}
          </div>
        ) : (
          q && (
            <div className="reviews-empty">
              <p>এই নামে কোনো পণ্য পাওয়া যায়নি। অন্য শব্দে খুঁজুন, অথবা ধরন দেখে নিন:</p>
              <p className="chips">
                {categories.map((c) => <Link key={c.id} className="btn btn-ghost" href={`/category/${c.id}`}>{c.label}</Link>)}
              </p>
            </div>
          )
        )}
      </section>
    </>
  );
}
