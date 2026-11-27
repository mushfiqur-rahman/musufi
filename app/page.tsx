import Link from "next/link";
import { Faq, faqJsonLd, type QA } from "@/components/faq";
import { CashIcon, PinIcon, ReturnIcon, TruckIcon, WhatsAppIcon } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { ProductPhoto } from "@/components/product-photo";
import { ProductShelf } from "@/components/product-shelf";
import { getCatalog, productsInCategory } from "@/lib/catalog";
import { toCard } from "@/lib/products";
import { bn, site, taka, whatsappLink } from "@/lib/site";

const { dhaka, outside } = site.delivery;

// Home page is organised as the questions a first-time visitor asks, in order.
// Each section heading is the question; the line under it is the direct answer.
const faqs: QA[] = [
  {
    q: "মুসুফি কী?",
    a: "মুসুফি একটি বাংলাদেশি অনলাইন শপ। আমরা খুলনা অঞ্চলের লোনা পানির মাছ ও চিংড়ি, খুলনার চুইঝাল, মধু, ঘানির সরিষার তেল, ঘি আর ঘরে তৈরি আচার ও গুড় বিক্রি করি। প্রতিটি পণ্যের উৎস পণ্যের পেজে লেখা থাকে।",
  },
  {
    q: "ডেলিভারি চার্জ কত এবং কত দিন লাগে?",
    a: `${dhaka.label} ${taka(dhaka.fee)}, ${dhaka.days}। ${outside.label} ${taka(outside.fee)}, ${outside.days}। তাজা মাছ এখন শুধু ঢাকার ভেতরে পাঠানো হয়।`,
  },
  {
    q: "পণ্য হাতে পেয়ে কি টাকা দেওয়া যায়?",
    a: "হ্যাঁ, সারা দেশে ক্যাশ অন ডেলিভারি আছে। চাইলে বিকাশ বা নগদেও আগে টাকা পাঠাতে পারেন।",
  },
  {
    q: "পণ্য ভাঙা বা নষ্ট পেলে কী করব?",
    a: "মাছ ডেলিভারির সময়ই খুলে দেখুন। অন্য পণ্যে সমস্যা থাকলে ২৪ ঘণ্টার মধ্যে ছবি তুলে হোয়াটসঅ্যাপে পাঠান। আমরা বদলে দেব বা টাকা ফেরত দেব।",
  },
  {
    q: "খাবারের স্বাদ কেমন তা আগে জানব কীভাবে?",
    a: "প্রতিটি পণ্যের পেজে স্বাদের মাপ (মিষ্টি, টক, ঝাল, ঝাঁঝ), মুখে কেমন লাগে, ঘ্রাণ আর কী দিয়ে খেতে ভালো লাগে তা লেখা আছে।",
  },
];

