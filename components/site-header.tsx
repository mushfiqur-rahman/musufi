"use client";

// Site header, two tiers:
// - Row 1 (white): logo, product search, account, cart (icon + total), and the
//   menu button at the far right on phones (easy to reach with the right thumb).
//   On phones the search box drops to its own row under the logo.
// - Row 2 (computers, solid green): "সকল ক্যাটাগরি" dropdown, main links with
//   the current page highlighted, and "আমার অর্ডার" on the right.
// On phones the menu button opens a panel with two tabs: main menu / categories.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
import type { SearchItem } from "@/lib/search";
import { CloseIcon, LogoMark, MenuIcon, UserIcon } from "./icons";
import { SearchBox } from "./search-box";
import { CartButton } from "./cart-button";

export type NavCategory = { id: string; label: string; blurb?: string };

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const Chevron = ({ dir = "down" }: { dir?: "down" | "right" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={dir === "right" ? { transform: "rotate(-90deg)" } : undefined}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Which link is the current page ("/#…" links are sections of the home page, never "current"). */
function isCurrent(href: string, path: string | null): boolean {
  if (!path || href.includes("#")) return false;
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

type HeaderProps = {
  categories: NavCategory[];
  /** Main menu links, chosen by the admin (lib/menu.ts). */
  menu: { href: string; label: string }[];
  searchItems: SearchItem[];
};

/**
 * Header with the current page highlighted. Reading the URL makes it request-time,
 * so the layout renders <SiteHeader path={null}> as the instant fallback inside
 * <Suspense> and this one streams in right after.
 */
export function SiteHeaderLive(props: HeaderProps) {
  return <SiteHeader {...props} path={usePathname()} />;
}

/** `path` = current URL path, or null when not known yet (nothing highlighted). */
export function SiteHeader({ categories, menu, searchItems, path }: HeaderProps & { path: string | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<"menu" | "categories">("menu");
  const [catsOpen, setCatsOpen] = useState(false);
  const catsRef = useRef<HTMLDivElement>(null);

  const catLinks = categories.map((c) => ({ href: `/category/${c.id}`, label: c.label, blurb: c.blurb }));
  const mainLinks = menu;

  // Close the category dropdown on an outside click or Escape.
  useEffect(() => {
    if (!catsOpen) return;
    const onDown = (e: MouseEvent) => { if (catsRef.current && !catsRef.current.contains(e.target as Node)) setCatsOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCatsOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [catsOpen]);

  const closeAll = () => { setMenuOpen(false); setCatsOpen(false); };

  return (
    <header className="site-header">
      {/* Row 1 */}
      <div className="wrap hbar">
        <Link className="logo" href="/" aria-label={`${site.name}, হোম পেজ`} onClick={closeAll}>
          <LogoMark />
          <span>
            <b>{site.name}</b>
            <small>{site.tagline}</small>
          </span>
        </Link>

        <div className="hsearch">
          <SearchBox items={searchItems} />
        </div>

        {/* Right side: account, cart, then the menu button at the far right (thumb reach on phones). */}
        <div className="head-actions">
          <Link className="icon-btn" href="/account" aria-label="আমার অ্যাকাউন্ট ও অর্ডার">
            <UserIcon />
          </Link>
          <CartButton />
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="menu-sheet"
            aria-label={menuOpen ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
            onClick={() => { setTab("menu"); setMenuOpen((v) => !v); }}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Row 2: green bar (computers) */}
      <div className="greenbar">
        <div className="wrap greenbar-in">
          <div className="cats" ref={catsRef}>
            <button type="button" className="cats-btn" aria-expanded={catsOpen} aria-controls="cats-panel" onClick={() => setCatsOpen((v) => !v)}>
              <GridIcon />
              <span>সকল ক্যাটাগরি</span>
              <span className={`chev${catsOpen ? " up" : ""}`}><Chevron /></span>
            </button>
            {catsOpen && (
              <div className="cats-panel" id="cats-panel">
                <ul>
                  {catLinks.map((c) => (
                    <li key={c.href}>
                      <Link href={c.href} onClick={closeAll} aria-current={isCurrent(c.href, path) ? "page" : undefined}>
                        <span className="cats-text">
                          <b>{c.label}</b>
                          {c.blurb && <small>{c.blurb}</small>}
                        </span>
                        <Chevron dir="right" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link className="cats-all" href="/#products" onClick={closeAll}>সব পণ্য দেখুন</Link>
              </div>
            )}
          </div>

          <nav className="mainnav" aria-label="প্রধান মেনু">
            <ul>
              {mainLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} aria-current={isCurrent(l.href, path) ? "page" : undefined}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <Link className="track-btn" href="/account" aria-current={isCurrent("/account", path) ? "page" : undefined}>আমার অর্ডার</Link>
        </div>
      </div>

      {/* Phones: menu panel with two tabs */}
      <div className="menu-sheet" id="menu-sheet" hidden={!menuOpen}>
        <div className="sheet-tabs" role="tablist" aria-label="মেনু">
          <button type="button" role="tab" aria-selected={tab === "menu"} onClick={() => setTab("menu")}>মূল মেনু</button>
          <button type="button" role="tab" aria-selected={tab === "categories"} onClick={() => setTab("categories")}><GridIcon /> সকল ক্যাটাগরি</button>
        </div>
        <div className="wrap sheet-body">
          {tab === "menu" ? (
            <nav aria-label="মোবাইল মেনু">
              <ul className="sheet-links">
                {[...mainLinks, { href: "/account", label: "আমার অর্ডার ও অ্যাকাউন্ট" }].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} onClick={closeAll} aria-current={isCurrent(l.href, path) ? "page" : undefined}>
                      <span>{l.label}</span><Chevron dir="right" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : (
            <ul className="sheet-cats">
              {catLinks.map((c) => (
                <li key={c.href}>
                  <Link href={c.href} onClick={closeAll} aria-current={isCurrent(c.href, path) ? "page" : undefined}>
                    <span className="cats-text">
                      <b>{c.label}</b>
                      {c.blurb && <small>{c.blurb}</small>}
                    </span>
                    <Chevron dir="right" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
