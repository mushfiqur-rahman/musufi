"use server";
// Staff two-factor login (TOTP). Same pattern as the other admin actions:
// check who is calling → do the work → audit → redirect with a result flag.
// Pages show the result from the query string, so no client JS is needed.

import { redirect } from "next/navigation";
import { assertPermission, assertStaff } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/auth";
import { selectOne } from "@/lib/db";
import {
  cancelEnrolment, confirmEnrolment, disableWithCode, normalizeCode, reset, startEnrolment, tooManyAttempts, verifySession,
} from "@/lib/mfa";

const SECURITY = "/admin/security";

/** Step 1 of setup: creates a pending secret, then the page shows it. */
export async function startTotpAction(): Promise<void> {
  const me = await assertStaff();
  if (me.totpEnabled) redirect(SECURITY);
  await startEnrolment(me.id);
  redirect(`${SECURITY}?setup=1`);
}

export async function cancelTotpAction(): Promise<void> {
  const me = await assertStaff();
  await cancelEnrolment(me.id);
  redirect(SECURITY);
}

/** Step 2 of setup: the first correct code turns 2FA on. */
export async function confirmTotpAction(form: FormData): Promise<void> {
  const me = await assertStaff();
  if (tooManyAttempts(me.id)) redirect(`${SECURITY}?setup=1&err=many`);
  if (!(await confirmEnrolment(me.id, normalizeCode(form.get("code"))))) redirect(`${SECURITY}?setup=1&err=code`);
  await audit(me, "2fa.enable", "staff", me.email);
  redirect(`${SECURITY}?on=1`);
}

/** Per-login check for staff with 2FA on. */
export async function verifyTotpAction(form: FormData): Promise<void> {
  const me = await assertStaff();
  if (!me.mfaPending) redirect("/admin");
  if (tooManyAttempts(me.id)) redirect("/admin/verify?err=many");
  if (!(await verifySession(me.id, normalizeCode(form.get("code"))))) redirect("/admin/verify?err=code");
  redirect("/admin");
}

/** Turning it off needs a fresh code, so a stolen open session can't do it alone. */
export async function disableTotpAction(form: FormData): Promise<void> {
  const me = await assertPermission("dashboard.view"); // also requires this session to be 2FA-verified
  if (tooManyAttempts(me.id)) redirect(`${SECURITY}?err=many`);
  if (!(await disableWithCode(me.id, normalizeCode(form.get("code"))))) redirect(`${SECURITY}?err=code`);
  await audit(me, "2fa.disable", "staff", me.email);
  redirect(`${SECURITY}?off=1`);
}

/** Owner reset (lost phone). Also signs the person out everywhere. */
export async function resetStaffTotpAction(form: FormData): Promise<void> {
  const me = await assertPermission("staff.manage");
  const email = normalizeEmail(form.get("email"));
  // Own 2FA is turned off from the security page, with a code.
  if (!email || email === me.email) redirect("/admin/staff");
  const row = await selectOne<{ id: number }>("SELECT id FROM customers WHERE email = ? AND totp_enabled_at IS NOT NULL", [email]);
  if (row) {
    await reset(row.id);
    await audit(me, "2fa.reset", "staff", email);
  }
  redirect("/admin/staff?reset2fa=1");
}
