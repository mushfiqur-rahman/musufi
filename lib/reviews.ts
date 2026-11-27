// Product reviews from verified buyers. Server-only.
// A customer may review a product once per delivered order that contains it.
// Reviews show on the shop only after staff approve them.
import { cacheLife, cacheTag } from "next/cache";
import { dbConfigured, execute, select, selectOne } from "./db";

export const REVIEWS_TAG = "reviews";

export type PublicReview = { id: number; rating: number; body: string; display_name: string; reply: string | null; created_at: Date };
export type ReviewSummary = { count: number; average: number; reviews: PublicReview[] };

/** Approved reviews for a product page (cached; refreshed on moderation). */
export async function productReviews(productId: number): Promise<ReviewSummary> {
  "use cache";
  cacheTag(REVIEWS_TAG);
  cacheLife("hours");
  if (!dbConfigured()) return { count: 0, average: 0, reviews: [] };
  try {
    const reviews = await select<PublicReview>(
      "SELECT id, rating, body, display_name, reply, created_at FROM reviews WHERE product_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 30",
      [productId],
    );
    const agg = await selectOne<{ n: number; avg: number | null }>(
      "SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE product_id = ? AND status = 'approved'",
      [productId],
    );
    return { count: Number(agg?.n ?? 0), average: Math.round(Number(agg?.avg ?? 0) * 10) / 10, reviews };
  } catch {
    return { count: 0, average: 0, reviews: [] };
  }
}

/** Delivered (order, product) pairs this customer can still review. */
export async function reviewableItems(customerId: number) {
  return select<{ order_id: number; order_no: string; product_id: number; product_name: string; slug: string }>(
    `SELECT DISTINCT o.id AS order_id, o.order_no, p.id AS product_id, p.name AS product_name, p.slug
     FROM orders o
     JOIN order_items i ON i.order_id = o.id
     JOIN product_variants v ON v.id = i.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN reviews r ON r.customer_id = o.customer_id AND r.product_id = p.id AND r.order_id = o.id
     WHERE o.customer_id = ? AND o.status = 'delivered' AND r.id IS NULL
     ORDER BY o.id DESC LIMIT 20`,
    [customerId],
  );
}

/** Saves a pending review after checking it's a verified purchase. Returns false if not allowed. */
export async function submitReview(r: { customerId: number; orderId: number; productId: number; rating: number; body: string; displayName: string }): Promise<boolean> {
  const allowed = (await reviewableItems(r.customerId)).some((x) => x.order_id === r.orderId && x.product_id === r.productId);
  if (!allowed) return false;
  await execute(
    "INSERT INTO reviews (product_id, customer_id, order_id, rating, body, display_name) VALUES (?, ?, ?, ?, ?, ?)",
    [r.productId, r.customerId, r.orderId, r.rating, r.body, r.displayName],
  );
  return true;
}

export type AdminReview = PublicReview & { status: "pending" | "approved" | "rejected"; product: string; slug: string; email: string; order_no: string };

export async function listReviewsAdmin(status: "pending" | "approved" | "rejected"): Promise<AdminReview[]> {
  return select<AdminReview>(
    `SELECT r.id, r.rating, r.body, r.display_name, r.reply, r.created_at, r.status, p.name AS product, p.slug, c.email, o.order_no
     FROM reviews r JOIN products p ON p.id = r.product_id JOIN customers c ON c.id = r.customer_id JOIN orders o ON o.id = r.order_id
     WHERE r.status = ? ORDER BY r.id DESC LIMIT 100`,
    [status],
  );
}

export async function moderateReview(id: number, status: "pending" | "approved" | "rejected", reply: string | null): Promise<void> {
  await execute("UPDATE reviews SET status = ?, reply = ?, moderated_at = UTC_TIMESTAMP() WHERE id = ?", [status, reply, id]);
}

export async function pendingReviewCount(): Promise<number> {
  const r = await selectOne<{ n: number }>("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'");
  return Number(r?.n ?? 0);
}
