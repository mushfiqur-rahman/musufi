// The site's main menu (green bar on computers, "মূল মেনু" tab on phones),
// chosen by the admin on Admin → মেনু. Stored as JSON in settings (name 'menu'),
// cached with the "menu" tag. Server-only.
//
// Each item points at something real (a category, a product, a content page)
// or is a custom link; the label can be left empty to use the item's own name.
// Items whose target was deleted or unpublished are skipped automatically.
// The "সকল ক্যাটাগরি" dropdown always lists every category and is not part of this.

import { cacheLife, cacheTag } from "next/cache";
import { getCatalog } from "./catalog";
import { publishedPages } from "./content";
import { dbConfigured, execute, selectOne } from "./db";

export const MENU_TAG = "menu";
export const MENU_KINDS = ["home", "category", "product", "page", "link"] as const;
export type MenuKind = (typeof MENU_KINDS)[number];

/** What is saved. `ref` = category id, product slug, page slug or URL (by kind). */
export type MenuItem = { kind: MenuKind; ref: string; label: string };
/** What the header gets. */
export type MenuLink = { href: string; label: string };

export const MAX_MENU_ITEMS = 12;

/** Starting menu until the admin saves one: home, every category, two help links. */
function defaultMenu(categoryIds: string[]): MenuItem[] {
  return [
    { kind: "home", ref: "", label: "" },
    ...categoryIds.map((id) => ({ kind: "category" as const, ref: id, label: "" })),
    { kind: "link", ref: "/#delivery", label: "ডেলিভারি ও পেমেন্ট" },
    { kind: "link", ref: "/#faq", label: "প্রশ্ন ও উত্তর" },
  ];
}

/** Only links inside the site ("/…") or https:// links; nothing like javascript:. */
export function safeHref(v: string): string | null {
  const s = v.trim();
  if (/^\/(?!\/)[\w\-./#?=&%~+]*$/.test(s)) return s;
  if (/^https:\/\/[\w.-]+(?::\d+)?(\/[^\s<>"']*)?$/.test(s)) return s;
  return null;
}

/** Cleans a list from the database or the admin form. Unknown kinds and bad links are dropped. */
export function cleanMenu(raw: unknown): MenuItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MenuItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const kind = MENU_KINDS.find((k) => k === o.kind);
    if (!kind) continue;
    const ref = typeof o.ref === "string" ? o.ref.trim().slice(0, 300) : "";
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 40) : "";
    if (kind === "link" && (!label || !safeHref(ref))) continue;
    if ((kind === "category" || kind === "product" || kind === "page") && !/^[a-z0-9-]{1,80}$/.test(ref)) continue;
    out.push({ kind, ref: kind === "home" ? "" : ref, label });
    if (out.length >= MAX_MENU_ITEMS) break;
  }
  return out;
}

/** Saved menu items (or the default), for the admin editor. */
export async function loadMenuItems(): Promise<MenuItem[]> {
  const { categories } = await getCatalog();
  if (!dbConfigured()) return defaultMenu(categories.map((c) => c.id));
  const row = await selectOne<{ value: string }>("SELECT value FROM settings WHERE name = 'menu'");
  return row ? cleanMenu(JSON.parse(row.value)) : defaultMenu(categories.map((c) => c.id));
}

export async function saveMenuItems(items: MenuItem[]): Promise<void> {
  await execute(
    "INSERT INTO settings (name, value) VALUES ('menu', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [JSON.stringify(cleanMenu(items))],
  );
}

/** The menu as links, for the header. Cached; refreshed when the admin saves. */
export async function getMenuLinks(): Promise<MenuLink[]> {
  "use cache";
  cacheTag(MENU_TAG, "catalog", "content");
  cacheLife("hours");
  let items: MenuItem[];
  try {
    items = await loadMenuItems();
  } catch (e) {
    console.error("[menu] using default:", e instanceof Error ? e.message : e);
    const { categories } = await getCatalog();
    items = defaultMenu(categories.map((c) => c.id));
  }
  const [{ categories, products }, pages] = await Promise.all([getCatalog(), publishedPages().catch(() => [])]);
  const links: MenuLink[] = [];
  for (const it of items) {
    if (it.kind === "home") links.push({ href: "/", label: it.label || "হোম" });
    else if (it.kind === "category") {
      const c = categories.find((x) => x.id === it.ref);
      if (c) links.push({ href: `/category/${c.id}`, label: it.label || c.label });
    } else if (it.kind === "product") {
      const p = products.find((x) => x.slug === it.ref);
      if (p) links.push({ href: `/products/${p.slug}`, label: it.label || p.name });
    } else if (it.kind === "page") {
      const pg = pages.find((x) => x.slug === it.ref);
      if (pg) links.push({ href: `/p/${pg.slug}`, label: it.label || pg.title });
    } else {
      const href = safeHref(it.ref);
      if (href) links.push({ href, label: it.label });
    }
  }
  return links;
}
