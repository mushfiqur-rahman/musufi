"use client";

import Link from "next/link";
import { useState } from "react";
import type { CardProduct, CategoryId } from "@/lib/products";
import { taka } from "@/lib/site";
import { ProductPhoto } from "./product-photo";
import { AddToCartButton } from "./add-to-cart-button";

export function ProductCard({ p, headingLevel = 3 }: { p: CardProduct; headingLevel?: 2 | 3 }) {
  const [sel, setSel] = useState(p.defaultVariant);
  const v = p.variants[sel];
  const href = `/products/${p.slug}`;
  const allSoldOut = p.variants.every((x) => x.stock !== undefined && x.stock <= 0);
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="card">
      <Link className="media" href={href} tabIndex={-1} aria-hidden="true">
        {allSoldOut ? <span className="tag sold">স্টক শেষ</span> : p.badge && <span className={`tag${p.badge === "ঘরে তৈরি" ? " green" : ""}`}>{p.badge}</span>}
        <ProductPhoto label="" art={p.art} src={p.image} />
      </Link>
      <div className="body">
        <H><Link href={href}>{p.name}</Link></H>
        <p className="meta">{p.short}</p>
        {p.tasteLine && <p className="taste-line"><span>স্বাদ:</span> {p.tasteLine}</p>}
        {p.variants.length > 1 ? (
          <div className="sizes" role="group" aria-label={`${p.name}: পরিমাণ`}>
            {p.variants.map((x, i) => (
              <button key={x.label} type="button" aria-pressed={i === sel} onClick={() => setSel(i)} className={x.stock !== undefined && x.stock <= 0 ? "sold" : undefined}>
                {x.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="meta">{v.label}</p>
        )}
        <p className="price num" aria-live="polite">
          <b>{taka(v.price)}</b>
          {v.compareAt && <s aria-label={`আগের দাম ${taka(v.compareAt)}`}>{taka(v.compareAt)}</s>}
        </p>
        <AddToCartButton
          item={{ slug: p.slug, variant: sel, name: p.name, label: v.label, price: v.price, image: p.image, art: p.art }}
          soldOut={allSoldOut || (v.stock !== undefined && v.stock <= 0)}
        />
      </div>
    </article>
  );
}

export function ProductShelf({ items, categories }: { items: CardProduct[]; categories: { id: string; label: string }[] }) {
  const [cat, setCat] = useState<CategoryId | "all">("all");
  const shown = cat === "all" ? items : items.filter((p) => p.category === cat);
  const chips: { id: CategoryId | "all"; label: string }[] = [{ id: "all", label: "সব" }, ...categories];
  return (
    <>
      <div className="chips" role="group" aria-label="ধরন অনুযায়ী দেখুন">
        {chips.map((c) => (
          <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid">
        {shown.map((p) => (
          <ProductCard key={p.slug} p={p} />
        ))}
      </div>
    </>
  );
}
