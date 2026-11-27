"use server";
// Orders, finance and staff actions. Same pattern as products.ts:
// permission → validate → write → audit → refresh.

import { refresh } from "next/cache";
import { assertPermission } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/auth";
import { execute, selectOne } from "@/lib/db";
import { setBlocked, setCustomerNotes } from "@/lib/customers";
import { smtpReady, sendShippedEmail } from "@/lib/mailer";
import {
  addExpense, deleteExpense, getOrder, markShippedEmail, PAYMENT_METHODS, PAYMENT_STATUSES, saveSetting, setNote, setPayment, setShipping,
  setStatus, SETTING_KEYS, shippedEmailSent, STATUSES,
} from "@/lib/orders";
import { isRole, ROLES } from "@/lib/permissions";
import { actionError, oneOf, text, wholeNumber, type ActionResult } from "@/lib/validate";

// ---------- Orders ----------

export async function updateOrderStatus(form: FormData): Promise<void> {
  const me = await assertPermission("orders.manage");
  const orderNo = text(form.get("orderNo"), "অর্ডার", { max: 20, required: true });
  const status = oneOf(form.get("status"), STATUSES, "অবস্থা");
  const note = text(form.get("note"), "নোট", { max: 500 }) || null;
  if (await setStatus(orderNo, status, note, me.email)) await audit(me, "order.status", "order", orderNo, { status, note });
  if (status === "shipped") await notifyShipped(orderNo);
  refresh();
}

export async function updateOrderNote(form: FormData): Promise<void> {
  const me = await assertPermission("orders.manage");
  const orderNo = text(form.get("orderNo"), "অর্ডার", { max: 20, required: true });
  await setNote(orderNo, text(form.get("note"), "নোট", { max: 500 }));
  await audit(me, "order.note", "order", orderNo);
  refresh();
}

/** Same status for several orders at once (from the order list checkboxes). */
export async function bulkOrderStatus(form: FormData): Promise<void> {
  const me = await assertPermission("orders.manage");
  const status = oneOf(form.get("status"), STATUSES, "অবস্থা");
  const orderNos = form.getAll("orderNo").map((v) => text(v, "অর্ডার", { max: 20 })).filter(Boolean).slice(0, 200);
  for (const orderNo of orderNos) {
    if (await setStatus(orderNo, status, "একসাথে বদলানো", me.email)) await audit(me, "order.status", "order", orderNo, { status, bulk: true });
  }
  refresh();
}

/**
 * Courier + tracking number. If the order is already shipped (or this marks it
 * shipped) and has a tracking number, the customer gets one shipping email.
 */
export async function updateShipping(form: FormData): Promise<void> {
  const me = await assertPermission("orders.manage");
  const orderNo = text(form.get("orderNo"), "অর্ডার", { max: 20, required: true });
  const courier = text(form.get("courier"), "কুরিয়ার", { max: 40 }) || null;
  const trackingNo = text(form.get("trackingNo"), "ট্র্যাকিং নম্বর", { max: 60 }) || null;
  if (!(await setShipping(orderNo, courier, trackingNo))) return;
  await audit(me, "order.tracking", "order", orderNo, { courier, trackingNo });
  if (form.get("markShipped") === "1") {
    await setStatus(orderNo, "shipped", trackingNo ? `ট্র্যাকিং: ${trackingNo}` : null, me.email);
    await audit(me, "order.status", "order", orderNo, { status: "shipped" });
  }
  await notifyShipped(orderNo);
  refresh();
}

/** Sends the shipping email once, when the order is shipped and has tracking. Never throws. */
async function notifyShipped(orderNo: string): Promise<void> {
  try {
    const o = await getOrder(orderNo);
    if (!o || o.status !== "shipped" || !o.tracking_no || !smtpReady() || (await shippedEmailSent(orderNo))) return;
    await sendShippedEmail(o.email, { orderNo, name: o.name, courier: o.courier, trackingNo: o.tracking_no, total: o.total });
    await markShippedEmail(orderNo);
  } catch (e) {
    console.error("[order] shipping email failed:", e instanceof Error ? e.message : e);
  }
}

