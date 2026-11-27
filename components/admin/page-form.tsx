"use client";

import { useActionState } from "react";
import { savePageAction } from "@/app/admin/actions/marketing";
import type { Page } from "@/lib/content";
import type { ActionResult } from "@/lib/validate";

/** Create (page = null) or edit a content page. */
export function PageForm({ page, preset }: { page: Page | null; preset?: { slug: string; title: string; body: string } }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(savePageAction, null);
  const p = page ? `pg${page.id}` : `pg-${preset?.slug ?? "new"}`;
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="id" value={page?.id ?? ""} />
      <div className="grid-2">
        <label className="mini-field"><span>শিরোনাম</span><input id={`${p}-t`} name="title" defaultValue={page?.title ?? preset?.title ?? ""} required maxLength={120} /></label>
        <label className="mini-field"><span>URL স্লাগ</span><input id={`${p}-s`} name="slug" defaultValue={page?.slug ?? preset?.slug ?? ""} required maxLength={60} placeholder="যেমন: return-policy" /></label>
        <label className="mini-field"><span>অবস্থা</span>
          <select name="status" defaultValue={page?.status ?? "draft"}><option value="draft">খসড়া</option><option value="published">প্রকাশিত</option></select>
        </label>
        <label className="mini-field"><span>ক্রম</span><input name="sort" inputMode="numeric" defaultValue={page?.sort ?? 0} /></label>
      </div>
      <label className="mini-field"><span>SEO বিবরণ (ঐচ্ছিক)</span><input name="metaDescription" defaultValue={page?.meta_description ?? ""} maxLength={170} /></label>
      <label className="mini-field">
        <span>লেখা: ## শিরোনাম, - তালিকা, **মোটা**, [লিংক](/products)। খালি লাইন দিয়ে নতুন অনুচ্ছেদ।</span>
        <textarea name="body" defaultValue={page?.body ?? preset?.body ?? ""} rows={14} maxLength={60000} />
      </label>
      <label className="mini-field check"><input type="checkbox" name="inFooter" value="1" defaultChecked={page ? Boolean(page.in_footer) : true} /><span>ফুটারে লিংক দেখাবে</span></label>
      <div className="form-bar">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}</button>
        {state && <p className={`notice ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</p>}
      </div>
    </form>
  );
}
