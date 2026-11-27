"use client";

import { useActionState } from "react";
import { setStaffRole } from "@/app/admin/actions/operations";
import { roleDescription, roleLabel, ROLES } from "@/lib/permissions";
import type { ActionResult } from "@/lib/validate";

/** Add a staff member, or change one's role (same form, keyed by email). */
export function StaffForm({ email, role }: { email?: string; role?: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setStaffRole, null);
  const id = email ? `sf-${email}` : "sf-new";
  return (
    <form action={action} className="admin-form inline-fields">
      {email ? <input type="hidden" name="email" value={email} /> : (
        <div className="field grow"><label htmlFor={`${id}-e`}>ইমেইল</label><input id={`${id}-e`} name="email" type="email" required placeholder="staff@gmail.com" /></div>
      )}
      <div className="field">
        <label htmlFor={`${id}-r`}>ভূমিকা</label>
        <select id={`${id}-r`} name="role" defaultValue={role ?? "order_staff"}>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}: {roleDescription[r]}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>{email ? "বদলান" : "স্টাফ যোগ করুন"}</button>
      {state && <p className={`notice ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</p>}
    </form>
  );
}
