"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { addExpense, deleteExpense, saveCost, saveSetting, setNote, setStatus, SETTING_KEYS, STATUSES, type OrderStatus, type SettingKey } from "@/lib/orders";
import { getProduct } from "@/lib/products";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const BN = "০১২৩৪৫৬৭৮৯";
/** Parses a whole-taka amount; accepts Bangla digits. Empty → null. */
function amount(raw: string): number | null {
  const s = raw.replace(/[০-৯]/g, (d) => String(BN.indexOf(d))).replace(/[,\s৳]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 10_000_000 ? n : NaN;
}

export async function updateOrderStatus(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const orderNo = str(form, "orderNo");
  const status = str(form, "status") as OrderStatus;
  if (!STATUSES.includes(status)) return;
  await setStatus(orderNo, status, str(form, "note").slice(0, 500) || null, admin.email);
  refresh();
}

export async function updateOrderNote(form: FormData): Promise<void> {
  await requireAdmin();
  await setNote(str(form, "orderNo"), str(form, "note").slice(0, 500));
  refresh();
}

export async function updateCost(form: FormData): Promise<void> {
  await requireAdmin();
  const slug = str(form, "slug");
  const index = Number(str(form, "variant"));
  const product = getProduct(slug);
  if (!product || !Number.isInteger(index) || !product.variants[index]) return;
  const cost = amount(str(form, "cost"));
  if (Number.isNaN(cost)) return;
  await saveCost(slug, index, cost);
  refresh();
}

export async function updateSettings(form: FormData): Promise<void> {
  await requireAdmin();
  for (const key of SETTING_KEYS) {
    const v = amount(str(form, key));
    if (v !== null && !Number.isNaN(v)) await saveSetting(key as SettingKey, v);
  }
  refresh();
}

export async function createExpense(form: FormData): Promise<void> {
  await requireAdmin();
  const spentOn = str(form, "spentOn");
  const value = amount(str(form, "amount"));
  const category = str(form, "category").slice(0, 40);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || value === null || Number.isNaN(value) || value === 0 || !category) return;
  await addExpense({ spentOn, category, amount: value, note: str(form, "note").slice(0, 200) || null });
  refresh();
}

export async function removeExpense(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(str(form, "id"));
  if (Number.isInteger(id) && id > 0) await deleteExpense(id);
  refresh();
}
