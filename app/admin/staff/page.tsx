import { connection } from "next/server";
import { Suspense } from "react";
import { removeStaff } from "@/app/admin/actions/operations";
import { StaffForm } from "@/components/admin/staff-form";
import { requirePermission } from "@/lib/admin";
import { effectiveRole, isAdminEmail } from "@/lib/auth";
import { select } from "@/lib/db";
import { PERMISSIONS, can, roleDescription, roleLabel, ROLES, type Permission } from "@/lib/permissions";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "স্টাফ ও ভূমিকা" };

const permLabel: Record<Permission, string> = {
  "dashboard.view": "ড্যাশবোর্ড",
  "orders.view": "অর্ডার দেখা",
  "orders.manage": "অর্ডার বদলানো",
  "customers.view": "ক্রেতা দেখা",
  "customers.manage": "ক্রেতা ব্লক/নোট",
  "products.view": "পণ্য দেখা",
  "products.manage": "পণ্য ও ক্যাটাগরি সম্পাদনা",
  "reports.view": "লাভ-ক্ষতি",
  "finance.manage": "খরচ ও কেনা দাম",
  "content.manage": "কনটেন্ট",
  "settings.manage": "সেটিংস",
  "staff.manage": "স্টাফ পরিচালনা",
  "audit.view": "অ্যাক্টিভিটি লগ",
};

export default function StaffPage() {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Staff />
    </Suspense>
  );
}

async function Staff() {
  await connection();
  const me = await requirePermission("staff.manage");
  const rows = await select<{ email: string; name: string | null; role: string | null; last_login_at: Date | null }>(
    "SELECT email, name, role, last_login_at FROM customers WHERE role IS NOT NULL ORDER BY role, email",
  );
  // Owners from ADMIN_EMAILS may not have a DB role yet; list them too.
  const envOwners = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const emails = new Set(rows.map((r) => r.email));
  const staff = [...rows, ...envOwners.filter((e) => !emails.has(e)).map((email) => ({ email, name: null, role: "owner", last_login_at: null }))];

  return (
    <>
      <div className="admin-head">
        <h1>স্টাফ ও ভূমিকা</h1>
        <p className="lead">স্টাফ নিজের ইমেইলের কোড দিয়ে লগইন করেন, পাসওয়ার্ড লাগে না। ভূমিকা অনুযায়ী তাঁরা শুধু নিজের কাজের মেনু দেখেন। মালিক (ADMIN_EMAILS-এ থাকা ইমেইল) এখান থেকে বদলানো যায় না।</p>
      </div>

      <section className="panel" aria-labelledby="h-add">
        <h2 id="h-add">নতুন স্টাফ</h2>
        <StaffForm />
      </section>

      <section className="panel" aria-labelledby="h-list">
        <h2 id="h-list">বর্তমান স্টাফ</h2>
        <ul className="staff-list">
          {staff.map((s) => {
            const role = effectiveRole(s.email, s.role)!;
            const locked = isAdminEmail(s.email) || s.email === me.email;
            return (
              <li key={s.email}>
                <div>
                  <b className="break">{s.name || s.email}</b>
                  <small className="break">{s.email} · {roleLabel[role]}{isAdminEmail(s.email) ? " (ADMIN_EMAILS)" : ""} · {s.last_login_at ? `শেষ লগইন ${dhakaDateTime(s.last_login_at)}` : "এখনো লগইন করেননি"}</small>
                </div>
                {!locked && (
                  <div className="staff-actions">
                    <StaffForm email={s.email} role={role} />
                    <form action={removeStaff}>
                      <input type="hidden" name="email" value={s.email} />
                      <button className="linkish danger" type="submit">স্টাফ থেকে বাদ দিন</button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel" aria-labelledby="h-roles">
        <h2 id="h-roles">কোন ভূমিকা কী করতে পারে</h2>
        <div className="table-wrap">
          <table className="admin-table perm-table">
            <thead><tr><th scope="col">কাজ</th>{ROLES.map((r) => <th key={r} scope="col">{roleLabel[r]}</th>)}</tr></thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p}><th scope="row">{permLabel[p]}</th>{ROLES.map((r) => <td key={r} aria-label={can(r, p) ? "হ্যাঁ" : "না"}>{can(r, p) ? "✓" : "–"}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="hint role-notes">{ROLES.map((r) => <li key={r}><b>{roleLabel[r]}:</b> {roleDescription[r]}</li>)}</ul>
      </section>
    </>
  );
}
