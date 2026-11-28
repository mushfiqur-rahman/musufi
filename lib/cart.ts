"use client";

// Shopping cart, kept only in this browser (localStorage). No database:
// the header icon and total read from here. Prices here are for showing only;
// when the customer orders, the server loads every price fresh from the database.

import { useMemo, useSyncExternalStore } from "react";
import type { Art } from "./products";
import type { DeliveryZone } from "./site";

export type CartLine = {
  slug: string;
  variant: number;
  qty: number;
  /** Shown in the cart; the server never uses these. */
  name: string;
  label: string;
  price: number;
  image?: string;
  /** Drawn illustration when there is no photo. */
  art?: Art;
  /** Where this product can be delivered (for an early warning in the cart). */
  zones?: DeliveryZone[];
};

const KEY = "ms-cart";
const EVENT = "ms-cart-change";
export const CART_MAX_LINES = 20;
export const CART_MAX_QTY = 20;

function readRaw(): string {
  try { return localStorage.getItem(KEY) ?? "[]"; } catch { return "[]"; }
}

function parse(raw: string): CartLine[] {
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter((l): l is CartLine =>
      Boolean(l) && typeof l.slug === "string" && Number.isInteger(l.variant) && Number.isInteger(l.qty) && l.qty > 0 && typeof l.price === "number",
    ).slice(0, CART_MAX_LINES);
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* private mode: cart lasts for this page only */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

// The server and the first render in the browser see an empty cart, so the
// HTML matches; the real cart appears right after.
const EMPTY = "[]";
function snapshot(): string { return readRaw(); }

/** The cart's lines, live (updates when anything changes it, in any tab). */
export function useCart(): CartLine[] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return useMemo(() => parse(raw), [raw]);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0);
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.price * l.qty, 0);
}

/** Adds (or increases) a product + size. Returns false if the cart is full. */
export function addToCart(line: CartLine): boolean {
  const lines = parse(readRaw());
  const i = lines.findIndex((l) => l.slug === line.slug && l.variant === line.variant);
  if (i >= 0) {
    // Refresh name/price in case they changed since it was added.
    lines[i] = { ...line, qty: Math.min(CART_MAX_QTY, lines[i].qty + line.qty) };
  } else {
    if (lines.length >= CART_MAX_LINES) return false;
    lines.push({ ...line, qty: Math.min(CART_MAX_QTY, line.qty) });
  }
  write(lines);
  return true;
}

export function setCartQty(slug: string, variant: number, qty: number) {
  const lines = parse(readRaw())
    .map((l) => (l.slug === slug && l.variant === variant ? { ...l, qty: Math.max(0, Math.min(CART_MAX_QTY, qty)) } : l))
    .filter((l) => l.qty > 0);
  write(lines);
}

export function removeFromCart(slug: string, variant: number) {
  write(parse(readRaw()).filter((l) => !(l.slug === slug && l.variant === variant)));
}

export function clearCart() {
  write([]);
}
