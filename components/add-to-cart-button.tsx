"use client";

// "কার্টে যোগ করুন" button used on product cards and the home page pick.
// Adds one item and briefly confirms with "যোগ হয়েছে ✓".

import { useState } from "react";
import { addToCart, type CartLine } from "@/lib/cart";
import { BasketIcon } from "./cart-button";

export function AddToCartButton({ item, soldOut = false, className = "btn btn-primary" }: {
  /** The product + size to add (qty 1). */
  item: Omit<CartLine, "qty">;
  soldOut?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "added" | "full">("idle");
  return (
    <button
      type="button"
      className={`${className} add-cart${state === "added" ? " is-added" : ""}`}
      disabled={soldOut}
      aria-label={`${item.name} (${item.label}) কার্টে যোগ করুন`}
      onClick={() => {
        setState(addToCart({ ...item, qty: 1 }) ? "added" : "full");
        setTimeout(() => setState("idle"), 1600);
      }}
    >
      <BasketIcon />
      <span aria-live="polite">{soldOut ? "স্টক শেষ" : state === "added" ? "যোগ হয়েছে ✓" : state === "full" ? "কার্ট ভরা" : "কার্টে যোগ করুন"}</span>
    </button>
  );
}
