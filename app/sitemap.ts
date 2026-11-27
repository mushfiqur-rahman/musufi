import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { publishedPages } from "@/lib/content";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ categories, products }, pages] = await Promise.all([getCatalog(), publishedPages()]);
  return [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    ...categories.map((c) => ({
      url: `${site.url}/category/${c.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...pages.map((p) => ({ url: `${site.url}/p/${p.slug}`, lastModified: p.updated_at, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...products.map((p) => ({
      url: `${site.url}/products/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
