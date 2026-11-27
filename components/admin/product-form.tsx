"use client";

// Product create/edit form. Keeps everything in one state object, sends it as
// a JSON payload to saveProductAction, which validates every field again.

import { useActionState, useMemo, useState } from "react";
import { saveProductAction } from "@/app/admin/actions/products";
import type { AdminProduct, AdminVariant } from "@/lib/admin-catalog";
import { tasteLabels, type Taste, type TasteKey } from "@/lib/products";
import type { ActionResult } from "@/lib/validate";
import { Field, RowEditor } from "./row-editor";

type Option = { id: number; label: string };
type Related = { slug: string; name: string };

type FormState = {
  slug: string;
  name: string;
  short: string;
  categoryId: number | "";
  badge: string;
  summary: string;
  origin: string;
  facts: { label: string; value: string }[];
  sections: { q: string; a: string }[];
  faq: { q: string; a: string }[];
  hasTaste: boolean;
  taste: Taste;
  related: string[];
  art: string;
  status: "draft" | "published" | "hidden";
  publishAt: string; // datetime-local, Dhaka time
  metaTitle: string;
  metaDescription: string;
  defaultVariant: number;
  sort: number;
  variants: VariantState[];
};
type VariantState = { id?: number; label: string; price: string; compareAt: string; cost: string; sku: string; stock: string; lowStock: string };

const ART_LABEL: Record<string, string> = {
  "": "কোনোটি না", bottle: "বোতল", jar: "বয়াম", ghee: "ঘি", pickle: "আচার", gur: "গুড়", muri: "মুড়ি", fish: "মাছ", prawn: "চিংড়ি", stem: "কাণ্ড (চুইঝাল)",
};
const TASTE_KEYS = Object.keys(tasteLabels) as TasteKey[];

const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** UTC Date → "YYYY-MM-DDTHH:mm" in Dhaka time for <input type="datetime-local">. */
function toDhakaLocal(d: Date | string | null): string {
  if (!d) return "";
  return new Date(new Date(d).getTime() + 6 * 3600_000).toISOString().slice(0, 16);
}

/** Suggests a URL slug from an English-ish name; Bangla names need a manual slug. */
function suggestSlug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function initial(p: AdminProduct | null, categories: Option[]): FormState {
  const blankTaste: Taste = { oneLine: "", levels: {}, texture: "", aroma: "", bestWith: [] };
  return {
    slug: p?.slug ?? "",
    name: p?.name ?? "",
    short: p?.short ?? "",
    categoryId: p?.categoryId ?? categories[0]?.id ?? "",
    badge: p?.badge ?? "",
    summary: p?.summary ?? "",
    origin: p?.origin ?? "",
    facts: p?.facts ?? [],
    sections: p?.sections ?? [],
    faq: p?.faq ?? [],
    hasTaste: Boolean(p?.taste),
    taste: p?.taste ?? blankTaste,
    related: p?.related ?? [],
    art: p?.art ?? "",
    status: p?.status ?? "draft",
    publishAt: toDhakaLocal(p?.publishAt ?? null),
    metaTitle: p?.metaTitle ?? "",
    metaDescription: p?.metaDescription ?? "",
    defaultVariant: p?.defaultVariant ?? 0,
    sort: p?.sort ?? 0,
    variants: (p?.variants.length ? p.variants : [{ label: "", price: 0, compareAt: null, cost: null, sku: null, stock: null, lowStock: 5 } as AdminVariant]).map((v) => ({
      id: v.id, label: v.label, price: v.price ? String(v.price) : "", compareAt: s(v.compareAt), cost: s(v.cost), sku: v.sku ?? "", stock: s(v.stock), lowStock: s(v.lowStock),
    })),
  };
}

