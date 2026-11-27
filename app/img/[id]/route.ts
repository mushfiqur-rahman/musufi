// Serves a product photo stored in the database.
// URLs carry ?v=<timestamp>, so a changed photo gets a new URL and the old one
// can be cached forever by browsers and CDNs.
import { getImageData } from "@/lib/admin-catalog";
import { dbConfigured } from "@/lib/db";

export async function GET(_request: Request, ctx: RouteContext<"/img/[id]">) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!dbConfigured() || !Number.isInteger(n) || n <= 0) return new Response("Not found", { status: 404 });
  const img = await getImageData(n).catch(() => null);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "content-type": img.mime,
      "content-length": String(img.data.length),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
