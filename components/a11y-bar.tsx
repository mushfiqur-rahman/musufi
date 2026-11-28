"use client";

// Reading controls at the top of every page: A− / A / A+ (text size) and
// "মোটা লেখা" (bold text). The choice is remembered in this browser
// (localStorage) and applied to <html> before the page paints, by
// A11Y_BOOT_SCRIPT in the root layout, so there is no flicker.

import { useSyncExternalStore } from "react";

const KEY = "ms-a11y";
const EVENT = "ms-a11y-change";
/** Root font sizes, as % of the browser default. Index 1 = normal. */
export const A11Y_SIZES = [90, 100, 112, 125, 140] as const;
const NORMAL = 1;

type Prefs = { size: number; bold: boolean };
const DEFAULTS: Prefs = { size: NORMAL, bold: false };

function parse(raw: string | null): Prefs {
  try {
    const p = JSON.parse(raw ?? "null") as Partial<Prefs> | null;
    const size = typeof p?.size === "number" && Number.isInteger(p.size) && p.size >= 0 && p.size < A11Y_SIZES.length ? p.size : NORMAL;
    return { size, bold: Boolean(p?.bold) };
  } catch {
    return DEFAULTS;
  }
}

// Store = the localStorage string; the server (and the first hydration pass) sees "null" = defaults.
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
const snapshot = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const serverSnapshot = () => null;

function save(p: Prefs) {
  const root = document.documentElement;
  root.style.fontSize = p.size === NORMAL ? "" : `${A11Y_SIZES[p.size]}%`;
  root.classList.toggle("a11y-bold", p.bold);
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: still applies to this page */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Runs in <head> before paint: applies the saved choice, same rules as save(). */
export const A11Y_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("${KEY}")||"null");if(p){var s=[${A11Y_SIZES.join(",")}][p.size];if(s&&p.size!==${NORMAL})document.documentElement.style.fontSize=s+"%";if(p.bold)document.documentElement.classList.add("a11y-bold")}}catch(e){}`;

export function A11yBar() {
  const cur = parse(useSyncExternalStore(subscribe, snapshot, serverSnapshot));
  const last = A11Y_SIZES.length - 1;
  return (
    <div className="a11y-bar">
      <div className="wrap a11y-in">
        <span className="a11y-title" id="a11y-label">লেখা:</span>
        <div className="a11y-group" role="group" aria-labelledby="a11y-label">
          <button type="button" onClick={() => save({ ...cur, size: Math.max(0, cur.size - 1) })} disabled={cur.size === 0} aria-label="লেখা ছোট করুন">A−</button>
          <button type="button" onClick={() => save({ ...cur, size: NORMAL })} aria-pressed={cur.size === NORMAL} aria-label="স্বাভাবিক আকার">A</button>
          <button type="button" onClick={() => save({ ...cur, size: Math.min(last, cur.size + 1) })} disabled={cur.size === last} aria-label="লেখা বড় করুন">A+</button>
        </div>
        <button type="button" className="a11y-bold-btn" aria-pressed={cur.bold} onClick={() => save({ ...cur, bold: !cur.bold })}>
          <b>B</b> মোটা লেখা
        </button>
      </div>
    </div>
  );
}
