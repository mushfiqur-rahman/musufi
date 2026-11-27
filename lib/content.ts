// Content pages (About, policies…) and the announcement bar. Server-only.
// Public reads are cached with the "content" tag; admin saves call updateTag(CONTENT_TAG).
import { cacheLife, cacheTag } from "next/cache";
import { dbConfigured, execute, select, selectOne } from "./db";

export const CONTENT_TAG = "content";

export type Page = {
  id: number;
  slug: string;
  title: string;
  body: string;
  meta_description: string | null;
  status: "draft" | "published";
  in_footer: number;
  sort: number;
  updated_at: Date;
};

export type Announcement = { active: boolean; text: string; link: string };

/** Published pages for the footer and the sitemap. */
export async function publishedPages(): Promise<Pick<Page, "slug" | "title" | "in_footer" | "updated_at">[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  if (!dbConfigured()) return [];
  try {
    return await select("SELECT slug, title, in_footer, updated_at FROM pages WHERE status = 'published' ORDER BY sort, id");
  } catch {
    return [];
  }
}

export async function publishedPage(slug: string): Promise<Page | null> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  if (!dbConfigured()) return null;
  try {
    return await selectOne<Page>("SELECT * FROM pages WHERE slug = ? AND status = 'published'", [slug]);
  } catch {
    return null;
  }
}

export async function getAnnouncement(): Promise<Announcement> {
  "use cache";
  cacheTag(CONTENT_TAG);
  cacheLife("hours");
  const off = { active: false, text: "", link: "" };
  if (!dbConfigured()) return off;
  try {
    const r = await selectOne<{ value: string }>("SELECT value FROM settings WHERE name = 'announcement'");
    return r ? { ...off, ...JSON.parse(r.value) } : off;
  } catch {
    return off;
  }
}

// ---------- Admin ----------

export async function listPagesAdmin(): Promise<Page[]> {
  return select<Page>("SELECT * FROM pages ORDER BY sort, id");
}

export async function getPageAdmin(id: number): Promise<Page | null> {
  return selectOne<Page>("SELECT * FROM pages WHERE id = ?", [id]);
}

export async function savePage(
  id: number | null,
  p: { slug: string; title: string; body: string; metaDescription: string | null; status: "draft" | "published"; inFooter: boolean; sort: number },
): Promise<number> {
  const v = [p.slug, p.title, p.body, p.metaDescription, p.status, p.inFooter ? 1 : 0, p.sort];
  if (id === null) {
    const r = await execute("INSERT INTO pages (slug, title, body, meta_description, status, in_footer, sort) VALUES (?, ?, ?, ?, ?, ?, ?)", v);
    return r.insertId;
  }
  await execute("UPDATE pages SET slug = ?, title = ?, body = ?, meta_description = ?, status = ?, in_footer = ?, sort = ? WHERE id = ?", [...v, id]);
  return id;
}

export async function saveAnnouncement(a: Announcement): Promise<void> {
  await execute("INSERT INTO settings (name, value) VALUES ('announcement', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [JSON.stringify(a)]);
}
