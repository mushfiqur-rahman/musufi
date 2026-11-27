import { connection } from "next/server";
import { Suspense } from "react";
import { removeStaff } from "@/app/admin/actions/operations";
import { resetStaffTotpAction } from "@/app/admin/actions/security";
import { StaffForm } from "@/components/admin/staff-form";
import { requirePermission } from "@/lib/admin";
import { effectiveRole, isAdminEmail } from "@/lib/auth";
import { select } from "@/lib/db";
import { roleDescription, roleLabel, ROLES } from "@/lib/permissions";
import { getRoleMatrix } from "@/lib/roles";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "স্টাফ ও ভূমিকা" };



export default function StaffPage({ searchParams }: PageProps<"/admin/staff">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Staff searchParams={searchParams} />
    </Suspense>
  );
}

async function Staff({ searchParams }: { searchParams: PageProps<"/admin/staff">["searchParams"] }) {
  await connection();
  const me = await requirePermission("staff.manage");
  const sp = await searchParams;
  const rows = await select<{ email: string; name: string | null; role: string | null; last_login_at: Date | null; totp_enabled_at: Date | null }>(
    "SELECT email, name, role, last_login_at, totp_enabled_at FROM customers WHERE role IS NOT NULL ORDER BY role, email",
  );
  // Owners from ADMIN_EMAILS may not have a DB role yet; list them too.
  const envOwners = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const emails = new Set(rows.map((r) => r.email));
  const staff = [...rows, ...envOwners.filter((e) => !emails.has(e)).map((email) => ({ email, name: null, role: "owner", last_login_at: null, totp_enabled_at: null }))];

  return (
    <>
      <div className="admin-head">
        <h1>স্টাফ ও ভূমিকা</h1>
        <p className="lead">স্টাফ নিজের ইমেইলের কোড দিয়ে লগইন করেন, পাসওয়ার্ড লাগে না। ভূমিকা অনুযায়ী তাঁরা শুধু নিজের কাজের মেনু দেখেন। মালিক (ADMIN_EMAILS-এ থাকা ইমেইল) এখান থেকে বদলানো যায় না।</p>
      </div>

      {sp.reset2fa && <p className="notice ok" role="status">২-ধাপ লগইন রিসেট হয়েছে। তিনি আবার লগইন করে নিরাপত্তা পেজ থেকে নতুন করে চালু করতে পারবেন।</p>}

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
                  <small className="break">{s.email} · {roleLabel[role]}{isAdminEmail(s.email) ? " (ADMIN_EMAILS)" : ""} · {s.last_login_at ? `শেষ লগইন ${dhakaDateTime(s.last_login_at)}` : "এখনো লগইন করেননি"} · ২-ধাপ লগইন {s.totp_enabled_at ? "চালু" : "বন্ধ"}</small>
                </div>
                {s.totp_enabled_at && s.email !== me.email && (
                  <form action={resetStaffTotpAction}>
                    <input type="hidden" name="email" value={s.email} />
                    <button className="linkish danger" type="submit" title="ফোন হারালে: তাঁর ২-ধাপ লগইন বন্ধ করে সব ডিভাইস থেকে লগআউট করুন">২-ধাপ লগইন রিসেট</button>
                  </form>
                )}
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
        <p className="hint">টিক দিয়ে ঠিক করুন কোন ভূমিকা কী করতে পারবে, তারপর সংরক্ষণ করুন। মালিকের কলাম বদলানো যায় না; স্টাফ পরিচালনা শুধু মালিকের।</p>
        <PermissionMatrix matrix={await getRoleMatrix()} />
        <ul className="hint role-notes">{ROLES.map((r) => <li key={r}><b>{roleLabel[r]}:</b> {roleDescription[r]}</li>)}</ul>
      </section>
    </>
  );
}
