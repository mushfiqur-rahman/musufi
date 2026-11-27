import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BuyBox } from "@/components/buy-box";
import { Faq, faqJsonLd } from "@/components/faq";
import { CalendarIcon, CashIcon, PinIcon, TruckIcon } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { ProductPhoto } from "@/components/product-photo";
import { ProductCard } from "@/components/product-shelf";
import { ProductGallery } from "@/components/product-gallery";
import { TasteProfile } from "@/components/taste-profile";
import { findCategory, findProduct, getCatalog } from "@/lib/catalog";
import { imagesFor, toCard } from "@/lib/products";
import { publicConfig } from "@/lib/store-config";
import { getStoreSettings } from "@/lib/store-settings";
import { productReviews } from "@/lib/reviews";
import { dhakaDateTime } from "@/lib/time";
import { site, taka } from "@/lib/site";

export async function generateStaticParams() {
  const { products } = await getCatalog();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = findProduct(await getCatalog(), slug);
  if (!p) return {};
  const from = Math.min(...p.variants.map((v) => v.price));
  return {
    // Admin-set SEO fields win; otherwise build them from the product.
    title: p.metaTitle || p.name,
    description: p.metaDescription || `${p.summary} দাম ${taka(from)} থেকে। সারা দেশে ক্যাশ অন ডেলিভারি।`,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { type: "website", title: p.name, description: p.summary, url: `/products/${p.slug}` },
  };
}

// Every product is prerendered by generateStaticParams. The Suspense boundary
// lets navigation show the page frame instantly while the slug resolves.
export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <Suspense fallback={<ProductFallback />}>
      <ProductView params={params} />
    </Suspense>
  );
}

function ProductFallback() {
  return (
    <div className="wrap" aria-busy="true">
      <div className="crumbs">&nbsp;</div>
      <div className="pdp">
        <div className="gallery"><div className="main"><ProductPhoto label="লোড হচ্ছে" /></div></div>
        <div className="buy"><p style={{ color: "var(--muted)" }}>লোড হচ্ছে...</p></div>
      </div>
    </div>
  );
}

