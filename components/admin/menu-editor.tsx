"use client";

// Admin editor for the main menu: reorder, rename, remove, and add categories,
// products, content pages or a custom link. Saves the whole list at once.

import { useActionState, useState } from "react";
import { saveMenuAction } from "@/app/admin/actions/menu";
import type { MenuItem, MenuKind } from "@/lib/menu";
import type { ActionResult } from "@/lib/validate";

type Option = { ref: string; name: string };
export type MenuOptions = { categories: Option[]; products: Option[]; pages: Option[] };

const KIND_LABEL: Record<MenuKind, string> = {
  home: "হোম",
  category: "ক্যাটাগরি",
  product: "পণ্য",
  page: "পেজ",
  link: "নিজের লিংক",
};
const MAX = 12;

export function MenuEditor({ initial, options }: { initial: MenuItem[]; options: MenuOptions }) {
  const [items, setItems] = useState<MenuItem[]>(initial);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveMenuAction, null);
  const [addKind, setAddKind] = useState<MenuKind>("category");
  const [addRef, setAddRef] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addErr, setAddErr] = useState("");

  const nameOf = (it: MenuItem): string => {
    if (it.kind === "home") return "হোম পেজ";
    if (it.kind === "link") return it.ref;
    const list = it.kind === "category" ? options.categories : it.kind === "product" ? options.products : options.pages;
    return list.find((o) => o.ref === it.ref)?.name ?? `${it.ref} (খুঁজে পাওয়া যায়নি, সাইটে দেখাবে না)`;
  };

  const move = (i: number, d: -1 | 1) => setItems((xs) => {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const copy = [...xs];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });
  const setLabel = (i: number, label: string) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, label } : x)));
  const remove = (i: number) => setItems((xs) => xs.filter((_, k) => k !== i));

  const choices: Option[] = addKind === "category" ? options.categories : addKind === "product" ? options.products : addKind === "page" ? options.pages : [];

  function add() {
    setAddErr("");
    if (items.length >= MAX) return setAddErr(`মেনুতে সর্বোচ্চ ${MAX.toLocaleString("bn-BD")}টি লিংক রাখা যায়।`);
    if (addKind === "home") {
      setItems((xs) => [...xs, { kind: "home", ref: "", label: addLabel.trim() }]);
    } else if (addKind === "link") {
      const href = addRef.trim();
      if (!addLabel.trim()) return setAddErr("লিংকের নাম লিখুন।");
      if (!/^\/(?!\/)/.test(href) && !/^https:\/\//.test(href)) return setAddErr("লিংক / দিয়ে (যেমন /category/fish) বা https:// দিয়ে শুরু করুন।");
      setItems((xs) => [...xs, { kind: "link", ref: href, label: addLabel.trim() }]);
    } else {
      if (!addRef) return setAddErr("তালিকা থেকে একটি বেছে নিন।");
      setItems((xs) => [...xs, { kind: addKind, ref: addRef, label: addLabel.trim() }]);
    }
    setAddRef("");
    setAddLabel("");
  }

  return (
    <div className="stack">
      <ol className="menu-items">
        {items.map((it, i) => (
          <li key={`${it.kind}-${it.ref}-${i}`} className="menu-item">
            <span className="pill">{KIND_LABEL[it.kind]}</span>
            <span className="menu-target break">{nameOf(it)}</span>
            <label className="mini-field menu-label">
              <span>মেনুতে যে নাম দেখাবে{it.kind === "link" ? "" : " (খালি = নিজের নাম)"}</span>
              <input value={it.label} maxLength={40} onChange={(e) => setLabel(i, e.target.value)} placeholder={it.kind === "link" ? "" : nameOf(it)} />
            </label>
            <span className="menu-actions">
              <button type="button" className="btn btn-ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${nameOf(it)} উপরে নিন`}>↑</button>
              <button type="button" className="btn btn-ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`${nameOf(it)} নিচে নিন`}>↓</button>
              <button type="button" className="linkish danger" onClick={() => remove(i)}>বাদ দিন</button>
            </span>
          </li>
        ))}
      </ol>
      {items.length === 0 && <p className="notice bad">মেনু খালি। নিচে থেকে লিংক যোগ করুন।</p>}

      <fieldset className="panel menu-add">
        <legend>নতুন লিংক যোগ করুন</legend>
        <div className="grid-2">
          <label className="mini-field"><span>কী যোগ করবেন</span>
            <select value={addKind} onChange={(e) => { setAddKind(e.target.value as MenuKind); setAddRef(""); setAddErr(""); }}>
              <option value="category">ক্যাটাগরি</option>
              <option value="product">পণ্য</option>
              <option value="page">পেজ</option>
              <option value="link">নিজের লিংক</option>
              <option value="home">হোম পেজ</option>
            </select>
          </label>
          {addKind === "link" ? (
            <label className="mini-field"><span>লিংক</span>
              <input value={addRef} onChange={(e) => setAddRef(e.target.value)} placeholder="/#faq বা https://facebook.com/..." maxLength={300} />
            </label>
          ) : addKind !== "home" ? (
            <label className="mini-field"><span>বেছে নিন</span>
              <select value={addRef} onChange={(e) => setAddRef(e.target.value)}>
                <option value="">— বেছে নিন —</option>
                {choices.map((o) => <option key={o.ref} value={o.ref}>{o.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="mini-field"><span>মেনুতে নাম{addKind === "link" ? "" : " (ঐচ্ছিক)"}</span>
            <input value={addLabel} onChange={(e) => setAddLabel(e.target.value)} maxLength={40} />
          </label>
        </div>
        <button type="button" className="btn btn-ghost" onClick={add}>+ মেনুতে যোগ করুন</button>
        {addErr && <p className="notice bad" role="alert">{addErr}</p>}
      </fieldset>

      <form action={action} className="form-bar">
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে..." : "মেনু সংরক্ষণ করুন"}</button>
        {state && <p className={`notice ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</p>}
      </form>
    </div>
  );
}
