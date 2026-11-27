import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requirePermission } from "@/lib/admin";
import { actionLabel, listAudit } from "@/lib/audit";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "অ্যাক্টিভিটি লগ" };

const ENTITIES: Record<string, string> = { "": "সব", order: "অর্ডার", product: "পণ্য", category: "ক্যাটাগরি", staff: "স্টাফ", expense: "খরচ", settings: "সেটিংস" };

/** Where an entry points to, when there's a page for it. */
function link(entity: string, id: string | null): string | null {
  if (!id) return null;
  if (entity === "order") return `/admin/orders/${id}`;
  if (entity === "product") return `/admin/products/${id}`;
  return null;
}

export default function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}

async function Activity({ searchParams }: { searchParams: PageProps<"/admin/activity">["searchParams"] }) {
  await connection();
  await requirePermission("audit.view");
  const sp = await searchParams;
  const entity = typeof sp.entity === "string" && sp.entity in ENTITIES ? sp.entity : "";
  const rows = await listAudit({ entity: entity || undefined, limit: 200 });

  return (
    <>
      <div className="admin-head">
        <h1>অ্যাক্টিভিটি লগ</h1>
        <p className="lead">অ্যাডমিনে কে কখন কী বদলেছেন, শেষ ২০০টি।</p>
      </div>
      <nav className="chips small" aria-label="ধরন">
        {Object.entries(ENTITIES).map(([k, v]) => (
          <Link key={k} href={k ? `/admin/activity?entity=${k}` : "/admin/activity"} aria-current={entity === k ? "page" : undefined}>{v}</Link>
        ))}
      </nav>
      {rows.length === 0 ? <p className="reviews-empty">এখনো কিছু নেই।</p> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">সময়</th><th scope="col">কে</th><th scope="col">কী</th><th scope="col">কোথায়</th><th scope="col">বিস্তারিত</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const href = link(r.entity, r.entity_id);
                const details = r.details ? (typeof r.details === "string" ? r.details : JSON.stringify(r.details)) : "";
                return (
                  <tr key={r.id}>
                    <td className="num">{dhakaDateTime(r.created_at)}<small>{r.ip ?? ""}</small></td>
                    <td className="break">{r.actor_email ?? "সিস্টেম"}</td>
                    <td>{actionLabel[r.action] ?? r.action}</td>
                    <td>{href ? <Link href={href}>{r.entity_id}</Link> : r.entity_id ?? ""}</td>
                    <td><code className="details">{details.slice(0, 160)}</code></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
