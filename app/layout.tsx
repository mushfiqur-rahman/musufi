import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Poppins } from "next/font/google";
import { JsonLd } from "@/components/json-ld";
import { WhatsAppIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCatalog } from "@/lib/catalog";
import { site } from "@/lib/site";
import { paymentNames, waLink } from "@/lib/store-config";
import { getStoreSettings } from "@/lib/store-settings";
import "./globals.css";

// Poppins draws Latin letters and digits; Hind Siliguri (same foundry) draws Bangla.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const hind = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16211a" },
  ],
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
  const [{ categories }, settings] = await Promise.all([getCatalog(), getStoreSettings()]);
  const orgJsonLd = storeJsonLd(settings.contact.phone, paymentNames(settings.payments));
  return (
    <html lang="bn" data-scroll-behavior="smooth" className={`${poppins.variable} ${hind.variable}`}>
      <body>
        <a className="skip" href="#main">মূল অংশে যান</a>
        <SiteHeader phone={settings.contact.phone} categories={categories.map((c) => ({ id: c.id, label: c.label }))} />
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
