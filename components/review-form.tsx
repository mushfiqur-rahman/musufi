"use client";

import { useActionState, useState } from "react";
import { submitReviewAction } from "@/app/account/actions";
import type { ActionResult } from "@/lib/validate";

/** Star rating + text for one delivered product. */
export function ReviewForm({ orderId, productId, productName, defaultName }: { orderId: number; productId: number; productName: string; defaultName: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(submitReviewAction, null);
  const [rating, setRating] = useState(5);
  const id = `rv-${orderId}-${productId}`;
  if (state?.ok) return <p className="notice ok" role="status">{state.message}</p>;
  return (
    <form action={action} className="admin-form review-form">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <fieldset className="stars">
        <legend>{productName}: কেমন লেগেছে?</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={n <= rating} aria-label={`${n} তারা`} onClick={() => setRating(n)}>{n <= rating ? "★" : "☆"}</button>
        ))}
      </fieldset>
      <label className="mini-field"><span>আপনার অভিজ্ঞতা (কমপক্ষে ১০ অক্ষর)</span><textarea id={`${id}-b`} name="body" required minLength={10} maxLength={1000} placeholder="স্বাদ, মান, প্যাকিং, ডেলিভারি কেমন ছিল?" /></label>
      <label className="mini-field"><span>যে নামে দেখাবে</span><input id={`${id}-n`} name="displayName" defaultValue={defaultName} maxLength={60} /></label>
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "পাঠানো হচ্ছে..." : "রিভিউ দিন"}</button>
      {state && !state.ok && <p className="notice bad" role="status">{state.message}</p>}
    </form>
  );
}
