// Admin access gate. Server-only. Every admin page and every server action
// goes through requirePermission(), so the rules live in one place
// (lib/permissions.ts) and cannot be skipped by calling an action directly.
import { redirect } from "next/navigation";
import { currentCustomer, type Customer } from "./auth";
import { can, permissionsOf, type Permission } from "./permissions";
import { getRoleMatrix } from "./roles";

/** A logged-in staff member with the permissions their role has right now. */
export type Staff = Customer & { role: NonNullable<Customer["role"]>; permissions: readonly Permission[] };

async function withPermissions(me: Customer): Promise<Staff> {
  return { ...me, role: me.role!, permissions: permissionsOf(await getRoleMatrix(), me.role) };
}

/**
 * For PAGES: returns the staff member, or redirects
 * (logged out → /login, customer → /account, staff without this permission → /admin).
 */
export async function requirePermission(permission: Permission): Promise<Staff> {
  const me = await currentCustomer();
  if (!me) redirect("/login");
  if (!me.role) redirect("/account");
  // Two-factor login: staff with 2FA on must enter an app code in this session first.
  if (me.mfaPending) redirect("/admin/verify");
  const staff = await withPermissions(me);
  if (!can(staff, permission)) redirect("/admin?denied=1");
  return staff;
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
}

/**
 * For SERVER ACTIONS: returns the staff member or throws ForbiddenError.
 * Server actions are public HTTP endpoints, so they must check on their own.
 */
export async function assertPermission(permission: Permission): Promise<Staff> {
  const me = await currentCustomer();
  if (!me?.role || me.mfaPending) throw new ForbiddenError("Not allowed: " + permission);
  const staff = await withPermissions(me);
  if (!can(staff, permission)) throw new ForbiddenError("Not allowed: " + permission);
  return staff;
}

/**
 * For the 2FA pages only (/admin/security, /admin/verify): any staff member,
 * WITHOUT the 2FA check, so a pending session can reach the code form.
 */
export async function requireStaff(): Promise<Staff> {
  const me = await currentCustomer();
  if (!me) redirect("/login");
  if (!me.role) redirect("/account");
  return withPermissions(me);
}

/** Server-action twin of requireStaff (no 2FA check). */
export async function assertStaff(): Promise<Staff> {
  const me = await currentCustomer();
  if (!me?.role) throw new ForbiddenError("Not staff");
  return withPermissions(me);
}

/** @deprecated use requirePermission with a specific permission */
export async function requireAdmin(): Promise<Staff> {
  return requirePermission("dashboard.view");
}