export default async function Home() {
  const catalog = await getCatalog();
  const { categories, products } = catalog;
  // Featured = first product in the admin's sort order.
  const featured = products[0];
  const fv = featured?.variants[featured.defaultVariant];
  return (
    <>
      <section className="hero" aria-labelledby="h-home">
        <div className="wrap hero-grid">
          <div>
            <p className="slogan">{site.slogan}</p>
            <h1 id="h-home">লোনা পানির মাছ, খুলনার চুইঝাল আর <em>খাঁটি ঘরের খাবার</em></h1>
            <p className="lead">
              মুসুফি একটি অনলাইন শপ। খুলনা-সাতক্ষীরার ভেটকি, পার্সে, বাগদা-গলদা চিংড়ি, খুলনার চুইঝাল, চাকের মধু, ঘানির সরিষার তেল আর ঘরে তৈরি আচার আমরা উৎস যাচাই করে পাঠাই। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।
            </p>
            <nav className="hero-cats" aria-label="কী খুঁজছেন?">
              <p>কী খুঁজছেন?</p>
              <ul>
                {categories.map((c) => (
                  <li key={c.id}><Link href={`/category/${c.id}`}>{c.label}</Link></li>
                ))}
              </ul>
            </nav>
          </div>

          {featured && fv && (
          <article className="hero-pick" aria-labelledby="h-pick">
            <Link href={`/products/${featured.slug}`} className="hp-media" tabIndex={-1} aria-hidden="true">
              <ProductPhoto label="" art={featured.art} src={featured.images?.[0]?.src} />
              <span className="tag">এই সপ্তাহের বাছাই</span>
            </Link>
            <div className="hp-body">
              <h2 id="h-pick"><Link href={`/products/${featured.slug}`}>{featured.name}</Link></h2>
              <p className="meta"><PinIcon width={14} height={14} style={{ color: "var(--green)", flex: "none" }} /><span>{featured.origin} · {featured.short}</span></p>
              <p className="hp-price num"><b>{taka(fv.price)}</b> <span>{fv.label}</span></p>
              <div className="hp-actions">
                <Link className="btn btn-primary" href={`/products/${featured.slug}#order`}>অর্ডার করুন</Link>
                <a className="btn btn-ghost" href={whatsappLink(`আসসালামু আলাইকুম, ${featured.name} সম্পর্কে জানতে চাই।`)} target="_blank" rel="noopener"><WhatsAppIcon />প্রশ্ন করুন</a>
              </div>
            </div>
          </article>
          )}
        </div>

        <div className="wrap">
          <ul className="promise" aria-label="কেন মুসুফি থেকে কিনবেন">
            <li><CashIcon /><span><b>ক্যাশ অন ডেলিভারি</b>পণ্য হাতে পেয়ে টাকা দিন</span></li>
            <li><PinIcon /><span><b>উৎস লেখা</b>কোথা থেকে আসে, পেজেই লেখা</span></li>
            <li><TruckIcon /><span><b>সারা দেশে ডেলিভারি</b>ঢাকায় {dhaka.days}, বাইরে {outside.days}</span></li>
            <li><ReturnIcon /><span><b>সহজ ফেরত</b>নষ্ট হলে বদলে দিই</span></li>
          </ul>
        </div>
      </section>

      <section className="block" id="categories" aria-labelledby="h-cats">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 id="h-cats">মুসুফিতে কী কী পাওয়া যায়?</h2>
              <p>{bn(categories.length)}টি বিভাগে {bn(products.length)}টি পণ্য। বিভাগে ঢুকলে উৎস, দাম আর ডেলিভারির নিয়ম দেখতে পাবেন।</p>
            </div>
          </div>
          <ul className="cat-tiles">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.id}`}>
                  <span className="ct-art"><ProductPhoto label="" art={c.art ?? "jar"} /></span>
                  <span className="ct-text">
                    <b>{c.label}</b>
                    <small>{c.blurb}</small>
                    <small className="ct-count num">{bn(productsInCategory(catalog, c.id).length)}টি পণ্য →</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="block" id="products" aria-labelledby="h-products" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 id="h-products">দাম কত?</h2>
              <p>সব পণ্যের দাম নিচে। পরিমাণ বদলালে দাম বদলে যায়, ডেলিভারি চার্জ আলাদা।</p>
            </div>
          </div>
          <ProductShelf items={products.map(toCard)} categories={categories.map((c) => ({ id: c.id, label: c.label }))} />
        </div>
      </section>

      <section className="block band" aria-labelledby="h-process">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 id="h-process">পণ্য কীভাবে বাছাই করা হয়?</h2>
              <p>উৎস থেকে আপনার হাত পর্যন্ত চারটি ধাপ</p>
            </div>
          </div>
          <ol className="steps">
            <li><b>উৎস যাচাই</b><p>জেলে, চাষি আর মৌয়ালের কাছ থেকে নিজেরা দেখে আনি।</p></li>
            <li><b>মান পরীক্ষা</b><p>মাছের তাজা ভাব, মধু-তেলের খাঁটিত্ব আর খাবারের তারিখ দেখি।</p></li>
            <li><b>যত্নে প্যাকিং</b><p>মাছ বরফের বাক্সে, বোতল লিক-প্রুফ সিলে।</p></li>
            <li><b>ডেলিভারি</b><p>ফোনে নিশ্চিত করে পাঠাই, হাতে পেয়ে টাকা দিন।</p></li>
          </ol>
        </div>
      </section>

      <section className="block" aria-label="কীভাবে অর্ডার করবেন ও আমাদের গল্প">
        <div className="wrap two">
          <aside className="panel soft" id="delivery" aria-labelledby="h-delivery">
            <h2 id="h-delivery">কীভাবে অর্ডার করবেন?</h2>
            <p>পণ্যের পেজে তিনটি তথ্য দিলেই অর্ডার হয়ে যায়।</p>
            <ol className="howto">
              <li>পণ্য আর পরিমাণ বেছে নিন</li>
              <li>নাম, মোবাইল নম্বর আর ঠিকানা দিন</li>
              <li>আমরা ফোন করে অর্ডার নিশ্চিত করব</li>
            </ol>
            <table className="fee-table num">
              <caption className="sr-only-x">ডেলিভারি চার্জ</caption>
              <tbody>
                <tr><th scope="row">{dhaka.label} ({dhaka.days})</th><td>{taka(dhaka.fee)}</td></tr>
                <tr><th scope="row">{outside.label} ({outside.days})</th><td>{taka(outside.fee)}</td></tr>
              </tbody>
            </table>
            <div className="pay" aria-label="পেমেন্টের উপায়">
              {site.payments.map((p) => <span key={p}>{p}</span>)}
            </div>
          </aside>
          <article className="panel" id="story" aria-labelledby="h-story">
            <h2 id="h-story">মুসুফি কারা চালায়?</h2>
            <div className="who">
              <div className="avatar">আপনার ছবি</div>
              <div>
                <b>{site.founder}</b>
                <br />
                <span style={{ color: "var(--muted)", fontSize: ".9rem" }}>প্রতিষ্ঠাতা, মুসুফি · {site.district}</span>
              </div>
            </div>
            {/* TODO: owner's own words — why they started, how products are chosen. */}
            <p>
              এখানে আপনার নিজের কথায় ৩–৪ লাইন থাকবে: কেন শুরু করলেন, কীভাবে পণ্য বাছাই করেন, কার কাছ থেকে আনেন। আসল মানুষ, আসল জায়গা আর তারিখ থাকলে ক্রেতা আর এআই সার্চ দুটোই বেশি বিশ্বাস করে।
            </p>
          </article>
        </div>
      </section>

      <section className="block" id="faq" aria-labelledby="h-faq" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="sec-head"><h2 id="h-faq">আরও প্রশ্ন</h2></div>
          <Faq items={faqs} openFirst />
        </div>
      </section>
      <JsonLd data={faqJsonLd(faqs)} />
    </>
  );
}
