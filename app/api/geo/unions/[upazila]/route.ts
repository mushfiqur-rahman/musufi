// Unions of one upazila, for the address picker. Public, read-only, and the
// same answer for everyone, so browsers and CDNs may cache it for a day.
import { unionsOf } from "@/lib/geo-unions";

export async function GET(_request: Request, ctx: RouteContext<"/api/geo/unions/[upazila]">) {
  const { upazila } = await ctx.params;
  const id = Number(upazila);
  if (!Number.isInteger(id) || id <= 0 || id > 100_000) return Response.json([], { status: 400 });
  return Response.json(unionsOf(id).map((u) => [u.id, u.bn]), {
    headers: { "cache-control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
