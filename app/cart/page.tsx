import type { Metadata } from "next";
import Link from "next/link";
import { CartView } from "@/components/cart-view";
import { publicConfig } from "@/lib/store-config";
import { getStoreSettings } from "@/lib/store-settings";

// A personal page (the cart lives in the browser), so keep it out of search engines.
export const metadata: Metadata = { title: "আমার কার্ট", robots: { index: false } };

export default async function CartPage() {
  const settings = await getStoreSettings();
  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="আপনি এখানে আছেন">
        <ol>
          <li><Link href="/">হোম</Link></li>
          <li aria-current="page">কার্ট</li>
        </ol>
      </nav>
      <header className="cat-head">
        <h1>আমার কার্ট</h1>
      </header>
      <CartView config={publicConfig(settings)} />
    </div>
  );
}
