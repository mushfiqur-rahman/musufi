"use server";
// Store settings (contact, delivery, payments). Permission: settings.manage.

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/admin";
import { audit } from "@/lib/audit";
import { DISTRICTS } from "@/lib/geo";
import type { StoreSettings } from "@/lib/store-config";
import { saveStoreSettings, SETTINGS_TAG } from "@/lib/store-settings";
import { actionError, text, ValidationError, wholeNumber, type ActionResult } from "@/lib/validate";

const PHONE = /^01[3-9]\d{8}$/;

export async function saveSettingsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const me = await assertPermission("settings.manage");
    const digits = (v: FormDataEntryValue | null) => text(v, "ফোন", { max: 20 }).replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\D/g, "");
    const phone = digits(form.get("phone"));
    if (!PHONE.test(phone)) throw new ValidationError("phone", "ফোন: ১১ সংখ্যার মোবাইল নম্বর দিন");
    let whatsapp = digits(form.get("whatsapp"));
    if (PHONE.test(whatsapp)) whatsapp = "88" + whatsapp; // accept local format
    if (!/^8801[3-9]\d{8}$/.test(whatsapp)) throw new ValidationError("whatsapp", "হোয়াটসঅ্যাপ: ১১ সংখ্যার নম্বর দিন");
    const wallet = (k: string, label: string) => {
      const v = digits(form.get(k));
      if (v && !PHONE.test(v)) throw new ValidationError(k, `${label}: ১১ সংখ্যার নম্বর দিন, বা খালি রাখুন`);
      return v;
    };
    const known = new Set(DISTRICTS.map((d) => d.id));
    const dhakaDistrictIds = form.getAll("dhakaDistrict").map(Number).filter((n) => known.has(n));
    if (dhakaDistrictIds.length === 0) throw new ValidationError("dhakaDistrict", "‘ঢাকার ভেতরে’ চার্জের জন্য কমপক্ষে একটি জেলা বেছে নিন");

    const s: StoreSettings = {
      contact: {
        phone,
        whatsapp,
        address: text(form.get("address"), "ঠিকানা", { max: 160 }),
        district: text(form.get("district"), "জেলা", { max: 60 }),
        hours: text(form.get("hours"), "সময়", { max: 80 }),
        founder: text(form.get("founder"), "প্রতিষ্ঠাতা", { max: 80 }),
      },
      delivery: {
        dhaka: {
          label: text(form.get("dhakaLabel"), "ঢাকা: নাম", { max: 40, required: true }),
          fee: wholeNumber(form.get("dhakaFee"), "ঢাকা: চার্জ", { max: 10_000, required: true })!,
          days: text(form.get("dhakaDays"), "ঢাকা: সময়", { max: 40, required: true }),
        },
        outside: {
          label: text(form.get("outsideLabel"), "বাইরে: নাম", { max: 40, required: true }),
          fee: wholeNumber(form.get("outsideFee"), "বাইরে: চার্জ", { max: 10_000, required: true })!,
          days: text(form.get("outsideDays"), "বাইরে: সময়", { max: 40, required: true }),
        },
      },
      dhakaDistrictIds,
      freeDeliveryOver: wholeNumber(form.get("freeOver"), "ফ্রি ডেলিভারি", { min: 1, max: 1_000_000 }),
      payments: { cod: form.get("cod") === "1", bkash: wallet("bkash", "বিকাশ"), nagad: wallet("nagad", "নগদ") },
    };
    if (!s.payments.cod && !s.payments.bkash && !s.payments.nagad) throw new ValidationError("cod", "কমপক্ষে একটি পেমেন্টের উপায় চালু রাখুন");
    await saveStoreSettings(s);
    await audit(me, "settings.update", "settings", "store", { dhakaDistricts: dhakaDistrictIds.length, fees: [s.delivery.dhaka.fee, s.delivery.outside.fee] });
    updateTag(SETTINGS_TAG);
  } catch (e) {
    return actionError("settings.save", e);
  }
  redirect("/admin/settings?saved=1");
}
