import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import { bn, site } from "@/lib/site";
import { phoneText, waLink } from "@/lib/store-config";
import { getStoreSettings } from "@/lib/store-settings";
import { publishedPages } from "@/lib/content";
import { LogoMark, WhatsAppIcon } from "./icons";

export async function SiteFooter() {
  const [{ categories }, settings, pages] = await Promise.all([getCatalog(), getStoreSettings(), publishedPages()]);
  const c = settings.contact;
  return (
    <footer className="site-footer">
      <div className="wrap cols">
        <div>
          <Link className="logo" href="/">
            <LogoMark />
            <span><b>{site.name}</b><small>{site.tagline}</small></span>
          </Link>
          <p style={{ color: "var(--muted)", marginTop: 12, maxWidth: "34ch" }}>
            {site.slogan}। লোনা পানির মাছ, খুলনার চুইঝাল আর খাঁটি ঘরের খাবার, উৎস যাচাই করে বাছাই করা।
          </p>
        </div>
        <div>
          <h2>কেনাকাটা</h2>
          <ul>
            <li><Link href="/#products">সব পণ্য</Link></li>
            {categories.map((c) => (
              <li key={c.id}><Link href={`/category/${c.id}`}>{c.label}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2>সাহায্য</h2>
          <ul>
            <li><Link href="/#delivery">ডেলিভারি ও পেমেন্ট</Link></li>
            <li><Link href="/#faq">প্রশ্ন ও উত্তর</Link></li>
            <li><Link href="/#story">আমাদের গল্প</Link></li>
            {pages.filter((p) => p.in_footer).map((p) => <li key={p.slug}><Link href={`/p/${p.slug}`}>{p.title}</Link></li>)}
          </ul>
        </div>
        <div>
          <h2>যোগাযোগ</h2>
          <ul>
            <li>ফোন: <a className="num" href={`tel:${c.phone}`}>{phoneText(c.phone)}</a></li>
            <li><a href={waLink(c.whatsapp)} target="_blank" rel="noopener" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><WhatsAppIcon width={18} height={18} />হোয়াটসঅ্যাপে লিখুন</a></li>
            <li>{c.address}, {c.district}</li>
            <li>{c.hours}</li>
          </ul>
        </div>
      </div>
      <div className="wrap legal">© {bn(2026)} {site.name} · musufi.com</div>
    </footer>
  );
}
