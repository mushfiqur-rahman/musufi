// Shared address and phone checks for orders and the customer profile. Server-only.
import { findDistrict, findDivision, findUpazila, formatAddress, localLabel, type AddressParts } from "./geo";
import { findUnion } from "./geo-unions";

/** Bangladeshi mobile number: 01 + operator digit 3-9 + 8 digits. */
export const BD_MOBILE = /^01[3-9]\d{8}$/;

export type ParsedAddress = { ok: true; parts: AddressParts; line: string } | { ok: false; message: string };

/** Validates the chosen areas against the official list and builds the address line. */
export function parseAddress(v: unknown): ParsedAddress {
  if (!v || typeof v !== "object") return { ok: false, message: "ঠিকানা দিন।" };
  const a = v as Record<string, unknown>;
  const division = findDivision(Number(a.divisionId));
  const district = findDistrict(Number(a.districtId));
  const upazila = findUpazila(Number(a.upazilaId));
  if (!division) return { ok: false, message: "বিভাগ বেছে নিন।" };
  if (!district || district.divisionId !== division.id) return { ok: false, message: "জেলা বেছে নিন।" };
  if (!upazila || upazila.districtId !== district.id) return { ok: false, message: "উপজেলা বা থানা বেছে নিন।" };
  const line = typeof a.line === "string" ? a.line.trim() : "";
  if (line.length < 5 || line.length > 200) return { ok: false, message: "গ্রাম/এলাকা, রাস্তা আর বাসার নম্বর লিখুন।" };
  let localId: number | null = null;
  let local = "";
  if (a.localId !== null && a.localId !== undefined && a.localId !== "") {
    const n = Number(a.localId);
    if (upazila.city) {
      if (!Number.isInteger(n) || !upazila.postOffices[n]) return { ok: false, message: "পোস্ট অফিস আবার বেছে নিন।" };
      localId = n;
      local = localLabel(upazila, n);
    } else {
      const union = Number.isInteger(n) ? findUnion(upazila.id, n) : undefined;
      if (!union) return { ok: false, message: "ইউনিয়ন আবার বেছে নিন।" };
      localId = n;
      local = `${union.bn} ইউনিয়ন`;
    }
  }
  return {
    ok: true,
    parts: { divisionId: division.id, districtId: district.id, upazilaId: upazila.id, localId, line },
    line: formatAddress({ line, local, upazila, district, division }),
  };
}
