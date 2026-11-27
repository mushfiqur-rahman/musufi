// Admin access gate. Server-only. Every admin page and every server action
// goes through requirePermission(), so the rules live in one place
// (lib/permissions.ts) and cannot be skipped by calling an action directly.
import { redirect } from "next/navigation";
import { currentCustomer, type Customer } from "./auth";
import { can, type Permission } from "./permissions";

export type Staff = Customer & { role: NonNullable<Customer["role"]> };

/**
 * For PAGES: returns the staff member, or redirects
 * (logged out → /login, customer → /account, staff without this permission → /admin).
 */
export async function requirePermission(permission: Permission): Promise<Staff> {
  const me = await currentCustomer();
  if (!me) redirect("/login");
  if (!me.role) redirect("/account");
  if (!can(me.role, permission)) redirect("/admin?denied=1");
  return me as Staff;
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
  if (!me?.role || !can(me.role, permission)) throw new ForbiddenError("Not allowed: " + permission);
  return me as Staff;
}

/** @deprecated use requirePermission with a specific permission */
export async function requireAdmin(): Promise<Staff> {
  return requirePermission("dashboard.view");
}
