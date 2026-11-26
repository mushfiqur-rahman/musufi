import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Search engines and AI search crawlers are welcome on public pages.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/account", "/admin"] },
      { userAgent: ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Googlebot", "Bingbot"], allow: "/", disallow: ["/api/", "/account", "/admin"] },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
