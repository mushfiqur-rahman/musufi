import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentCustomer } from "@/lib/auth";
import { can, roleLabel, type Permission } from "@/lib/permissions";

export const metadata: Metadata = {
  title: { default: "অ্যাডমিন", template: "%s | মুসুফি অ্যাডমিন" },
  robots: { index: false, follow: false },
};

/** Admin menu. Each item is shown only to roles that have its permission. */
const NAV: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin", label: "ড্যাশবোর্ড", perm: "dashboard.view" },
  { href: "/admin/orders", label: "অর্ডার", perm: "orders.view" },
  { href: "/admin/customers", label: "ক্রেতা", perm: "customers.view" },
  { href: "/admin/products", label: "পণ্য", perm: "products.view" },
  { href: "/admin/categories", label: "ক্যাটাগরি", perm: "products.manage" },
  { href: "/admin/coupons", label: "কুপন", perm: "marketing.manage" },
  { href: "/admin/reviews", label: "রিভিউ", perm: "marketing.manage" },
  { href: "/admin/pages", label: "পেজ ও ঘোষণা", perm: "content.manage" },
  { href: "/admin/reports", label: "লাভ-ক্ষতি", perm: "reports.view" },
  { href: "/admin/expenses", label: "খরচ", perm: "finance.manage" },
  { href: "/admin/costs", label: "পার্সেল খরচ", perm: "finance.manage" },
  { href: "/admin/settings", label: "সেটিংস", perm: "settings.manage" },
  { href: "/admin/staff", label: "স্টাফ ও ভূমিকা", perm: "staff.manage" },
  { href: "/admin/activity", label: "অ্যাক্টিভিটি লগ", perm: "audit.view" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="wrap admin admin-shell">
      <Suspense fallback={<nav className="admin-nav" aria-label="অ্যাডমিন মেনু" />}>
        <AdminNav />
      </Suspense>
      <div className="admin-main">{children}</div>
    </div>
  );
}

async function AdminNav() {
  await connection();
  const me = await currentCustomer();
  // Pages redirect visitors without access; the menu just stays empty for them.
  if (!me?.role) return <nav className="admin-nav" aria-label="অ্যাডমিন মেনু" />;
  const role = me.role;
  return (
    <nav className="admin-nav" aria-label="অ্যাডমিন মেনু">
      <p className="admin-who">
        <b>{me.name || me.email}</b>
        <small>{roleLabel[role]}</small>
      </p>
      {NAV.filter((n) => can(role, n.perm)).map((n) => (
        <Link key={n.href} href={n.href}>{n.label}</Link>
      ))}
      <Link href="/admin/security">নিরাপত্তা (২-ধাপ লগইন)</Link>
      <Link href="/" className="admin-back">← দোকানে ফিরুন</Link>
    </nav>
  );
}
