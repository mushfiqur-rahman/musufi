// The owner-editable role → permissions table. Server-only.
// Stored as JSON in settings (name 'roles'); cached with the "roles" tag and
// refreshed by updateTag(ROLES_TAG) when the owner saves.
import { cacheLife, cacheTag } from "next/cache";
import { dbConfigured, execute, selectOne } from "./db";
import { DEFAULT_ROLE_PERMISSIONS, normalizeMatrix, type RoleMatrix } from "./permissions";

export const ROLES_TAG = "roles";

export async function getRoleMatrix(): Promise<RoleMatrix> {
  "use cache";
  cacheTag(ROLES_TAG);
  cacheLife("hours");
  if (!dbConfigured()) return normalizeMatrix(DEFAULT_ROLE_PERMISSIONS);
  const row = await selectOne<{ value: string }>("SELECT value FROM settings WHERE name = 'roles'");
  return normalizeMatrix(row ? JSON.parse(row.value) : null);
}

export async function saveRoleMatrix(m: RoleMatrix): Promise<void> {
  const clean = normalizeMatrix(m);
  await execute(
    "INSERT INTO settings (name, value) VALUES ('roles', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [JSON.stringify(clean)],
  );
}
