"use server";
// Coupons, review moderation, content pages and the announcement bar.
// Same pattern everywhere: permission → validate → write → audit → refresh.

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { COUPON_TYPES, normalizeCode, saveCoupon } from "@/lib/coupons";
import { moderateReview, REVIEWS_TAG } from "@/lib/reviews";
import { CONTENT_TAG, saveAnnouncement, savePage } from "@/lib/content";
import { actionError, dhakaDateTimeLocal, oneOf, slug, text, ValidationError, wholeNumber, type ActionResult } from "@/lib/validate";

export async function saveCouponAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("marketing.manage");
    const idRaw = String(form.get("id") ?? "");
    const id = idRaw ? wholeNumber(idRaw, "id", { min: 1, max: 100_000_000 }) : null;
    const code = normalizeCode(form.get("code"));
    if (!code) throw new ValidationError("code", "কোড: ৩–৩০ অক্ষর, ইংরেজি অক্ষর/সংখ্যা/-/_");
    const type = oneOf(form.get("type"), COUPON_TYPES, "ধরন");
    const value = wholeNumber(form.get("value"), "মান", { max: 1_000_000 }) ?? 0;
    if (type === "percent" && (value < 1 || value > 90)) throw new ValidationError("value", "শতাংশ ১ থেকে ৯০-এর মধ্যে দিন");
    if (type === "fixed" && value < 1) throw new ValidationError("value", "ছাড়ের টাকা দিন");
    const startsAt = dhakaDateTimeLocal(form.get("startsAt"), "শুরু");
    const endsAt = dhakaDateTimeLocal(form.get("endsAt"), "শেষ");
    if (startsAt && endsAt && endsAt <= startsAt) throw new ValidationError("endsAt", "শেষের সময় শুরুর পরে হতে হবে");
    const savedId = await saveCoupon(id, {
      code,
      type,
      value: type === "free_shipping" ? 0 : value,
      minSubtotal: wholeNumber(form.get("minSubtotal"), "সর্বনিম্ন কেনাকাটা", { max: 10_000_000 }) ?? 0,
      maxDiscount: type === "percent" ? wholeNumber(form.get("maxDiscount"), "সর্বোচ্চ ছাড়", { min: 1, max: 1_000_000 }) : null,
      startsAt,
      endsAt,
      usageLimit: wholeNumber(form.get("usageLimit"), "মোট ব্যবহার", { min: 1, max: 1_000_000 }),
      perCustomer: wholeNumber(form.get("perCustomer"), "প্রতি ক্রেতা", { min: 1, max: 1000 }) ?? 1,
      active: form.get("active") === "1",
      note: text(form.get("note"), "নোট", { max: 200 }) || null,
    });
    await audit(me, "coupon.save", "coupon", savedId, { code, type, value });
    refresh();
    return { ok: true, message: `কুপন ${code} সংরক্ষণ হয়েছে।`, id: savedId };
  } catch (e) {
    return actionError("coupon.save", e);
  }
}

export async function moderateReviewAction(form: FormData): Promise<void> {
  const me = await assertPermission("marketing.manage");
  const id = wholeNumber(form.get("id"), "id", { min: 1, max: 100_000_000, required: true })!;
  const status = oneOf(form.get("status"), ["approved", "rejected", "pending"] as const, "অবস্থা");
  const reply = text(form.get("reply"), "উত্তর", { max: 1000 }) || null;
  await moderateReview(id, status, reply);
  await audit(me, "review.moderate", "review", id, { status });
  updateTag(REVIEWS_TAG);
  refresh();
}

export async function savePageAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  let created: string | null = null;
  try {
    const me = await assertPermission("content.manage");
    const idRaw = String(form.get("id") ?? "");
    const id = idRaw ? wholeNumber(idRaw, "id", { min: 1, max: 1_000_000 }) : null;
    const input = {
      slug: slug(form.get("slug")),
      title: text(form.get("title"), "শিরোনাম", { max: 120, required: true }),
      body: text(form.get("body"), "লেখা", { max: 60_000 }),
      metaDescription: text(form.get("metaDescription"), "SEO বিবরণ", { max: 170 }) || null,
      status: oneOf(form.get("status"), ["draft", "published"] as const, "অবস্থা"),
      inFooter: form.get("inFooter") === "1",
      sort: wholeNumber(form.get("sort"), "ক্রম", { max: 30_000 }) ?? 0,
    };
    const savedId = await savePage(id, input);
    await audit(me, "page.save", "page", savedId, { slug: input.slug, status: input.status });
    updateTag(CONTENT_TAG);
    if (id === null) created = input.slug;
    else {
      refresh();
      return { ok: true, message: "পেজ সংরক্ষণ হয়েছে।", id: savedId };
    }
  } catch (e) {
    return actionError("page.save", e);
  }
  // A new page replaces its "starter" form in the list, which would lose the
  // in-form message, so show the result as a page-level notice instead.
  redirect(`/admin/pages?created=${encodeURIComponent(created)}`);
}

export async function saveAnnouncementAction(form: FormData): Promise<void> {
  const me = await assertPermission("content.manage");
  const a = {
    active: form.get("active") === "1",
    text: text(form.get("text"), "ঘোষণা", { max: 160 }),
    link: text(form.get("link"), "লিংক", { max: 200 }),
  };
  // Only internal paths or https links, so the bar can't be used for javascript: links.
  if (a.link && !/^\/[\w\-/#?=&.%]*$/.test(a.link) && !/^https:\/\/[\w.-]+(\/\S*)?$/.test(a.link)) a.link = "";
  await saveAnnouncement(a);
  await audit(me, "announcement.save", "settings", "announcement", { active: a.active });
  updateTag(CONTENT_TAG);
  redirect("/admin/pages?ann=1");
}