export function ProductForm({ product, categories, allProducts }: { product: AdminProduct | null; categories: Option[]; allProducts: Related[] }) {
  const [f, setF] = useState<FormState>(() => initial(product, categories));
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveProductAction, null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }));


  const payload = useMemo(() => JSON.stringify({
    ...f,
    taste: f.hasTaste ? f.taste : null,
    variants: f.variants.map((v) => ({ ...v, id: v.id })),
  }), [f]);

  const relatedChoices = allProducts.filter((p) => p.slug !== f.slug);

  return (
    <form action={action} className="admin-form product-form" noValidate>
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <input type="hidden" name="payload" value={payload} />

      <section className="panel" aria-labelledby="pf-basic">
        <h2 id="pf-basic">মূল তথ্য</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pf-name">পণ্যের নাম</label>
            <input id="pf-name" value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="pf-slug">URL স্লাগ (ইংরেজিতে)</label>
            <input id="pf-slug" value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} onBlur={() => !f.slug && set("slug", suggestSlug(f.name))} placeholder="যেমন: bagda-prawn" maxLength={80} aria-describedby="pf-slug-h" />
            <span className="hint" id="pf-slug-h">ওয়েব ঠিকানা হবে musufi.com/products/{f.slug || "…"}। প্রকাশের পর না বদলানোই ভালো।</span>
          </div>
          <div className="field">
            <label htmlFor="pf-cat">ক্যাটাগরি</label>
            <select id="pf-cat" value={f.categoryId} onChange={(e) => set("categoryId", Number(e.target.value))}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pf-badge">ব্যাজ (ঐচ্ছিক)</label>
            <input id="pf-badge" value={f.badge} onChange={(e) => set("badge", e.target.value)} placeholder="যেমন: ঘরে তৈরি, মৌসুমি" maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="pf-short">কার্ডে ছোট বিবরণ</label>
            <input id="pf-short" value={f.short} onChange={(e) => set("short", e.target.value)} maxLength={160} placeholder="যেমন: কাঠের ঘানি · ঠান্ডা চাপ" />
          </div>
          <div className="field">
            <label htmlFor="pf-origin">উৎস</label>
            <input id="pf-origin" value={f.origin} onChange={(e) => set("origin", e.target.value)} maxLength={120} placeholder="যেমন: সাতক্ষীরা" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="pf-summary">এক কথায় (পণ্য পেজের শুরুতে)</label>
          <textarea id="pf-summary" value={f.summary} onChange={(e) => set("summary", e.target.value)} maxLength={600} aria-describedby="pf-summary-h" />
          <span className="hint" id="pf-summary-h">২–৩ বাক্যে: কী, কোথা থেকে, কীসের জন্য। গুগল আর এআই সার্চ এই অংশটাই বেশি তুলে ধরে।</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="pf-var">
        <h2 id="pf-var">সাইজ, দাম ও স্টক</h2>
        <RowEditor
          legend="সাইজ"
          hint="স্টক খালি রাখলে স্টক গোনা হবে না (সবসময় অর্ডার নেওয়া যাবে)। কেনা দাম শুধু আপনি দেখবেন, লাভের হিসাবে লাগে।"
          rows={f.variants}
          min={1}
          max={20}
          onChange={(rows) => set("variants", rows)}
          blank={() => ({ label: "", price: "", compareAt: "", cost: "", sku: "", stock: "", lowStock: "5" })}
          addLabel="সাইজ যোগ করুন"
          render={(v, put, i) => (
            <>
              <Field label="সাইজের নাম" wide><input value={v.label} onChange={(e) => put({ ...v, label: e.target.value })} placeholder="যেমন: ১ কেজি" /></Field>
              <Field label="দাম ৳"><input inputMode="numeric" value={v.price} onChange={(e) => put({ ...v, price: e.target.value })} /></Field>
              <Field label="আগের দাম ৳"><input inputMode="numeric" value={v.compareAt} onChange={(e) => put({ ...v, compareAt: e.target.value })} /></Field>
              <Field label="কেনা দাম ৳"><input inputMode="numeric" value={v.cost} onChange={(e) => put({ ...v, cost: e.target.value })} /></Field>
              <Field label="স্টক"><input inputMode="numeric" value={v.stock} onChange={(e) => put({ ...v, stock: e.target.value })} placeholder="গোনা হয় না" /></Field>
              <Field label="কম স্টকের সীমা"><input inputMode="numeric" value={v.lowStock} onChange={(e) => put({ ...v, lowStock: e.target.value })} /></Field>
              <Field label="SKU"><input value={v.sku} onChange={(e) => put({ ...v, sku: e.target.value })} /></Field>
              <label className="mini-field check">
                <input type="radio" name="defaultVariant" checked={f.defaultVariant === i} onChange={() => set("defaultVariant", i)} />
                <span>শুরুতে এটা দেখাবে</span>
              </label>
            </>
          )}
        />
      </section>

      <section className="panel" aria-labelledby="pf-info">
        <h2 id="pf-info">বিবরণ ও প্রশ্ন-উত্তর</h2>
        <RowEditor
          legend="পণ্যের তথ্য টেবিল"
          rows={f.facts}
          onChange={(rows) => set("facts", rows)}
          blank={() => ({ label: "", value: "" })}
          addLabel="তথ্য যোগ করুন"
          render={(r, put) => (
            <>
              <Field label="বিষয়"><input value={r.label} onChange={(e) => put({ ...r, label: e.target.value })} placeholder="যেমন: মেয়াদ" /></Field>
              <Field label="তথ্য" wide><input value={r.value} onChange={(e) => put({ ...r, value: e.target.value })} /></Field>
            </>
          )}
        />
        <RowEditor
          legend="প্রশ্নভিত্তিক বিবরণ"
          hint="শিরোনাম প্রশ্ন আকারে লিখুন, নিচে সরাসরি উত্তর। যেমন: ‘খাঁটি মধু চিনবেন কীভাবে?’"
          rows={f.sections}
          onChange={(rows) => set("sections", rows)}
          blank={() => ({ q: "", a: "" })}
          addLabel="অংশ যোগ করুন"
          render={(r, put) => (
            <>
              <Field label="প্রশ্ন" wide><input value={r.q} onChange={(e) => put({ ...r, q: e.target.value })} /></Field>
              <Field label="উত্তর" wide><textarea value={r.a} onChange={(e) => put({ ...r, a: e.target.value })} /></Field>
            </>
          )}
        />
        <RowEditor
          legend="প্রশ্ন-উত্তর (FAQ)"
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
      </section>

      <section className="panel" aria-labelledby="pf-taste">
        <h2 id="pf-taste">স্বাদ (শুধু খাবারের জন্য)</h2>
        <label className="mini-field check">
          <input type="checkbox" checked={f.hasTaste} onChange={(e) => set("hasTaste", e.target.checked)} />
          <span>এই পণ্যে ‘খেতে কেমন?’ অংশ দেখাবে</span>
        </label>
        {f.hasTaste && (
          <div className="grid-2">
            <div className="field">
              <label htmlFor="pf-t1">এক লাইনে স্বাদ</label>
              <input id="pf-t1" value={f.taste.oneLine} onChange={(e) => set("taste", { ...f.taste, oneLine: e.target.value })} maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="pf-t2">মুখে কেমন লাগে</label>
              <input id="pf-t2" value={f.taste.texture} onChange={(e) => set("taste", { ...f.taste, texture: e.target.value })} maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="pf-t3">ঘ্রাণ</label>
              <input id="pf-t3" value={f.taste.aroma} onChange={(e) => set("taste", { ...f.taste, aroma: e.target.value })} maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="pf-t4">যা দিয়ে খেতে ভালো (কমা দিয়ে আলাদা)</label>
              <input id="pf-t4" value={f.taste.bestWith.join(", ")} onChange={(e) => set("taste", { ...f.taste, bestWith: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
            </div>
            <fieldset className="field taste-levels">
              <legend>মাত্রা (০ = নেই, ৫ = খুব বেশি)</legend>
              {TASTE_KEYS.map((k) => (
                <label key={k} className="mini-field">
                  <span>{tasteLabels[k]}</span>
                  <select value={f.taste.levels[k] ?? 0} onChange={(e) => {
                    const n = Number(e.target.value);
                    const levels = { ...f.taste.levels };
                    if (n) levels[k] = n as 1 | 2 | 3 | 4 | 5; else delete levels[k];
                    set("taste", { ...f.taste, levels });
                  }}>
                    {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              ))}
            </fieldset>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="pf-pub">
        <h2 id="pf-pub">প্রকাশ, SEO ও অন্যান্য</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pf-status">অবস্থা</label>
            <select id="pf-status" value={f.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
              <option value="draft">খসড়া (দোকানে দেখাবে না)</option>
              <option value="published">প্রকাশিত</option>
              <option value="hidden">লুকানো</option>
            </select>
          </div>
          {f.status === "published" && (
            <div className="field">
              <label htmlFor="pf-at">নির্দিষ্ট সময়ে প্রকাশ (ঐচ্ছিক, ঢাকার সময়)</label>
              <input id="pf-at" type="datetime-local" value={f.publishAt} onChange={(e) => set("publishAt", e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="pf-mt">SEO শিরোনাম (ঐচ্ছিক, ৭০ অক্ষর)</label>
            <input id="pf-mt" value={f.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} maxLength={70} placeholder={f.name} />
          </div>
          <div className="field">
            <label htmlFor="pf-md">SEO বিবরণ (ঐচ্ছিক, ১৭০ অক্ষর)</label>
            <input id="pf-md" value={f.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} maxLength={170} placeholder="খালি থাকলে ‘এক কথায়’ থেকে তৈরি হবে" />
          </div>
          <div className="field">
            <label htmlFor="pf-art">ছবি না থাকলে আঁকা ছবি</label>
            <select id="pf-art" value={f.art} onChange={(e) => set("art", e.target.value)}>
              {Object.entries(ART_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pf-sort">তালিকায় ক্রম (ছোট সংখ্যা আগে)</label>
            <input id="pf-sort" inputMode="numeric" value={f.sort} onChange={(e) => set("sort", Number(e.target.value.replace(/\D/g, "")) || 0)} />
          </div>
        </div>
        <fieldset className="field related">
          <legend>‘এর সাথে অনেকে নেন’ (সর্বোচ্চ ৪টি)</legend>
          <div className="check-grid">
            {relatedChoices.map((p) => (
              <label key={p.slug} className="mini-field check">
                <input
                  type="checkbox"
                  checked={f.related.includes(p.slug)}
                  disabled={!f.related.includes(p.slug) && f.related.length >= 4}
                  onChange={(e) => set("related", e.target.checked ? [...f.related, p.slug] : f.related.filter((x) => x !== p.slug))}
                />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <div className="form-bar">
        <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে..." : product ? "সংরক্ষণ করুন" : "পণ্য তৈরি করুন"}</button>
        {state && <p className={`notice ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</p>}
      </div>
    </form>
  );
}
