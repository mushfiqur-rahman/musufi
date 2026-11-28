import type { Metadata, Viewport } from "next";
import { Noto_Serif_Bengali, Poppins } from "next/font/google";
import { JsonLd } from "@/components/json-ld";
import { WhatsAppIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, SiteHeaderLive } from "@/components/site-header";
import { Suspense } from "react";
import { getCatalog } from "@/lib/catalog";
import { site } from "@/lib/site";
import { paymentNames, waLink } from "@/lib/store-config";
import { getStoreSettings } from "@/lib/store-settings";
import { getAnnouncement } from "@/lib/content";
import { toSearchItem } from "@/lib/search";
import { getMenuLinks } from "@/lib/menu";
import { A11yBar, A11Y_BOOT_SCRIPT } from "@/components/a11y-bar";
import Link from "next/link";
import "./globals.css";

// Poppins draws Latin letters and digits; Noto Serif Bengali draws Bangla.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  // Two weights only (fewer font files = faster first load); CSS 500/700 use the nearest.
  weight: ["400", "600"],
  display: "swap",
  // The site is Bangla, so Latin glyphs are rare; don't make the first paint wait on them.
  preload: false,
});

// Variable font: one file covers every weight (400–700 used), so it is lighter
// than loading separate weights. Preloaded because almost all text is Bangla.
const bangla = Noto_Serif_Bengali({
  variable: "--font-bangla",
  subsets: ["bengali"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | লোনা পানির মাছ, চুইঝাল ও খাঁটি ঘরের খাবার`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.nameLatin,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "bn_BD",
    siteName: site.name,
    url: site.url,
    title: `${site.name} | লোনা পানির মাছ, চুইঝাল ও খাঁটি ঘরের খাবার`,
    description: site.description,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light", // light only: customers here prefer it
};

function storeJsonLd(phone: string, payments: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${site.url}/#store`,
    name: site.name,
    alternateName: site.nameLatin,
    url: site.url,
    description: site.description,
    telephone: `+88${phone}`,
    areaServed: { "@type": "Country", name: "Bangladesh" },
    paymentAccepted: payments.join(", "),
    currenciesAccepted: "BDT",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ categories, products }, settings, announcement, menu] = await Promise.all([getCatalog(), getStoreSettings(), getAnnouncement(), getMenuLinks()]);
  const headerProps = {
    menu,
    categories: categories.map((c) => ({ id: c.id, label: c.label, blurb: c.blurb })),
    searchItems: products.map((p) => toSearchItem(p, categories.find((c) => c.id === p.category)?.label ?? "", false)),
  };
  const orgJsonLd = storeJsonLd(settings.contact.phone, paymentNames(settings.payments));
  return (
    // suppressHydrationWarning: the reading-controls script below may set a font size
    // and a class on <html> before React loads; that difference is intended.
    <html lang="bn" data-scroll-behavior="smooth" className={`${poppins.variable} ${bangla.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT_SCRIPT }} />
      </head>
      <body>
        <A11yBar />
        <a className="skip" href="#main">মূল অংশে যান</a>
        {announcement.active && announcement.text && (
          <div className="announce" role="region" aria-label="ঘোষণা">
            <div className="wrap">{announcement.link ? <Link href={announcement.link}>{announcement.text} →</Link> : announcement.text}</div>
          </div>
        )}
        <Suspense fallback={<SiteHeader {...headerProps} path={null} />}>
          <SiteHeaderLive {...headerProps} />
        </Suspense>
        <main id="main">{children}</main>
        <SiteFooter />
        <a className="fab" href={waLink(settings.contact.whatsapp, "আসসালামু আলাইকুম, আমি অর্ডার করতে চাই।")} target="_blank" rel="noopener" aria-label="হোয়াটসঅ্যাপে প্রশ্ন করুন">
          <WhatsAppIcon />
          <span>প্রশ্ন আছে?</span>
        </a>
        <JsonLd data={orgJsonLd} />
      </body>
    </html>
  );
}
