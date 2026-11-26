// Business details in one place. Everything marked TODO is a placeholder
// the owner must replace before launch.
export const site = {
  name: "মুসুফি",
  nameLatin: "Musufi",
  tagline: "আস্থা আর নির্ভরতা",
  slogan: "আস্থা আর নির্ভরতা, বিশ্বাসের অপূর্ব সমন্বয় মুসুফি",
  url: "https://musufi.com",
  description:
    "মুসুফি একটি অনলাইন শপ: ভেটকি, পার্সে ও বাগদা-গলদা চিংড়িসহ লোনা পানির মাছ, খুলনার চুইঝাল, চাকের মধু, ঘানির সরিষার তেল আর ঘরে তৈরি আচার ও গুড়। প্রতিটি পণ্যের উৎস লেখা, সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।",
  phone: "01700000000", // TODO: real number
  whatsapp: "8801700000000", // TODO: real WhatsApp number, country code, no +
  district: "[জেলা]", // TODO
  address: "[ঠিকানা]", // TODO
  hours: "সকাল ৯টা থেকে রাত ৯টা",
  founder: "[প্রতিষ্ঠাতার নাম]", // TODO
  delivery: {
    dhaka: { label: "ঢাকার ভেতরে", fee: 60, days: "১–২ দিন" },
    outside: { label: "ঢাকার বাইরে", fee: 120, days: "২–৩ দিন" },
  },
  payments: ["ক্যাশ অন ডেলিভারি", "বিকাশ", "নগদ"],
} as const;

export type DeliveryZone = keyof typeof site.delivery;

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Convert Latin digits to Bangla digits. */
export function bn(value: number | string): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/** Format taka, e.g. 1650 -> "৳১,৬৫০". */
export function taka(amount: number): string {
  return "৳" + bn(amount.toLocaleString("en-IN"));
}

export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${site.whatsapp}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const phoneDisplay = bn(site.phone.replace(/^(\d{5})(\d+)$/, "$1-$2"));
