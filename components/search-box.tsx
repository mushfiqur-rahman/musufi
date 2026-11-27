"use client";

// Header product search with instant suggestions (ARIA combobox pattern).
// Typing filters the small product list sent with the page; Enter (or the
// button) opens /search?q=… with full results. Works without JavaScript too:
// it is a plain GET form.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { MAX_QUERY, searchItems, type SearchItem } from "@/lib/search";
import { taka } from "@/lib/site";
import { SearchIcon } from "./icons";

export function SearchBox({ items }: { items: SearchItem[] }) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => searchItems(items, q, 6), [items, q]);
  const showList = open && q.trim().length > 0;

  function go(href: string) {
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && hits.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % hits.length);
    } else if (e.key === "ArrowUp" && hits.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? hits.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter" && active >= 0 && hits[active]) {
      e.preventDefault();
      go(`/products/${hits[active].slug}`);
    }
  }

  return (
    <form
      className="search-box"
      role="search"
      action="/search"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (query) go(`/search?q=${encodeURIComponent(query)}`);
      }}
    >
      <label htmlFor={`${id}-q`} className="sr-only-x">পণ্য খুঁজুন</label>
      <input
        ref={inputRef}
        id={`${id}-q`}
        name="q"
        type="search"
        value={q}
        maxLength={MAX_QUERY}
        placeholder="পণ্য খুঁজুন: মধু, চিংড়ি, চুইঝাল..."
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      <button type="submit" className="search-btn" aria-label="খুঁজুন"><SearchIcon /></button>

      {showList && (
        <ul className="search-list" id={listId} role="listbox" aria-label="মিলে যাওয়া পণ্য">
          {hits.length === 0 ? (
            <li className="search-empty" role="option" aria-selected={false} aria-disabled="true">কিছু পাওয়া যায়নি। Enter চাপুন সব ফল দেখতে।</li>
          ) : (
            <>
              {hits.map((h, i) => (
                <li key={h.slug} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} className={i === active ? "is-active" : undefined}>
                  <Link href={`/products/${h.slug}`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.preventDefault(); go(`/products/${h.slug}`); }}>
                    <span className="search-name">{h.name}</span>
                    <span className="search-meta">{h.category} · <span className="num">{taka(h.price)}</span> থেকে</span>
                  </Link>
                </li>
              ))}
              <li role="option" aria-selected={false} className="search-all">
                <Link href={`/search?q=${encodeURIComponent(q.trim())}`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.preventDefault(); go(`/search?q=${encodeURIComponent(q.trim())}`); }}>
                  “{q.trim()}”-এর সব ফল দেখুন →
                </Link>
              </li>
            </>
          )}
        </ul>
      )}
    </form>
  );
}
