"use server";
// Saves the main menu. permission → validate → write → audit → refresh.

import { refresh, updateTag } from "next/cache";
import { assertPermission } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { cleanMenu, MENU_TAG, saveMenuItems } from "@/lib/menu";
import { actionError, jsonPayload, type ActionResult } from "@/lib/validate";

export async function saveMenuAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("content.manage");
    const items = cleanMenu(jsonPayload<unknown>(form.get("items"), "মেনু"));
    if (items.length === 0) return { ok: false, message: "মেনুতে অন্তত একটি লিংক রাখুন।" };
    await saveMenuItems(items);
    await audit(me, "menu.save", "settings", "menu", { count: items.length });
    updateTag(MENU_TAG);
    refresh();
    return { ok: true, message: "মেনু সংরক্ষণ হয়েছে। সাইটে সাথে সাথে দেখাবে।" };
  } catch (e) {
    return actionError("menu.save", e);
  }
}
