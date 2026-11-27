"use server";
// Owner edits the role → permission table. permission → validate → write → audit → refresh.

import { refresh, updateTag } from "next/cache";
import { assertPermission } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { isPermission, isRole, normalizeMatrix, PERMISSIONS, ROLES, type Permission, type Role } from "@/lib/permissions";
import { getRoleMatrix, ROLES_TAG, saveRoleMatrix } from "@/lib/roles";
import { actionError, type ActionResult } from "@/lib/validate";

export async function saveRolePermissionsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("staff.manage");
    const picked = Object.fromEntries(ROLES.map((r) => [r, [] as Permission[]])) as Record<Role, Permission[]>;
    for (const key of form.keys()) {
      const [role, perm] = key.split(":");
      if (isRole(role) && isPermission(perm)) picked[role].push(perm);
    }
    const before = await getRoleMatrix();
    const next = normalizeMatrix(picked);
    await saveRoleMatrix(next);
    // Log only what changed, per role.
    const changes: Record<string, { added: Permission[]; removed: Permission[] }> = {};
    for (const r of ROLES) {
      const added = PERMISSIONS.filter((p) => next[r].includes(p) && !before[r].includes(p));
      const removed = PERMISSIONS.filter((p) => !next[r].includes(p) && before[r].includes(p));
      if (added.length || removed.length) changes[r] = { added, removed };
    }
    await audit(me, "roles.update", "roles", null, changes);
    updateTag(ROLES_TAG);
    refresh();
    return { ok: true, message: Object.keys(changes).length ? "অনুমতি সংরক্ষণ হয়েছে। স্টাফরা পরের পেজ খুললেই নতুন অনুমতি পাবেন।" : "কিছু বদলানো হয়নি।" };
  } catch (e) {
    return actionError("roles.update", e);
  }
}
