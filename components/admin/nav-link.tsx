"use client";

// Admin menu link that marks itself as the current page (aria-current + style).
// "/admin" is current only on the dashboard itself; other items also stay
// current on their sub-pages (e.g. /admin/orders/MS-123 keeps "অর্ডার" selected).

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const current = href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={current ? "is-current" : undefined}>
      {children}
    </Link>
  );
}
