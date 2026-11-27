import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "অ্যাডমিন", template: "%s | মুসুফি অ্যাডমিন" },
  robots: { index: false, follow: false },
};

const nav = [
  { href: "/admin", label: "অর্ডার" },
  { href: "/admin/reports", label: "লাভ-ক্ষতি" },
  { href: "/admin/expenses", label: "খরচ" },
  { href: "/admin/costs", label: "পণ্যের কেনা দাম" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="wrap admin">
      <nav className="admin-nav" aria-label="অ্যাডমিন মেনু">
        {nav.map((n) => (
          <Link key={n.href} href={n.href}>{n.label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
