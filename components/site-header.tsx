"use client";

import Link from "next/link";
import { useState } from "react";
import { phoneDisplay, site } from "@/lib/site";
import { CloseIcon, LogoMark, MenuIcon, PhoneIcon, UserIcon } from "./icons";

export type NavCategory = { id: string; label: string };

const extra = [
  { href: "/account", label: "আমার অর্ডার" },
  { href: "/#delivery", label: "ডেলিভারি ও পেমেন্ট" },
  { href: "/#faq", label: "প্রশ্ন ও উত্তর" },
];

export function SiteHeader({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false);
  const links = categories.map((c) => ({ href: `/category/${c.id}`, label: c.label }));
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link className="logo" href="/" aria-label={`${site.name}, হোম পেজ`}>
          <LogoMark />
          <span>
            <b>{site.name}</b>
            <small>{site.tagline}</small>
          </span>
        </Link>
        <nav className="mainnav" aria-label="প্রধান মেনু">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>
        <div className="head-actions">
          <a className="call-pill" href={`tel:${site.phone}`}>
            <span className="ic"><PhoneIcon /></span>
            <span>অর্ডার করতে কল করুন<br /><b className="num">{phoneDisplay}</b></span>
          </a>
          <a className="icon-btn menu-btn" href={`tel:${site.phone}`} aria-label={`কল করুন ${phoneDisplay}`}>
            <PhoneIcon />
          </a>
          <Link className="icon-btn" href="/account" aria-label="আমার অ্যাকাউন্ট ও অর্ডার">
            <UserIcon />
          </Link>
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-expanded={open}
            aria-controls="menu-sheet"
            aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      <div className="menu-sheet" id="menu-sheet" hidden={!open}>
        <nav className="wrap" aria-label="মোবাইল মেনু">
          {[...links, ...extra].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
