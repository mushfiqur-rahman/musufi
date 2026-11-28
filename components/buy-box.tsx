"use client";

// Product page purchase box: price, size, quantity, "কার্টে যোগ করুন",
// quick contact, and the order form for buying just this product now.

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { Art, Variant } from "@/lib/products";
import { waLink, type PublicConfig } from "@/lib/store-config";
import { bn, taka, type DeliveryZone } from "@/lib/site";
import { addToCart } from "@/lib/cart";
import { CheckoutForm } from "./checkout-form";
import { BasketIcon } from "./cart-button";
import { PhoneIcon, WhatsAppIcon } from "./icons";

export function BuyBox({ slug, name, variants, defaultVariant, zones, config, image, art }: {
  slug: string;
  name: string;
  variants: Variant[];
  defaultVariant: number;
  /** Zones this product's category delivers to. */
  zones: DeliveryZone[];
  /** Store settings the form needs (fees, Dhaka districts, contact). */
  config: PublicConfig;
  /** First photo, shown in the cart. */
  image?: string;
  /** Illustration when there is no photo. */
  art?: Art;
}) {
  // Untracked stock (undefined) is always available.
  const soldOut = (x: Variant) => x.stock !== undefined && x.stock <= 0;
  const firstAvailable = soldOut(variants[defaultVariant]) ? Math.max(0, variants.findIndex((x) => !soldOut(x))) : defaultVariant;
  const allSoldOut = variants.every(soldOut);
  const [sel, setSel] = useState(firstAvailable);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    document.body.classList.add("has-buybar");
    return () => document.body.classList.remove("has-buybar");
  }, []);

  const v = variants[sel];

  function onAdd() {
    const ok = addToCart({ slug, variant: sel, qty, name, label: v.label, price: v.price, image, art, zones });
    setAdded(ok ? `${name} (${v.label}) × ${bn(qty)} কার্টে যোগ হয়েছে।` : "কার্ট ভরে গেছে (সর্বোচ্চ ২০ ধরনের পণ্য)। আগে কার্ট থেকে অর্ডার করুন।");
  }

  const waText = `আসসালামু আলাইকুম, আমি অর্ডার করতে চাই: ${name} ${v.label} × ${bn(qty)}`;

  return (
    <>
      <div>
        <p className="big-price num">
          <b>{taka(v.price)}</b>
          {v.compareAt && (
            <>
              <s aria-label={`আগের দাম ${taka(v.compareAt)}`}>{taka(v.compareAt)}</s>
              <span className="save">{taka(v.compareAt - v.price)} সাশ্রয়</span>
            </>
          )}
        </p>
        <p className="unit">{v.label}</p>
        {allSoldOut && <p className="notice bad" role="status">এই পণ্য এখন স্টকে নেই। হোয়াটসঅ্যাপে জানালে স্টক এলে জানিয়ে দেব।</p>}
      </div>

      {variants.length > 1 && (
        <fieldset>
          <legend>পরিমাণ বেছে নিন</legend>
          <div className="sizes lg">
            {variants.map((x, i) => (
              <button key={x.label} type="button" aria-pressed={i === sel} onClick={() => { setSel(i); setAdded(null); }} disabled={soldOut(x)} className={soldOut(x) ? "sold" : undefined}>
                {x.label}{soldOut(x) ? " · স্টক নেই" : x.stock !== undefined && x.stock <= 5 ? ` · মাত্র ${bn(x.stock)}টি` : ""}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="qty-row">
        <span id={`${id}-q`} style={{ fontWeight: 600 }}>সংখ্যা</span>
        <div className="qty" role="group" aria-labelledby={`${id}-q`}>
          <button type="button" aria-label="একটি কমান" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <output className="num" aria-live="polite">{bn(qty)}</output>
          <button type="button" aria-label="একটি বাড়ান" onClick={() => setQty((q) => Math.min(20, q + 1))}>+</button>
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={onAdd} disabled={allSoldOut || soldOut(v)}><BasketIcon />কার্টে যোগ করুন</button>
        <a className="btn btn-ghost btn-lg" href="#order">এখনই কিনুন</a>
        <a className="btn btn-wa" href={waLink(config.whatsapp, waText)} target="_blank" rel="noopener"><WhatsAppIcon />হোয়াটসঅ্যাপ</a>
        <a className="btn btn-ghost" href={`tel:${config.phone}`}><PhoneIcon />কল করুন</a>
      </div>
      {added && (
        <p className="notice ok added-note" role="status">
          {added} <Link href="/cart">কার্ট দেখুন ও অর্ডার করুন →</Link>
        </p>
      )}

      <CheckoutForm
        items={[{ slug, variant: sel, qty, name, label: v.label, price: v.price }]}
        zones={zones}
        config={config}
        disabled={allSoldOut || soldOut(v)}
      />

      <div className="buybar" aria-label="দ্রুত অর্ডার">
        <div className="wrap">
          <div><b className="num">{taka(v.price * qty)}</b><small>{v.label}{qty > 1 ? ` × ${bn(qty)}` : ""}</small></div>
          <button type="button" className="btn btn-ghost" onClick={onAdd} disabled={allSoldOut || soldOut(v)} aria-label="কার্টে যোগ করুন"><BasketIcon /></button>
          <a className="btn btn-primary" href="#order">এখনই কিনুন</a>
        </div>
      </div>
    </>
  );
}
