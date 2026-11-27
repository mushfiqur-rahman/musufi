"use client";

import { useActionState, useMemo, useState } from "react";
import { saveCategoryAction } from "@/app/admin/actions/products";
import type { AdminCategory } from "@/lib/admin-catalog";
import type { ActionResult } from "@/lib/validate";
import { Field, RowEditor } from "./row-editor";

type State = Omit<AdminCategory, "id" | "products">;

const blank: State = {
  slug: "", label: "", blurb: "", intro: "", factsTitle: "পণ্যের তথ্য", zones: ["dhaka", "outside"], policy: "", faq: [], art: null, sort: 0, status: "active",
};

/** Create (category = null) or edit one category. */
export function CategoryForm({ category }: { category: AdminCategory | null }) {
  const [f, setF] = useState<State>(() => (category ? { ...category } : blank));
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveCategoryAction, null);
  const set = <K extends keyof State>(k: K, v: State[K]) => setF((x) => ({ ...x, [k]: v }));
  const payload = useMemo(() => JSON.stringify(f), [f]);
  const zone = (z: "dhaka" | "outside", on: boolean) => set("zones", on ? [...new Set([...f.zones, z])] : f.zones.filter((x) => x !== z));
  const idp = category ? `c${category.id}` : "cnew";

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="id" value={category?.id ?? ""} />
      <input type="hidden" name="payload" value={payload} />
      <div className="grid-2">
        <div className="field"><label htmlFor={`${idp}-l`}>নাম</label><input id={`${idp}-l`} value={f.label} onChange={(e) => set("label", e.target.value)} maxLength={80} /></div>
        <div className="field"><label htmlFor={`${idp}-s`}>URL স্লাগ (ইংরেজিতে)</label><input id={`${idp}-s`} value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} maxLength={80} placeholder="যেমন: fish" /></div>
        <div className="field"><label htmlFor={`${idp}-b`}>টাইলে ছোট বিবরণ</label><input id={`${idp}-b`} value={f.blurb} onChange={(e) => set("blurb", e.target.value)} maxLength={160} /></div>
        <div className="field"><label htmlFor={`${idp}-p`}>নীতি (পণ্য পেজে)</label><input id={`${idp}-p`} value={f.policy} onChange={(e) => set("policy", e.target.value)} maxLength={200} placeholder="যেমন: শুধু ঢাকার ভেতরে · বরফে প্যাক" /></div>
        <div className="field"><label htmlFor={`${idp}-ft`}>তথ্য টেবিলের শিরোনাম</label><input id={`${idp}-ft`} value={f.factsTitle} onChange={(e) => set("factsTitle", e.target.value)} maxLength={60} /></div>
        <div className="field"><label htmlFor={`${idp}-o`}>ক্রম (ছোট সংখ্যা আগে)</label><input id={`${idp}-o`} inputMode="numeric" value={f.sort} onChange={(e) => set("sort", Number(e.target.value.replace(/\D/g, "")) || 0)} /></div>
      </div>
      <div className="field">
        <label htmlFor={`${idp}-i`}>ভূমিকা (ক্যাটাগরি পেজের শুরুতে, সরাসরি উত্তরের মতো)</label>
        <textarea id={`${idp}-i`} value={f.intro} onChange={(e) => set("intro", e.target.value)} maxLength={1500} />
      </div>
      <fieldset className="field">
        <legend>ডেলিভারি এলাকা</legend>
        <label className="mini-field check"><input type="checkbox" checked={f.zones.includes("dhaka")} onChange={(e) => zone("dhaka", e.target.checked)} /><span>ঢাকার ভেতরে</span></label>
        <label className="mini-field check"><input type="checkbox" checked={f.zones.includes("outside")} onChange={(e) => zone("outside", e.target.checked)} /><span>ঢাকার বাইরে</span></label>
      </fieldset>
      <div className="field">
        <label htmlFor={`${idp}-st`}>অবস্থা</label>
        <select id={`${idp}-st`} value={f.status} onChange={(e) => set("status", e.target.value as State["status"])}>
          <option value="active">চালু</option>
          <option value="hidden">লুকানো (এর পণ্যও দোকানে দেখাবে না)</option>
        </select>
      </div>
      <RowEditor
        legend="প্রশ্ন-উত্তর"
        rows={f.faq}
        onChange={(rows) => set("faq", rows)}
        blank={() => ({ q: "", a: "" })}
        addLabel="প্রশ্ন যোগ করুন"
        render={(r, put) => (
          <>
            <Field label="প্রশ্ন" wide><input value={r.q} onChange={(e) => put({ ...r, q: e.target.value })} /></Field>
            <Field label="উত্তর" wide><textarea value={r.a} onChange={(e) => put({ ...r, a: e.target.value })} /></Field>
          </>
        )}
      />
      <div className="form-bar">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে..." : category ? "সংরক্ষণ" : "ক্যাটাগরি তৈরি করুন"}</button>
        {state && <p className={`notice ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</p>}
      </div>
    </form>
  );
}
