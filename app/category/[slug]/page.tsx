import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Faq, faqJsonLd } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { ProductCard } from "@/components/product-shelf";
import { findCategory, getCatalog, productsInCategory } from "@/lib/catalog";
import { toCard } from "@/lib/products";
import { bn, site } from "@/lib/site";

export async function generateStaticParams() {
  const { categories } = await getCatalog();
  return categories.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = findCategory(await getCatalog(), slug);
  if (!c) return {};
  return {
    title: c.label,
    description: c.intro,
    alternates: { canonical: `/category/${c.id}` },
    openGraph: { type: "website", title: `${c.label} | ${site.name}`, description: c.intro, url: `/category/${c.id}` },
  };
}

export default function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  return (
    <Suspense fallback={<div className="wrap block" aria-busy="true"><p style={{ color: "var(--muted)" }}>লোড হচ্ছে...</p></div>}>
      <CategoryView params={params} />
    </Suspense>
  );
}

async function CategoryView({ params }: { params: PageProps<"/category/[slug]">["params"] }) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const c = findCategory(catalog, slug);
  if (!c) notFound();
  const { categories } = catalog;
  const items = productsInCategory(catalog, c.id);
  const url = `${site.url}/category/${c.id}`;

  const listLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: c.label,
    description: c.intro,
    url,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${site.url}/products/${p.slug}`,
        name: p.name,
      })),
    },
  };
  const crumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "হোম", item: site.url },
      { "@type": "ListItem", position: 2, name: c.label, item: url },
    ],
  };

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="আপনি এখানে আছেন">
        <ol>
          <li><Link href="/">হোম</Link></li>
          <li aria-current="page">{c.label}</li>
        </ol>
      </nav>

      <header className="cat-head">
        <h1>{c.label}</h1>
        <p className="lead">{c.intro}</p>
        <p className="cat-policy">{c.policy}</p>
      </header>

      <section className="block" style={{ paddingTop: 24 }} aria-labelledby="h-items">
        <div className="sec-head">
          <h2 id="h-items">{c.label}: {bn(items.length)}টি পণ্য</h2>
        </div>
        {items.length > 0 ? (
          <div className="grid">
            {items.map((p) => <ProductCard key={p.slug} p={toCard(p)} />)}
          </div>
        ) : (
          <p className="reviews-empty">এই ক্যাটাগরিতে শিগগিরই পণ্য আসছে।</p>
        )}
      </section>

      {c.faq.length > 0 && (
        <section className="block" style={{ paddingTop: 0 }} aria-labelledby="h-cfaq">
          <div className="sec-head"><h2 id="h-cfaq">{c.label} নিয়ে প্রশ্ন</h2></div>
          <Faq items={c.faq} />
          <JsonLd data={faqJsonLd(c.faq)} />
        </section>
      )}

      <nav className="block" style={{ paddingTop: 0 }} aria-labelledby="h-other">
        <h2 id="h-other" style={{ fontSize: "var(--step-1)", marginBottom: 12 }}>অন্য ক্যাটাগরি</h2>
        <ul className="cat-links">
          {categories.filter((x) => x.id !== c.id).map((x) => (
            <li key={x.id}><Link href={`/category/${x.id}`}>{x.label}</Link></li>
          ))}
        </ul>
      </nav>

      <JsonLd data={listLd} />
      <JsonLd data={crumbLd} />
    </div>
  );
}
