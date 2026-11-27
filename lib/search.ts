// Product search, shared by the header suggestions (browser) and the /search
// page (server). Pure functions, no dependencies, safe on both sides.
//
// Matching: the query is split into words; every word must appear somewhere in
// the product's text (Bangla or English, case-insensitive). Results are ranked
// so name matches come first.

import type { Product } from "./products";

/** Compact product data the header needs for instant suggestions. */
export type SearchItem = {
  slug: string;
  name: string;
  category: string; // category label
  price: number; // lowest price
  /** Lower-cased text to search in: name, short line, category, slug words, origin, summary. */
  text: string;
  /** Lower-cased name, for ranking. */
  key: string;
};

/** Lower-case, Unicode-normalised, single spaces; hyphens count as spaces (slugs). */
export function normalize(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/[-_/,.।]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * `full` adds the long summary to the searchable text (server results page).
 * The header's list skips it, because that list is sent with every page.
 */
export function toSearchItem(p: Product, categoryLabel: string, full = true): SearchItem {
  const price = Math.min(...p.variants.map((v) => v.price));
  return {
    slug: p.slug,
    name: p.name,
    category: categoryLabel,
    price,
    text: normalize([p.name, p.short, categoryLabel, p.slug, p.origin, p.badge ?? "", full ? p.summary : ""].join(" ")),
    key: normalize(p.name),
  };
}

/** Matching items, best first. An empty query returns nothing. */
export function searchItems<T extends Pick<SearchItem, "text" | "key">>(items: readonly T[], query: string, limit = 50): T[] {
  const words = normalize(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  // Everything that matches anywhere (so "মাছ" lists every fish via its
  // category), ranked so name matches come first ("মধু" → the honeys on top).
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    if (!words.every((w) => item.text.includes(w))) continue;
    const whole = words.join(" ");
    const score =
      (item.key.startsWith(whole) ? 100 : 0) +
      (item.key.includes(whole) ? 50 : 0) +
      words.filter((w) => item.key.includes(w)).length * 10;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}

/** Longest query we accept (longer input is cut, not rejected). */
export const MAX_QUERY = 60;