/** Payment method, status, received / refunded amounts and bKash/Nagad reference. */
export async function updatePayment(form: FormData): Promise<void> {
  const me = await assertPermission("orders.manage");
  const orderNo = text(form.get("orderNo"), "অর্ডার", { max: 20, required: true });
  const p = {
    method: oneOf(form.get("method"), PAYMENT_METHODS, "পেমেন্টের উপায়"),
    status: oneOf(form.get("payStatus"), PAYMENT_STATUSES, "পেমেন্টের অবস্থা"),
    paid: wholeNumber(form.get("paid"), "পাওয়া টাকা", { max: 10_000_000 }),
    refund: wholeNumber(form.get("refund"), "ফেরত টাকা", { max: 10_000_000 }),
    ref: text(form.get("ref"), "লেনদেন নম্বর", { max: 60 }) || null,
  };
  if (await setPayment(orderNo, p)) await audit(me, "order.payment", "order", orderNo, p);
  refresh();
}

// ---------- Customers ----------

export async function customerBlock(form: FormData): Promise<void> {
  const me = await assertPermission("customers.manage");
  const id = wholeNumber(form.get("id"), "id", { min: 1, max: 100_000_000, required: true })!;
  const block = form.get("block") === "1";
  if (await setBlocked(id, block)) await audit(me, block ? "customer.block" : "customer.unblock", "customer", id);
  refresh();
}

export async function customerNotes(form: FormData): Promise<void> {
  const me = await assertPermission("customers.manage");
  const id = wholeNumber(form.get("id"), "id", { min: 1, max: 100_000_000, required: true })!;
  await setCustomerNotes(id, text(form.get("notes"), "নোট", { max: 1000 }));
  await audit(me, "customer.note", "customer", id);
  refresh();
}

// ---------- Finance ----------

export async function updateSettings(form: FormData): Promise<void> {
  const me = await assertPermission("finance.manage");
  const changed: Record<string, number> = {};
  for (const key of SETTING_KEYS) {
    const v = wholeNumber(form.get(key), key, { max: 100_000 });
    if (v !== null) {
      await saveSetting(key, v);
      changed[key] = v;
    }
  }
  await audit(me, "settings.update", "settings", "parcel", changed);
  refresh();
}

export async function createExpense(form: FormData): Promise<void> {
  const me = await assertPermission("finance.manage");
  const spentOn = text(form.get("spentOn"), "তারিখ", { max: 10, required: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) return;
  const amount = wholeNumber(form.get("amount"), "টাকা", { min: 1, max: 10_000_000, required: true })!;
  const category = text(form.get("category"), "ধরন", { max: 40, required: true });
  const note = text(form.get("note"), "বিবরণ", { max: 200 }) || null;
  await addExpense({ spentOn, category, amount, note });
  await audit(me, "expense.create", "expense", null, { spentOn, category, amount });
  refresh();
}

export async function removeExpense(form: FormData): Promise<void> {
  const me = await assertPermission("finance.manage");
  const id = wholeNumber(form.get("id"), "id", { min: 1, max: 100_000_000, required: true })!;
  await deleteExpense(id);
  await audit(me, "expense.delete", "expense", id);
  refresh();
}

// ---------- Staff ----------

/** Adds or changes a staff member. The person logs in with their own email code. */
export async function setStaffRole(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("staff.manage");
    const email = normalizeEmail(form.get("email"));
    if (!email) return { ok: false, message: "সঠিক ইমেইল দিন।" };
    const role = oneOf(form.get("role"), ROLES, "ভূমিকা");
    if (email === me.email) return { ok: false, message: "নিজের ভূমিকা নিজে বদলানো যায় না।" };
    // Create the account if this person never logged in; they become staff on first login.
    await execute(
      "INSERT INTO customers (email, role) VALUES (?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), blocked_at = NULL",
      [email, role],
    );
    await audit(me, "staff.role", "staff", email, { role });
    refresh();
    return { ok: true, message: `${email} এখন স্টাফ। তারা নিজের ইমেইলের কোড দিয়ে লগইন করবেন।` };
  } catch (e) {
    return actionError("staff.role", e);
  }
}

export async function removeStaff(form: FormData): Promise<void> {
  const me = await assertPermission("staff.manage");
  const email = normalizeEmail(form.get("email"));
  if (!email || email === me.email) return;
  const row = await selectOne<{ role: string | null }>("SELECT role FROM customers WHERE email = ?", [email]);
  if (!row || !isRole(row.role)) return;
  await execute("UPDATE customers SET role = NULL WHERE email = ?", [email]);
  // End their sessions so the change applies immediately.
  await execute("DELETE s FROM sessions s JOIN customers c ON c.id = s.customer_id WHERE c.email = ?", [email]);
  await audit(me, "staff.remove", "staff", email, { previousRole: row.role });
  refresh();
}
