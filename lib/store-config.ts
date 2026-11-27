// Store settings: TYPES, DEFAULTS and PURE helpers. Safe in client components.
// The server loads the saved values with lib/store-settings.ts and passes
// what the browser needs (PublicConfig) down as props.
import { DHAKA_DISTRICT_ID } from "./geo";
import { bn, site, type DeliveryZone } from "./site";

export type ZoneConfig = { label: string; fee: number; days: string };

export type StoreSettings = {
  contact: { phone: string; whatsapp: string; address: string; district: string; hours: string; founder: string };
  delivery: Record<DeliveryZone, ZoneConfig>;
  /** Districts charged as "inside Dhaka" (others are "outside"). */
  dhakaDistrictIds: number[];
  /** Free delivery when the items cost at least this much; null = never. */
  freeDeliveryOver: number | null;
  payments: { cod: boolean; bkash: string; nagad: string };
};

/** What lib/site.ts had before settings existed; used until the owner saves. */
export const DEFAULT_SETTINGS: StoreSettings = {
  contact: { phone: site.phone, whatsapp: site.whatsapp, address: site.address, district: site.district, hours: site.hours, founder: site.founder },
  delivery: {
    dhaka: { label: site.delivery.dhaka.label, fee: site.delivery.dhaka.fee, days: site.delivery.dhaka.days },
    outside: { label: site.delivery.outside.label, fee: site.delivery.outside.fee, days: site.delivery.outside.days },
  },
  dhakaDistrictIds: [DHAKA_DISTRICT_ID],
  freeDeliveryOver: null,
  payments: { cod: true, bkash: "", nagad: "" },
};

/** The subset the browser needs (no internal fields). */
export type PublicConfig = Pick<StoreSettings, "delivery" | "dhakaDistrictIds" | "freeDeliveryOver" | "payments"> & {
  phone: string;
  whatsapp: string;
};

export function publicConfig(s: StoreSettings): PublicConfig {
  return {
    delivery: s.delivery,
    dhakaDistrictIds: s.dhakaDistrictIds,
    freeDeliveryOver: s.freeDeliveryOver,
    payments: s.payments,
    phone: s.contact.phone,
    whatsapp: s.contact.whatsapp,
  };
}

export function zoneFor(c: Pick<StoreSettings, "dhakaDistrictIds">, districtId: number): DeliveryZone {
  return c.dhakaDistrictIds.includes(districtId) ? "dhaka" : "outside";
}

/** Delivery fee for a zone and item subtotal, applying the free-delivery threshold. */
export function deliveryFee(c: Pick<StoreSettings, "delivery" | "freeDeliveryOver">, zone: DeliveryZone, subtotal: number): number {
  if (c.freeDeliveryOver !== null && subtotal >= c.freeDeliveryOver) return 0;
  return c.delivery[zone].fee;
}

export function waLink(whatsapp: string, text?: string): string {
  const base = `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** "01712345678" → "০১৭১২-৩৪৫৬৭৮". */
export function phoneText(phone: string): string {
  return bn(phone.replace(/^(\d{5})(\d+)$/, "$1-$2"));
}

/** Labels of accepted payment methods, for display. */
export function paymentNames(p: StoreSettings["payments"]): string[] {
  return [p.cod && "ক্যাশ অন ডেলিভারি", p.bkash && "বিকাশ", p.nagad && "নগদ"].filter(Boolean) as string[];
}

/** Merges a saved (possibly partial or older) object over the defaults. */
export function withDefaults(saved: unknown): StoreSettings {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<StoreSettings>;
  const d = DEFAULT_SETTINGS;
  return {
    contact: { ...d.contact, ...(s.contact ?? {}) },
    delivery: { dhaka: { ...d.delivery.dhaka, ...(s.delivery?.dhaka ?? {}) }, outside: { ...d.delivery.outside, ...(s.delivery?.outside ?? {}) } },
    dhakaDistrictIds: Array.isArray(s.dhakaDistrictIds) && s.dhakaDistrictIds.length ? s.dhakaDistrictIds.map(Number).filter(Number.isInteger) : d.dhakaDistrictIds,
    freeDeliveryOver: typeof s.freeDeliveryOver === "number" ? s.freeDeliveryOver : d.freeDeliveryOver,
    payments: { ...d.payments, ...(s.payments ?? {}) },
  };
}
