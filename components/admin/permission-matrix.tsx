"use client";

// Owner-editable table: which role may do what. The owner column is always
// fully ticked and locked; owner-only rights (staff management) are locked off
// for other roles. The server re-applies both rules (normalizeMatrix).

import { useActionState } from "react";
import { saveRolePermissionsAction } from "@/app/admin/actions/roles";
import { OWNER_ONLY, PERMISSIONS, permissionLabel, roleLabel, ROLES, type RoleMatrix } from "@/lib/permissions";
import type { ActionResult } from "@/lib/validate";

export function PermissionMatrix({ matrix }: { matrix: RoleMatrix }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveRolePermissionsAction, null);
  return (
    <form action={action} className="admin-form">
      <div className="table-wrap">
        <table className="admin-table perm-table">
          <thead>
            <tr><th scope="col">কাজ</th>{ROLES.map((r) => <th key={r} scope="col">{roleLabel[r]}</th>)}</tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p}>
                <th scope="row">{permissionLabel[p]}</th>
                {ROLES.map((r) => {
                  const locked = r === "owner" || OWNER_ONLY.includes(p);
                  const on = r === "owner" || matrix[r].includes(p);
                  return (
                    <td key={r}>
                      <input
                        type="checkbox"
                        className="perm-check"
                        name={locked ? undefined : `${r}:${p}`}
                        value="1"
                        defaultChecked={on}
                        disabled={locked}
                        aria-label={`${roleLabel[r]}: ${permissionLabel[p]}`}
                        title={r === "owner" ? "মালিক সব পারেন" : locked ? "শুধু মালিক" : undefined}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="form-bar">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে..." : "অনুমতি সংরক্ষণ করুন"}</button>
        {state && <p className={`notice ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</p>}
      </div>
    </form>
  );
}
