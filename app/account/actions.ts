"use server";
// Customer-side actions (logged-in customers only).

import { updateTag } from "next/cache";
import { refresh } from "next/cache";
import { currentCustomer } from "@/lib/auth";
import { REVIEWS_TAG, submitReview } from "@/lib/reviews";
import { actionError, text, ValidationError, wholeNumber, type ActionResult } from "@/lib/validate";

/** A verified buyer reviews a product from a delivered order. Goes to moderation first. */
export async function submitReviewAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const me = await currentCustomer();
    if (!me) return { ok: false, message: "রিভিউ দিতে লগইন করুন।" };
    const rating = wholeNumber(form.get("rating"), "রেটিং", { min: 1, max: 5, required: true })!;
    const body = text(form.get("body"), "রিভিউ", { max: 1000, min: 10, required: true });
    const displayName = text(form.get("displayName"), "নাম", { max: 60 }) || me.name || "ক্রেতা";
    const orderId = wholeNumber(form.get("orderId"), "অর্ডার", { min: 1, max: 100_000_000, required: true })!;
    const productId = wholeNumber(form.get("productId"), "পণ্য", { min: 1, max: 100_000_000, required: true })!;
    const ok = await submitReview({ customerId: me.id, orderId, productId, rating, body, displayName });
    if (!ok) throw new ValidationError("orderId", "শুধু ডেলিভারি হওয়া অর্ডারের পণ্যে একবার রিভিউ দেওয়া যায়।");
    updateTag(REVIEWS_TAG);
    refresh();
    return { ok: true, message: "ধন্যবাদ! যাচাইয়ের পর রিভিউটি পণ্যের পেজে দেখাবে।" };
  } catch (e) {
    return actionError("review.submit", e);
  }
}
