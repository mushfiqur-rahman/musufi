// Admin access check. Server-only.
import { redirect } from "next/navigation";
import { currentCustomer, type Customer } from "./auth";

/** Returns the admin, or redirects: to /login when logged out, to /account when not an admin. */
export async function requireAdmin(): Promise<Customer> {
  const me = await currentCustomer();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/account");
  return me;
}