async function ProductView({ params }: { params: PageProps<"/products/[slug]">["params"] }) {
  const { slug } = await params;
  const [catalog, settings] = await Promise.all([getCatalog(), getStoreSettings()]);
  const p = findProduct(catalog, slug);
  if (!p) notFound();
  const cat = findCategory(catalog, p.category);
  if (!cat) notFound();

  const related = p.related.map((s) => findProduct(catalog, s)).filter((x) => x !== undefined);
  const rv = p.id ? await productReviews(p.id) : { count: 0, average: 0, reviews: [] };
  const { dhaka, outside } = settings.delivery;
  const faqs = [...p.faq, ...cat.faq];
  const dhakaOnly = !cat.zones.includes("outside");
  const url = `${site.url}/products/${p.slug}`;

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.summary,
    url,
    image: imagesFor(p).filter((im) => im.src).map((im) => `${site.url}${im.src}`),
    category: cat.label,
    brand: { "@type": "Brand", name: site.name },
    countryOfOrigin: "BD",
    ...(rv.count > 0
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: rv.average, reviewCount: rv.count, bestRating: 5, worstRating: 1 },
          review: rv.reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            author: { "@type": "Person", name: r.display_name },
            reviewBody: r.body,
            datePublished: new Date(r.created_at).toISOString().slice(0, 10),
          })),
        }
      : {}),
    offers: p.variants.map((v) => ({
      "@type": "Offer",
      name: `${p.name} ${v.label}`,
      price: v.price,
      priceCurrency: "BDT",
      availability: "https://schema.org/InStock",
      url,
      seller: { "@id": `${site.url}/#store` },
    })),
  };
  const crumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "হোম", item: site.url },
      { "@type": "ListItem", position: 2, name: cat.label, item: `${site.url}/category/${p.category}` },
      { "@type": "ListItem", position: 3, name: p.name, item: url },
    ],
  };

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="আপনি এখানে আছেন">
        <ol>
          <li><Link href="/">হোম</Link></li>
          <li><Link href={`/category/${p.category}`}>{cat.label}</Link></li>
          <li aria-current="page">{p.name}</li>
        </ol>
      </nav>

      <div className="pdp">
        <ProductGallery images={imagesFor(p)} name={p.name} badge={p.badge} />

        <div className="buy">
          <div>
            <h1>{p.name}</h1>
            <p className="origin"><PinIcon />উৎস: {p.origin}</p>
          </div>
          <p className="summary"><b>এক কথায়:</b> {p.summary}</p>
          {p.taste && <p className="taste-line" style={{ fontSize: ".95rem" }}><span>স্বাদ:</span> {p.taste.oneLine} · <a href="#h-taste">বিস্তারিত দেখুন</a></p>}
          <BuyBox slug={p.slug} name={p.name} variants={p.variants} defaultVariant={p.defaultVariant} zones={cat.zones} config={publicConfig(settings)} />
          <ul className="info-list">
            <li><TruckIcon /><span>{dhakaOnly ? `শুধু ${dhaka.label} ${taka(dhaka.fee)} (${dhaka.days})` : `${dhaka.label} ${taka(dhaka.fee)} (${dhaka.days}), ${outside.label} ${taka(outside.fee)} (${outside.days})`}<small>অর্ডারের পর ফোন করে নিশ্চিত করা হয়</small></span></li>
            <li><CashIcon /><span>পণ্য হাতে পেয়ে টাকা দিন<small>বিকাশ ও নগদেও দেওয়া যায়</small></span></li>
            <li><CalendarIcon /><span>{cat.policy}</span></li>
          </ul>
        </div>
      </div>

      <div className="detail">
        <div style={{ display: "grid", gap: 32, minWidth: 0 }}>
          {p.taste && <TasteProfile taste={p.taste} name={p.name} />}
          <section className="prose" aria-label="পণ্যের বিবরণ">
            {p.sections.map((s) => (
              <div key={s.q} style={{ display: "grid", gap: 8 }}>
                <h2>{s.q}</h2>
                <p>{s.a}</p>
              </div>
            ))}
          </section>
          {faqs.length > 0 && (
            <section aria-labelledby="h-pfaq">
              <h2 id="h-pfaq" style={{ fontSize: "var(--step-1)", marginBottom: 12 }}>এই পণ্য নিয়ে প্রশ্ন</h2>
              <Faq items={faqs} />
            </section>
          )}
        </div>
        <div style={{ display: "grid", gap: 32, minWidth: 0 }}>
          <section aria-labelledby="h-facts">
            <h2 id="h-facts" style={{ fontSize: "var(--step-1)", marginBottom: 12 }}>{cat.factsTitle}</h2>
            <div className="facts-wrap">
              <table className="facts">
                <tbody>
                  {p.facts.map((f) => (
                    <tr key={f.label}><th scope="row">{f.label}</th><td>{f.value}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby="h-rev">
            <h2 id="h-rev" style={{ fontSize: "var(--step-1)", marginBottom: 12 }}>ক্রেতাদের মতামত</h2>
            {rv.count === 0 ? (
              <div className="reviews-empty">
                <p>এখনো কোনো রিভিউ নেই। এই পণ্য কিনেছেন এমন ক্রেতারা অ্যাকাউন্ট থেকে রিভিউ দিতে পারবেন।</p>
              </div>
            ) : (
              <div className="review-list">
                <p className="review-avg"><b className="num">{rv.average.toLocaleString("bn-BD")}</b> <span aria-hidden="true">{"★".repeat(Math.round(rv.average))}</span> <span className="num">({rv.count.toLocaleString("bn-BD")}টি যাচাই করা রিভিউ)</span></p>
                {rv.reviews.map((r) => (
                  <article key={r.id} className="review-item">
                    <p><b aria-label={`${r.rating}/5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</b> · {r.display_name} · <small>{dhakaDateTime(r.created_at)}</small> · <span className="pill">যাচাই করা ক্রেতা</span></p>
                    <p>{r.body}</p>
                    {r.reply && <p className="review-reply"><b>মুসুফি:</b> {r.reply}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="block" aria-labelledby="h-rel">
        <div className="sec-head"><h2 id="h-rel">এর সাথে অনেকে নেন</h2></div>
        <div className="grid">
          {related.map((r) => <ProductCard key={r.slug} p={toCard(r)} />)}
        </div>
      </section>

      <JsonLd data={productLd} />
      <JsonLd data={crumbLd} />
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
    </div>
  );
}
