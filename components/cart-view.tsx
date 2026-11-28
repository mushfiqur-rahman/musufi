"use client";

// The /cart page body: the browser cart's items (change quantity, remove),
// then the shared order form for everything in the cart.

import Link from "next/link";
import { useState } from "react";
import { cartTotal, clearCart, removeFromCart, setCartQty, useCart, CART_MAX_QTY } from "@/lib/cart";
import { bn, taka, type DeliveryZone } from "@/lib/site";
import type { PublicConfig } from "@/lib/store-config";
import { CheckoutForm } from "./checkout-form";
import { ProductPhoto } from "./product-photo";

const ALL_ZONES: DeliveryZone[] = ["dhaka", "outside"];

export function CartView({ config }: { config: PublicConfig }) {
  const lines = useCart();
  const [placed, setPlaced] = useState<string | null>(null);

  if (placed) {
    return (
      <div className="panel cart-done" role="status">
        <h2>ধন্যবাদ! অর্ডার পাওয়া গেছে</h2>
        <p>{placed}</p>
        <p className="cart-done-actions">
          <Link className="btn btn-primary" href="/account">আমার অর্ডার দেখুন</Link>
          <Link className="btn btn-ghost" href="/#products">আরও কেনাকাটা করুন</Link>
        </p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="reviews-empty cart-empty">
        <p>আপনার কার্ট খালি।</p>
        <Link className="btn btn-primary" href="/#products">পণ্য দেখুন</Link>
      </div>
    );
  }

  // Deliverable only where every item can go (e.g. fish: Dhaka only).
  const zones = ALL_ZONES.filter((z) => lines.every((l) => !l.zones || l.zones.includes(z)));

  return (
    <div className="cart-layout">
      <section className="panel" aria-labelledby="h-cart-items">
        <div className="cart-head">
          <h2 id="h-cart-items">কার্টে {bn(lines.length)} ধরনের পণ্য</h2>
          <button type="button" className="linkish danger" onClick={() => { if (confirm("কার্ট খালি করবেন?")) clearCart(); }}>কার্ট খালি করুন</button>
        </div>
        <ul className="cart-lines">
          {lines.map((l) => (
            <li key={`${l.slug}-${l.variant}`} className="cart-line">
              <Link className="cart-thumb" href={`/products/${l.slug}`} tabIndex={-1} aria-hidden="true">
                <ProductPhoto label="" src={l.image} art={l.art} />
              </Link>
              <div className="cart-info">
                <Link href={`/products/${l.slug}`}><b>{l.name}</b></Link>
                <small>{l.label} · {taka(l.price)}</small>
                <div className="qty" role="group" aria-label={`${l.name}: সংখ্যা`}>
                  <button type="button" aria-label="একটি কমান" onClick={() => setCartQty(l.slug, l.variant, l.qty - 1)}>−</button>
                  <output className="num" aria-live="polite">{bn(l.qty)}</output>
                  <button type="button" aria-label="একটি বাড়ান" onClick={() => setCartQty(l.slug, l.variant, l.qty + 1)} disabled={l.qty >= CART_MAX_QTY}>+</button>
                </div>
              </div>
              <div className="cart-line-end">
                <b className="num">{taka(l.price * l.qty)}</b>
                <button type="button" className="linkish danger" onClick={() => removeFromCart(l.slug, l.variant)} aria-label={`${l.name} কার্ট থেকে সরান`}>সরান</button>
              </div>
            </li>
          ))}
        </ul>
        <p className="cart-sub num"><span>পণ্যের দাম</span><b>{taka(cartTotal(lines))}</b></p>
        <p className="hint">দাম অর্ডারের সময় আবার মিলিয়ে নেওয়া হয়। ডেলিভারি চার্জ ঠিকানা দিলে দেখাবে।</p>
      </section>

      <CheckoutForm
        items={lines.map((l) => ({ slug: l.slug, variant: l.variant, qty: l.qty, name: l.name, label: l.label, price: l.price }))}
        zones={zones}
        config={config}
        onPlaced={(message) => { clearCart(); setPlaced(message); }}
      />
    </div>
  );
}
