// Bangladesh areas for the address picker. Pure data + pure functions:
// imported by the client picker AND by the server, which re-validates every
// selection (never trust ids from the browser). Unions are not included here
// (210 KB); the server reads them in lib/geo-unions.ts.
import areas from "@/data/bd-geo/areas.json";
import type { DeliveryZone } from "./site";

export type Division = { id: number; bn: string; en: string };
export type District = { id: number; divisionId: number; bn: string; en: string };
/** An upazila, or a Dhaka city thana (id ≥ 9000, has post offices instead of unions). */
export type Upazila = { id: number; districtId: number; bn: string; en: string; city: boolean; postOffices: { name: string; code: string }[] };

type Raw = {
  divisions: [number, string, string][];
  districts: [number, number, string, string][];
  upazilas: [number, number, string, string][];
  cityThanas: [number, number, string, string, [string, string][]][];
};
const raw = areas as unknown as Raw;

export const DIVISIONS: Division[] = raw.divisions.map(([id, bn, en]) => ({ id, bn, en })).sort((a, b) => a.bn.localeCompare(b.bn, "bn"));
export const DISTRICTS: District[] = raw.districts.map(([id, divisionId, bn, en]) => ({ id, divisionId, bn, en }));
const UPAZILAS: Upazila[] = [
  // Dhaka city thanas first: that's where most Dhaka orders come from.
  ...raw.cityThanas.map(([id, districtId, bn, en, pos]) => ({ id, districtId, bn, en, city: true, postOffices: pos.map(([name, code]) => ({ name, code })) })),
  ...raw.upazilas.map(([id, districtId, bn, en]) => ({ id, districtId, bn, en, city: false, postOffices: [] })),
];

/** Dhaka district id in the source data. */
export const DHAKA_DISTRICT_ID = 47;

export function districtsOf(divisionId: number): District[] {
  return DISTRICTS.filter((d) => d.divisionId === divisionId).sort((a, b) => a.bn.localeCompare(b.bn, "bn"));
}

export function upazilasOf(districtId: number): Upazila[] {
  const list = UPAZILAS.filter((u) => u.districtId === districtId);
  return [...list.filter((u) => u.city), ...list.filter((u) => !u.city).sort((a, b) => a.bn.localeCompare(b.bn, "bn"))];
}

export const findDivision = (id: number) => DIVISIONS.find((d) => d.id === id);
export const findDistrict = (id: number) => DISTRICTS.find((d) => d.id === id);
export const findUpazila = (id: number) => UPAZILAS.find((u) => u.id === id);

/** Delivery zone from the district: Dhaka district = "dhaka", everywhere else "outside". */
export function zoneForDistrict(districtId: number): DeliveryZone {
  return districtId === DHAKA_DISTRICT_ID ? "dhaka" : "outside";
}

/** The structured address the order form sends. */
export type AddressParts = {
  divisionId: number;
  districtId: number;
  upazilaId: number;
  /** Union id (upazilas) or post-office index (city thanas); null if not chosen. */
  localId: number | null;
  /** Village / area, road, house: free text. */
  line: string;
};

/** Human-readable label of the union / post office, e.g. "মোহাম্মদপুর হাউজিং (1207)". */
export function localLabel(u: Upazila, localId: number | null, unionName?: string): string {
  if (localId === null) return "";
  if (u.city) {
    const po = u.postOffices[localId];
    return po ? `${po.name} (${po.code})` : "";
  }
  return unionName ?? "";
}

/**
 * One line for couriers and emails, smallest place first:
 * "বাসা 12, রোড 5, গ্রাম…, ইউনিয়ন/পোস্ট অফিস, উপজেলা/থানা, জেলা, বিভাগ".
 */
export function formatAddress(p: { line: string; local: string; upazila: Upazila; district: District; division: Division }): string {
  const thana = p.upazila.city ? `${p.upazila.bn} থানা` : `${p.upazila.bn} উপজেলা`;
  return [p.line, p.local, thana, `${p.district.bn} জেলা`, `${p.division.bn} বিভাগ`].filter(Boolean).join(", ");
}
