"use client";

// Header cart: basket icon, item count badge and the cart total (from the
// browser cart, lib/cart.ts). Opens /cart.

import Link from "next/link";
import { cartCount, cartTotal, useCart } from "@/lib/cart";
import { bn, taka } from "@/lib/site";

export function BasketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8L3 9Z" />
      <path d="m8 9 3-5M16 9l-3-5M9 13v3M15 13v3M12 13v3" />
    </svg>
  );
}

export function CartButton() {
  const lines = useCart();
  const count = cartCount(lines);
  const total = cartTotal(lines);
  return (
    <Link
      className="cart-btn"
      href="/cart"
      aria-label={count ? `কার্ট: ${bn(count)}টি পণ্য, মোট ${taka(total)}` : "কার্ট খালি"}
    >
      <span className="cart-ic">
        <BasketIcon />
        <span className="cart-count num" aria-hidden="true">{bn(count)}</span>
      </span>
      <span className="cart-total num" aria-hidden="true">{taka(total)}</span>
    </Link>
  );
}
