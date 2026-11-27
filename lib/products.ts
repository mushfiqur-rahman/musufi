// Catalogue TYPES, plus the STARTER catalogue used to seed the database
// (npm run db:seed) and as a fallback if the database is unreachable.
// The live shop reads products from the database via lib/catalog.ts.
import type { DeliveryZone } from "./site";

/** Category slug, e.g. "fish". Free text since categories are managed in the admin. */
export type CategoryId = string;

export type CategoryInfo = {
  id: CategoryId;
  label: string;
  /** One-line description for tiles and cards. */
  blurb: string;
  /** Answer-first paragraph at the top of the category page (GEO). */
  intro: string;
  /** Heading for the facts table on product pages. */
  factsTitle: string;
  /** Where this category can be delivered. Fish is Dhaka only. */
  zones: DeliveryZone[];
  /** Short policy line shown on product pages in this category. */
  policy: string;
  faq: { q: string; a: string }[];
  /** Illustration for the category tile until a photo exists. */
  art?: Art;
};

export const categories: CategoryInfo[] = [
  {
    id: "fish",
    art: "fish",
    label: "লোনা পানির মাছ",
    blurb: "ভেটকি, পার্সে, বাগদা-গলদা চিংড়ি",
    intro: "মুসুফির মাছ আসে খুলনা, সাতক্ষীরা আর বাগেরহাটের লোনা পানির ঘের ও নদী থেকে: ভেটকি, পার্সে, পাতাড়ি, সালুট, বাগদা আর গলদা চিংড়ি। জেলে ও ঘের মালিকের কাছ থেকে সরাসরি এনে বরফে প্যাক করে পাঠানো হয়। তাজা মাছ এখন শুধু ঢাকার ভেতরে ডেলিভারি হয়।",
    factsTitle: "মাছের তথ্য",
    zones: ["dhaka"],
    policy: "শুধু ঢাকার ভেতরে · বরফে প্যাক · নষ্ট পেলে টাকা ফেরত",
    faq: [
      { q: "লোনা পানির মাছ কী?", a: "উপকূলের নদী, খাল আর ঘেরের নোনা বা আধা-নোনা পানিতে যে মাছ বড় হয়, যেমন ভেটকি, পার্সে আর বাগদা চিংড়ি। এদের স্বাদ মিঠা পানির মাছ থেকে আলাদা।" },
      { q: "মাছ কি কেটে দেওয়া হয়?", a: "কিছু মাছে আস্ত বা ফিলে বেছে নেওয়া যায়, তা পরিমাণের ঘরে লেখা থাকে। অন্য মাছ আস্ত, পরিষ্কার করে পাঠানো হয়।" },
      { q: "ঢাকার বাইরে মাছ পাঠানো হয়?", a: "এখন না। তাজা মাছ শুধু ঢাকার ভেতরে একই দিনে বা পরের দিন ডেলিভারি হয়।" },
    ],
  },
  {
    id: "spices",
    art: "stem",
    label: "চুইঝাল ও মসলা",
    blurb: "খুলনার চুইঝাল, ঘরে গুঁড়া মসলা",
    intro: "চুইঝাল খুলনা-যশোর অঞ্চলের একটি লতার কাণ্ড, যা মাংস ও মাছে ঝাল আর ঝাঁঝালো ঘ্রাণ দেয়। মুসুফি সরাসরি চাষির কাছ থেকে তাজা চুইঝাল আর ঘরে গুঁড়া করা মসলা পাঠায়।",
    factsTitle: "পণ্যের তথ্য",
    zones: ["dhaka", "outside"],
    policy: "সারা দেশে ডেলিভারি · নষ্ট পেলে বদলে দিই",
    faq: [{ q: "চুইঝাল কীভাবে রান্না করব?", a: "কাণ্ড ছোট টুকরো করে খোসাসহ মাংস বা মাছের সাথে রান্না করুন। রান্নার পর টুকরোগুলো চিবিয়ে খাওয়া যায়।" }],
  },
  {
    id: "honey-oil",
    art: "jar",
    label: "মধু, তেল ও ঘি",
    blurb: "চাকের মধু, ঘানির তেল, গাওয়া ঘি",
    intro: "মুসুফির মধু আসে মৌয়ালদের কাছ থেকে, সরিষার তেল কাঠের ঘানিতে ভাঙা, আর ঘি নিজেদের রান্নাঘরে বানানো। কোনোটিতে মিশ্রণ বা প্রিজারভেটিভ নেই।",
    factsTitle: "পণ্যের তথ্য",
    zones: ["dhaka", "outside"],
    policy: "সারা দেশে ডেলিভারি · লিক বা নষ্ট হলে বদলে দিই",
    faq: [],
  },
  {
    id: "homemade",
    art: "pickle",
    label: "ঘরের খাবার",
    blurb: "আচার, গুড়, মুড়ি, ছোট ব্যাচে",
    intro: "আচার, পাটালি গুড় আর হাতে ভাজা মুড়ি ছোট ব্যাচে তৈরি হয়। প্রতিটি বয়াম বা প্যাকেটে তৈরির তারিখ আর মেয়াদ লেখা থাকে।",
    factsTitle: "পণ্যের তথ্য",
    zones: ["dhaka", "outside"],
    policy: "সারা দেশে ডেলিভারি · নষ্ট পেলে বদলে দিই",
    faq: [],
  },

];

/** Illustration used until real photos exist. */
export type Art = "bottle" | "jar" | "ghee" | "pickle" | "gur" | "muri" | "fish" | "prawn" | "stem";

/**
 * One product picture. `src` is a real photo in /public (e.g. "/products/bhetki-1.jpg").
 * Without `src`, the slot shows the illustration (`art`) or a "photo coming" box.
 */
export type ProductImage = {
  src?: string;
  alt: string;
  caption: string;
  art?: Art;
  /** Close-up framing for the illustration fallback. */
  closeUp?: boolean;
};

export type Variant = {
  /** Database id (absent in the starter catalogue). */
  id?: number;
  label: string; // "১ লিটার", "কাটা ও ধোয়া, ১ কেজি"
  price: number; // taka
  compareAt?: number; // old price, only when there is a real discount
  /** Units in stock; undefined = not tracked (always orderable). */
  stock?: number;
};

export type Product = {
  /** Database id (absent in the starter catalogue). */
  id?: number;
  slug: string;
  name: string;
  short: string; // shown on cards
  category: CategoryId;
  art?: Art;
  badge?: string;
  variants: Variant[];
  defaultVariant: number;
  /** One- or two-sentence direct answer: what it is, where from, what for. */
  summary: string;
  origin: string;
  facts: { label: string; value: string }[];
  /** Question-led sections for the product page (GEO). */
  sections: { q: string; a: string }[];
  faq: { q: string; a: string }[];
  related: string[];
  /** Food only: how it tastes and feels to eat. Leave out for non-food items. */
  taste?: Taste;
  /** Product photos in display order. When empty, a default photo checklist is shown. */
  images?: ProductImage[];
  metaTitle?: string;
  metaDescription?: string;
};

export type TasteKey = "sweet" | "sour" | "spicy" | "pungent" | "bitter" | "salty";
export const tasteLabels: Record<TasteKey, string> = {
  sweet: "মিষ্টি",
  sour: "টক",
  spicy: "ঝাল",
  pungent: "ঝাঁঝ",
  bitter: "তিতকুটে",
  salty: "নোনতা",
};
export type Taste = {
  /** One line shown on cards. */
  oneLine: string;
  /** 1 (barely) to 5 (very strong). List only what matters for this product. */
  levels: Partial<Record<TasteKey, 1 | 2 | 3 | 4 | 5>>;
  texture: string;
  aroma: string;
  bestWith: string[];
};

export const products: Product[] = [
  {
    slug: "mustard-oil",
    name: "ঘানি ভাঙা খাঁটি সরিষার তেল",
    short: "কাঠের ঘানি · ঠান্ডা চাপ",
    category: "honey-oil",
    art: "bottle",
    badge: "সবচেয়ে প্রিয়",
    variants: [
      { label: "৫০০ মিলি", price: 180 },
      { label: "১ লিটার", price: 340, compareAt: 360 },
      { label: "২ লিটার", price: 660, compareAt: 720 },
    ],
    defaultVariant: 1,
    summary:
      "[জেলা]-র সরিষা কাঠের ঘানিতে ঠান্ডা চাপে ভাঙা তেল। ঝাঁঝালো গন্ধ, কোনো মিশ্রণ বা রং নেই। রান্না, ভর্তা আর আচারের জন্য।",
    origin: "[জেলা], বাংলাদেশ",
    facts: [
      { label: "উপাদান", value: "১০০% সরিষা, আর কিছু নয়" },
      { label: "উৎস", value: "[জেলা], বাংলাদেশ" },
      { label: "তৈরির পদ্ধতি", value: "কাঠের ঘানি, ঠান্ডা চাপ" },
      { label: "মেয়াদ", value: "তৈরির তারিখ থেকে ৬ মাস" },
      { label: "সংরক্ষণ", value: "রোদ থেকে দূরে, মুখ বন্ধ করে রাখুন" },
      { label: "প্যাকেট", value: "ফুড গ্রেড বোতল, লিক-প্রুফ সিল" },
    ],
    sections: [
      {
        q: "এই তেল কোথা থেকে আসে?",
        a: "[জেলা]-র একটি পরিবারের কাঠের ঘানিতে প্রতি সপ্তাহে এই তেল ভাঙা হয়। সরিষা রোদে শুকিয়ে ধীরে চাপ দেওয়া হয়, তাই তাপে তেলের ঝাঁঝ আর গন্ধ নষ্ট হয় না। আমরা কোনো পাম বা সয়াবিন তেল মেশাই না।",
      },
      {
        q: "খাঁটি সরিষার তেল চিনবেন কীভাবে?",
        a: "খাঁটি ঘানির তেলের রং গাঢ় সোনালি, গন্ধ চোখে লাগার মতো ঝাঁঝালো। শীতে বোতলের নিচে সামান্য তলানি জমতে পারে, এটা স্বাভাবিক।",
      },
    ],
    faq: [
      { q: "তেলে কি ঝাঁঝ বেশি?", a: "হ্যাঁ, ঘানির তেলের ঝাঁঝ বাজারের রিফাইন্ড তেলের চেয়ে বেশি। ভর্তা ও আচারের জন্য এটাই চাওয়া হয়।" },
      { q: "বোতল কি পথে লিক হবে?", a: "প্রতিটি বোতল সিল করে আলাদা ব্যাগে প্যাক করা হয়। লিক হলে ছবি পাঠান, আমরা বদলে দেব।" },
    ],
    related: ["sundarban-honey", "mango-pickle", "date-gur", "ghee"],
    taste: { oneLine: "ঝাঁঝালো, গাঢ় সোনালি", levels: { pungent: 5, bitter: 2 }, texture: "পাতলা, স্বচ্ছ সোনালি তেল", aroma: "নাকে লাগার মতো তীব্র সরিষার ঘ্রাণ", bestWith: ["আলু ভর্তা", "মাছ ভাজা", "আচার", "মুড়ি মাখা"] },
  },
  {
    slug: "sundarban-honey",
    name: "সুন্দরবনের চাকের মধু",
    short: "কাঁচা মধু · জ্বাল দেওয়া নয়",
    category: "honey-oil",
    art: "jar",
    variants: [
      { label: "২৫০ গ্রাম", price: 450 },
      { label: "৫০০ গ্রাম", price: 850 },
      { label: "১ কেজি", price: 1650, compareAt: 1750 },
    ],
    defaultVariant: 1,
    summary:
      "সুন্দরবনের মৌয়ালদের কাছ থেকে সরাসরি আনা চাকের মধু। জ্বাল দেওয়া বা চিনি মেশানো নয়, ছেঁকে বয়ামে ভরা।",
    origin: "সুন্দরবন, খুলনা",
    facts: [
      { label: "উপাদান", value: "১০০% কাঁচা মধু" },
      { label: "উৎস", value: "সুন্দরবন, খুলনা" },
      { label: "প্রক্রিয়া", value: "শুধু ছাঁকা, জ্বাল দেওয়া নয়" },
      { label: "মেয়াদ", value: "সঠিকভাবে রাখলে ২ বছর" },
      { label: "সংরক্ষণ", value: "স্বাভাবিক তাপমাত্রায়, ফ্রিজে নয়" },
    ],
    sections: [
      {
        q: "এই মধু কোথা থেকে আসে?",
        a: "সুন্দরবনের মৌসুমে মৌয়ালরা বনের ভেতরের চাক থেকে মধু কাটেন। আমরা তাঁদের কাছ থেকে সরাসরি কিনে ছেঁকে বয়ামে ভরি।",
      },
      {
        q: "মধু জমে গেলে কি নষ্ট হয়ে গেছে?",
        a: "না। কাঁচা মধু ঠান্ডায় জমে যেতে পারে, এটা স্বাভাবিক। বয়াম গরম পানিতে কিছুক্ষণ রাখলে আবার তরল হয়।",
      },
    ],
    faq: [{ q: "মধুতে কি চিনি মেশানো?", a: "না। আমরা কোনো চিনি, সিরাপ বা পানি মেশাই না।" }],
    related: ["black-seed-honey", "mustard-oil", "ghee", "date-gur"],
    taste: { oneLine: "হালকা টক-মিষ্টি, পাতলা", levels: { sweet: 4, sour: 2 }, texture: "তুলনামূলক পাতলা, সহজে গড়িয়ে পড়ে", aroma: "বনের ফুলের হালকা ঘ্রাণ", bestWith: ["গরম পানি ও লেবু", "রুটি", "চা"] },
  },
  {
    slug: "ghee",
    name: "ঘরে বানানো গাওয়া ঘি",
    short: "দেশি গরুর দুধের মাখন থেকে",
    category: "honey-oil",
    art: "ghee",
    badge: "ঘরে তৈরি",
    variants: [
      { label: "২৫০ গ্রাম", price: 480 },
      { label: "৫০০ গ্রাম", price: 940 },
    ],
    defaultVariant: 0,
    summary: "দেশি গরুর দুধের মাখন জ্বাল দিয়ে নিজেদের রান্নাঘরে বানানো ঘি। দানাদার, সুগন্ধি, কোনো ভেজাল নেই।",
    origin: "নিজেদের রান্নাঘর, [জেলা]",
    facts: [
      { label: "উপাদান", value: "দেশি গরুর দুধের মাখন" },
      { label: "তৈরি", value: "নিজেদের রান্নাঘরে, ছোট ব্যাচে" },
      { label: "মেয়াদ", value: "তৈরির তারিখ থেকে ৬ মাস" },
      { label: "সংরক্ষণ", value: "শুকনো চামচ ব্যবহার করুন" },
    ],
    sections: [
      { q: "এই ঘি কীভাবে বানানো হয়?", a: "দুধ থেকে মাখন তুলে ধীরে জ্বাল দিয়ে ঘি বানাই। প্রতি ব্যাচ ছোট, তাই প্রতিটি বয়ামে তৈরির তারিখ লেখা থাকে।" },
    ],
    faq: [{ q: "ঘি কি জমে যায়?", a: "হ্যাঁ, শীতে দানা বেঁধে জমে যায়। এটা খাঁটি ঘির স্বাভাবিক বৈশিষ্ট্য।" }],
    related: ["mustard-oil", "sundarban-honey", "mango-pickle", "puffed-rice"],
    taste: { oneLine: "দানাদার, মাখনের মতো সুগন্ধ", levels: { sweet: 1, salty: 1 }, texture: "দানাদার, গরমে গলে যায়", aroma: "জ্বাল দেওয়া মাখনের ঘ্রাণ", bestWith: ["গরম ভাত", "খিচুড়ি", "পোলাও", "পরোটা"] },
  },
  {
    slug: "mango-pickle",
    name: "মায়ের হাতের আমের আচার",
    short: "সরিষার তেলে · ভিনেগার ছাড়া",
    category: "homemade",
    art: "pickle",
    badge: "ঘরে তৈরি",
    variants: [{ label: "৪০০ গ্রাম", price: 320 }],
    defaultVariant: 0,
    summary: "কাঁচা আম রোদে শুকিয়ে ঘানির সরিষার তেলে বানানো টক-ঝাল আচার। কোনো ভিনেগার বা প্রিজারভেটিভ নেই।",
    origin: "নিজেদের রান্নাঘর, [জেলা]",
    facts: [
      { label: "উপাদান", value: "কাঁচা আম, সরিষার তেল, মসলা, লবণ" },
      { label: "মেয়াদ", value: "তৈরির তারিখ থেকে ১ বছর" },
      { label: "সংরক্ষণ", value: "শুকনো চামচ, মাঝে মাঝে রোদে দিন" },
    ],
    sections: [{ q: "এই আচার কীভাবে বানানো হয়?", a: "আম কেটে কয়েক দিন রোদে শুকাই, তারপর ঘানির সরিষার তেল আর ঘরে গুঁড়া করা মসলায় মাখিয়ে বয়ামে ভরি।" }],
    faq: [{ q: "আচার কি খুব ঝাল?", a: "মাঝারি ঝাল। টক-ঝাল-মিষ্টি তিনটাই আছে।" }],
    related: ["olive-pickle", "mustard-oil", "puffed-rice", "ghee"],
    taste: { oneLine: "টক-ঝাল-মিষ্টি, তেলে ভেজানো", levels: { sour: 4, spicy: 3, sweet: 2, pungent: 3 }, texture: "নরম আমের টুকরো, তেলে ভেজা", aroma: "সরিষার তেল আর পাঁচফোড়ন", bestWith: ["খিচুড়ি", "ডাল-ভাত", "পরোটা"] },
  },
  {
    slug: "date-gur",
    name: "খেজুরের পাটালি গুড়",
    short: "যশোরের গাছি থেকে",
    category: "homemade",
    art: "gur",
    badge: "মৌসুমি",
    variants: [
      { label: "৫০০ গ্রাম", price: 280 },
      { label: "১ কেজি", price: 540 },
    ],
    defaultVariant: 1,
    summary: "শীতের ভোরে নামানো খেজুরের রস জ্বাল দিয়ে বানানো পাটালি। চিনি বা রং মেশানো নয়। শুধু শীতকালে পাওয়া যায়।",
    origin: "যশোর",
    facts: [
      { label: "উপাদান", value: "১০০% খেজুরের রস" },
      { label: "উৎস", value: "যশোর" },
      { label: "পাওয়া যায়", value: "ডিসেম্বর থেকে ফেব্রুয়ারি" },
      { label: "সংরক্ষণ", value: "বায়ুরোধী পাত্রে, ফ্রিজে রাখলে বেশি দিন ভালো থাকে" },
    ],
    sections: [{ q: "খাঁটি পাটালি চিনবেন কীভাবে?", a: "খাঁটি পাটালি ভাঙলে ভেতরটা নরম আর দানাদার, রং বাদামি। খুব শক্ত আর চকচকে হলে চিনি মেশানো হতে পারে।" }],
    faq: [{ q: "সারা বছর পাওয়া যাবে?", a: "না, শুধু শীতের মৌসুমে। মৌসুম শুরু হলে আমরা জানিয়ে দেব।" }],
    related: ["puffed-rice", "ghee", "sundarban-honey", "mustard-oil"],
    taste: { oneLine: "গভীর মিষ্টি, হালকা ধোঁয়াটে", levels: { sweet: 5 }, texture: "নরম, ভাঙলে ভেতরে দানাদার", aroma: "জ্বাল দেওয়া খেজুর রসের ঘ্রাণ", bestWith: ["মুড়ি", "পায়েস", "পিঠা", "রুটি"] },
  },
  {
    slug: "puffed-rice",
    name: "হাতে ভাজা লবণ মুড়ি",
    short: "ইউরিয়া ছাড়া, বালিতে ভাজা",
    category: "homemade",
    art: "muri",
    variants: [
      { label: "৫০০ গ্রাম", price: 120 },
      { label: "১ কেজি", price: 230 },
    ],
    defaultVariant: 0,
    summary: "দেশি ধানের চাল লবণ পানি মাখিয়ে মাটির পাত্রে বালিতে ভাজা মুড়ি। ইউরিয়া বা হাইড্রোজ ছাড়া।",
    origin: "[জেলা]",
    facts: [
      { label: "উপাদান", value: "দেশি চাল, লবণ" },
      { label: "মেয়াদ", value: "৩ মাস (মুখ বন্ধ রাখলে)" },
    ],
    sections: [{ q: "হাতে ভাজা মুড়ি আর কারখানার মুড়িতে পার্থক্য কী?", a: "হাতে ভাজা মুড়ি আকারে ছোট, রং হালকা বাদামি, স্বাদে একটু নোনতা। কারখানার সাদা বড় মুড়িতে অনেক সময় ইউরিয়া মেশানো হয়।" }],
    faq: [],
    related: ["date-gur", "mango-pickle", "mustard-oil", "ghee"],
    taste: { oneLine: "মচমচে, হালকা নোনতা", levels: { salty: 2 }, texture: "ছোট, শক্ত-মচমচে দানা", aroma: "ভাজা চালের ঘ্রাণ", bestWith: ["গুড়", "চানাচুর", "সরিষার তেল ও পেঁয়াজ"] },
  },
  {
    slug: "black-seed-honey",
    name: "কালোজিরা ফুলের মধু",
    short: "কাঁচা মধু",
    category: "honey-oil",
    art: "jar",
    variants: [
      { label: "২৫০ গ্রাম", price: 420 },
      { label: "৫০০ গ্রাম", price: 800 },
    ],
    defaultVariant: 0,
    summary: "কালোজিরা ফুলের মৌসুমে সংগ্রহ করা কাঁচা মধু। রং গাঢ়, স্বাদে হালকা তিতকুটে।",
    origin: "[জেলা]",
    facts: [
      { label: "উপাদান", value: "১০০% কাঁচা মধু" },
      { label: "সংরক্ষণ", value: "স্বাভাবিক তাপমাত্রায়" },
    ],
    sections: [{ q: "কালোজিরা মধুর স্বাদ কেমন?", a: "সাধারণ ফুলের মধুর চেয়ে গাঢ় আর হালকা তিতকুটে। ঘ্রাণে কালোজিরার আভাস থাকে।" }],
    faq: [],
    related: ["sundarban-honey", "ghee", "mustard-oil", "date-gur"],
    taste: { oneLine: "গাঢ়, মিষ্টির সাথে হালকা তিতকুটে", levels: { sweet: 4, bitter: 2 }, texture: "ঘন, ধীরে গড়ায়", aroma: "কালোজিরার আভাস", bestWith: ["গরম পানি", "রুটি", "চা"] },
  },
  {
    slug: "olive-pickle",
    name: "জলপাইয়ের টক-ঝাল আচার",
    short: "ছোট ব্যাচে তৈরি",
    category: "homemade",
    art: "pickle",
    variants: [{ label: "৩০০ গ্রাম", price: 260 }],
    defaultVariant: 0,
    summary: "শীতের জলপাই দিয়ে সরিষার তেলে বানানো টক-ঝাল আচার। ছোট ব্যাচে, প্রিজারভেটিভ ছাড়া।",
    origin: "নিজেদের রান্নাঘর, [জেলা]",
    facts: [
      { label: "উপাদান", value: "জলপাই, সরিষার তেল, মসলা, গুড়" },
      { label: "মেয়াদ", value: "তৈরির তারিখ থেকে ৬ মাস" },
    ],
    sections: [{ q: "এই আচার কী দিয়ে খাওয়া যায়?", a: "ভাত, খিচুড়ি, পরোটা বা মুড়ির সাথে।" }],
    faq: [],
    related: ["mango-pickle", "puffed-rice", "mustard-oil", "ghee"],
    taste: { oneLine: "জোরালো টক, মাঝারি ঝাল", levels: { sour: 5, spicy: 3, sweet: 1 }, texture: "আস্ত জলপাই, ভেতরে নরম", aroma: "সরিষার তেল আর মসলা", bestWith: ["ভাত", "খিচুড়ি", "মুড়ি"] },
  },

  {
    slug: "bhetki",
    name: "লোনা পানির ভেটকি",
    short: "আস্ত বা ফিলে · বরফে প্যাক",
    category: "fish",
    art: "fish",
    badge: "শুধু ঢাকায়",
    variants: [
      { label: "আস্ত, ১–১.৫ কেজি (প্রতি কেজি)", price: 950 },
      { label: "আস্ত, ২–৩ কেজি (প্রতি কেজি)", price: 1100 },
      { label: "কাঁটাছাড়া ফিলে, ৫০০ গ্রাম", price: 780 },
    ],
    defaultVariant: 0,
    summary: "খুলনা অঞ্চলের লোনা পানির ভেটকি, ঘের থেকে সরাসরি এনে বরফে প্যাক করা। আস্ত নিতে পারেন বা কাঁটাছাড়া ফিলে।",
    origin: "[সাতক্ষীরা / খুলনা], ঘের",
    facts: [
      { label: "উৎস", value: "[সাতক্ষীরা / খুলনা]-র ঘের" },
      { label: "দাম", value: "আস্ত মাছ প্রতি কেজি হিসেবে, ফিলে প্যাকেট হিসেবে" },
      { label: "কাটার পর ওজন", value: "আস্ত ওজনের প্রায় ৭০–৭৫% (মাথা-কাঁটা বাদে)" },
      { label: "প্যাকিং", value: "ফুড গ্রেড ব্যাগ, বরফসহ ইনসুলেটেড বাক্স" },
      { label: "সংরক্ষণ", value: "হাতে পেয়েই ফ্রিজে রাখুন, ডিপ ফ্রিজে ৩ মাস" },
    ],
    sections: [
      { q: "ভেটকি মাছ কেমন?", a: "ভেটকি লোনা ও আধা-লোনা পানির বড় মাছ। মাংস সাদা, পুরু আর কাঁটা কম, তাই ফিলে, ফ্রাই আর পাতুরিতে বেশি চলে।" },
      { q: "মাছ কতক্ষণে পৌঁছায়?", a: "ঢাকার ভেতরে একই দিনে বা পরের দিন সকালে, বরফসহ বাক্সে।" },
    ],
    faq: [{ q: "মাছ নরম বা নষ্ট পেলে?", a: "ডেলিভারির সময়ই খুলে দেখুন। সমস্যা থাকলে নেবেন না, অথবা ২ ঘণ্টার মধ্যে ছবি পাঠালে টাকা ফেরত দেব।" }],
    related: ["bagda-prawn", "parshe", "chui-jhal"],
    taste: { oneLine: "মাখনের মতো নরম, হালকা মিষ্টি", levels: { sweet: 2, salty: 1 }, texture: "সাদা, পুরু, কাঁটা কম", aroma: "হালকা, আঁশটে গন্ধ কম", bestWith: ["ফিশ ফ্রাই", "ভেটকি পাতুরি", "সরিষা ভেটকি"] },
  },
  {
    slug: "parshe",
    name: "পার্সে মাছ",
    short: "ছোট লোনা পানির মাছ · ঝোলে সেরা",
    category: "fish",
    art: "fish",
    badge: "শুধু ঢাকায়",
    variants: [
      { label: "৫০০ গ্রাম", price: 420 },
      { label: "১ কেজি", price: 800 },
    ],
    defaultVariant: 1,
    summary: "খুলনা-সাতক্ষীরার লোনা পানির পার্সে মাছ, প্রতি কেজিতে প্রায় [১০–১৫]টি। আস্ত, পরিষ্কার করে বরফে প্যাক করা।",
    origin: "[খুলনা / সাতক্ষীরা]",
    facts: [
      { label: "উৎস", value: "[খুলনা / সাতক্ষীরা]" },
      { label: "আকার", value: "প্রতি কেজিতে প্রায় [১০–১৫]টি" },
      { label: "প্যাকিং", value: "বরফসহ ইনসুলেটেড বাক্স" },
    ],
    sections: [{ q: "পার্সে মাছ কীভাবে রান্না করা হয়?", a: "পার্সে সাধারণত হালকা ঝোল, সরিষা বাটা বা ভাজা করে খাওয়া হয়। মাছ ছোট, তাই আস্ত রান্না করা যায়।" }],
    faq: [],
    related: ["bhetki", "bagda-prawn", "mustard-oil"],
    taste: { oneLine: "হালকা মিষ্টি, তেলতেলে", levels: { sweet: 3, salty: 1 }, texture: "নরম মাংস, মাঝারি কাঁটা", aroma: "লোনা পানির মাছের হালকা ঘ্রাণ", bestWith: ["পাতলা ঝোল", "সরিষা পার্সে", "ভাজা"] },
  },
  {
    slug: "bagda-prawn",
    name: "ঘেরের বাগদা চিংড়ি",
    short: "লোনা পানির · মাথাসহ",
    category: "fish",
    art: "prawn",
    badge: "শুধু ঢাকায়",
    variants: [
      { label: "৫০০ গ্রাম", price: 600 },
      { label: "১ কেজি", price: 1150 },
    ],
    defaultVariant: 1,
    summary: "সাতক্ষীরা-খুলনার লোনা পানির ঘেরের বাগদা চিংড়ি, প্রতি কেজিতে প্রায় [২০–২৫]টি। মাথাসহ, বরফে প্যাক করা।",
    origin: "[সাতক্ষীরা], ঘের",
    facts: [
      { label: "উৎস", value: "[সাতক্ষীরা]-র লোনা পানির ঘের" },
      { label: "আকার", value: "প্রতি কেজিতে প্রায় [২০–২৫]টি" },
      { label: "প্যাকিং", value: "বরফসহ ইনসুলেটেড বাক্স" },
    ],
    sections: [{ q: "বাগদা আর গলদা চিংড়ির পার্থক্য কী?", a: "বাগদার গায়ে কালচে ডোরা দাগ থাকে আর মাংস একটু শক্ত। গলদার মাথা বড়, নীলচে লম্বা দাঁড়া থাকে, মাংস নরম ও মিষ্টি।" }],
    faq: [],
    related: ["golda-prawn", "bhetki", "chui-jhal"],
    taste: { oneLine: "মিষ্টি, দৃঢ় মাংস", levels: { sweet: 3, salty: 2 }, texture: "দৃঢ়, কামড়ে একটু শক্ত", aroma: "হালকা সামুদ্রিক ঘ্রাণ", bestWith: ["চিংড়ি ভুনা", "চিংড়ি ভাজা", "নারকেল চিংড়ি"] },
  },
  {
    slug: "patari",
    name: "পাতাড়ি মাছ",
    short: "খুলনা অঞ্চলের লোনা পানির মাছ",
    category: "fish",
    art: "fish",
    badge: "শুধু ঢাকায়",
    variants: [{ label: "১ কেজি", price: 700 }],
    defaultVariant: 0,
    // TODO: owner to describe this fish (size, how it is cooked, taste).
    summary: "খুলনা অঞ্চলের লোনা পানির পাতাড়ি মাছ, সরাসরি জেলের কাছ থেকে এনে বরফে প্যাক করা। [মাছের আকার ও রান্নার ধরন লিখুন]",
    origin: "[খুলনা / সাতক্ষীরা]",
    facts: [
      { label: "উৎস", value: "[খুলনা / সাতক্ষীরা]" },
      { label: "আকার", value: "[প্রতি কেজিতে কয়টি]" },
      { label: "প্যাকিং", value: "বরফসহ ইনসুলেটেড বাক্স" },
    ],
    sections: [{ q: "পাতাড়ি মাছ কীভাবে রান্না করা হয়?", a: "[আপনার এলাকার প্রচলিত রান্নার কথা লিখুন]" }],
    faq: [],
    related: ["salut", "parshe", "bhetki"],
  },
  {
    slug: "salut",
    name: "সালুট মাছ",
    short: "খুলনা অঞ্চলের লোনা পানির মাছ",
    category: "fish",
    art: "fish",
    badge: "শুধু ঢাকায়",
    variants: [{ label: "১ কেজি", price: 650 }],
    defaultVariant: 0,
    // TODO: owner to describe this fish (size, how it is cooked, taste).
    summary: "খুলনা অঞ্চলের লোনা পানির সালুট মাছ, সরাসরি জেলের কাছ থেকে এনে বরফে প্যাক করা। [মাছের আকার ও রান্নার ধরন লিখুন]",
    origin: "[খুলনা / সাতক্ষীরা]",
    facts: [
      { label: "উৎস", value: "[খুলনা / সাতক্ষীরা]" },
      { label: "আকার", value: "[প্রতি কেজিতে কয়টি]" },
      { label: "প্যাকিং", value: "বরফসহ ইনসুলেটেড বাক্স" },
    ],
    sections: [{ q: "সালুট মাছ কীভাবে রান্না করা হয়?", a: "[আপনার এলাকার প্রচলিত রান্নার কথা লিখুন]" }],
    faq: [],
    related: ["patari", "parshe", "bagda-prawn"],
  },
  {
    slug: "golda-prawn",
    name: "ঘেরের গলদা চিংড়ি",
    short: "বাগেরহাটের ঘের থেকে",
    category: "fish",
    art: "prawn",
    badge: "শুধু ঢাকায়",
    variants: [
      { label: "৫০০ গ্রাম", price: 650 },
      { label: "১ কেজি", price: 1250 },
    ],
    defaultVariant: 1,
    summary: "বাগেরহাটের ঘের থেকে আনা গলদা চিংড়ি, প্রতি কেজিতে ১৫–২০টি। বরফে প্যাক করে শুধু ঢাকার ভেতরে পাঠানো হয়।",
    origin: "বাগেরহাট",
    facts: [
      { label: "উৎস", value: "বাগেরহাটের ঘের" },
      { label: "আকার", value: "প্রতি কেজিতে ১৫–২০টি" },
      { label: "প্যাকিং", value: "বরফসহ ইনসুলেটেড বাক্স" },
    ],
    sections: [{ q: "গলদা আর বাগদা চিংড়ির পার্থক্য কী?", a: "গলদার মাথা বড়, নীলচে লম্বা দাঁড়া থাকে, মাংস নরম ও মিষ্টি। বাগদার গায়ে কালচে ডোরা দাগ থাকে আর মাংস একটু শক্ত।" }],
    faq: [],
    related: ["bagda-prawn", "bhetki", "chui-jhal"],
    taste: { oneLine: "মিষ্টি, রসালো মাংস", levels: { sweet: 3 }, texture: "দৃঢ় অথচ রসালো মাংস, মাথায় ঘিলু", aroma: "হালকা সামুদ্রিক ঘ্রাণ", bestWith: ["মালাইকারি", "চিংড়ি ভুনা", "দোপেঁয়াজা"] },
  },
  {
    slug: "chui-jhal",
    name: "খুলনার তাজা চুইঝাল",
    short: "চাষির কাছ থেকে সরাসরি",
    category: "spices",
    art: "stem",
    badge: "খুলনার বিশেষ",
    variants: [
      { label: "২৫০ গ্রাম", price: 220 },
      { label: "৫০০ গ্রাম", price: 420 },
      { label: "১ কেজি", price: 800, compareAt: 840 },
    ],
    defaultVariant: 1,
    summary: "খুলনার চাষির কাছ থেকে আনা তাজা চুইঝালের কাণ্ড। মাংস বা মাছে দিলে ঝাল আর ঝাঁঝালো ঘ্রাণ আসে। ফ্রিজে ১ মাস ভালো থাকে।",
    origin: "খুলনা",
    facts: [
      { label: "উৎস", value: "খুলনা" },
      { label: "অংশ", value: "কাণ্ড, খোসাসহ" },
      { label: "সংরক্ষণ", value: "কাগজে মুড়ে ফ্রিজে রাখুন, ১ মাস" },
    ],
    sections: [
      { q: "চুইঝাল কী?", a: "চুইঝাল একটি লতানো গাছের কাণ্ড, খুলনা-যশোর অঞ্চলে রান্নায় ব্যবহার হয়। মরিচের মতো ঝাল, তবে ঝাঁঝ আর ঘ্রাণ আলাদা।" },
      { q: "কতটুকু চুইঝাল দেব?", a: "১ কেজি মাংসে ১০০–১৫০ গ্রাম চুইঝাল যথেষ্ট। বেশি ঝাল চাইলে বাড়াতে পারেন।" },
    ],
    faq: [],
    related: ["bhetki", "golda-prawn", "mustard-oil"],
    taste: { oneLine: "ঝাল আর ঝাঁঝালো, কাঠের মতো ঘ্রাণ", levels: { spicy: 4, pungent: 4, bitter: 1 }, texture: "রান্নার পর নরম, চিবিয়ে রস বের হয়", aroma: "ঝাঁঝালো, কাঠ আর মরিচের মিশ্র ঘ্রাণ", bestWith: ["গরুর মাংস", "খাসির মাংস", "হাঁস"] },
  },


];

/**
 * Pictures for the gallery. Until the owner adds real photos, each product
 * gets the four shots a buyer needs, with captions saying what to photograph.
 */
export function imagesFor(p: Product): ProductImage[] {
  if (p.images && p.images.length > 0) return p.images;
  return [
    { alt: p.name, caption: "পুরো পণ্য", art: p.art },
    { alt: `${p.name}, কাছ থেকে`, caption: "কাছ থেকে", art: p.art, closeUp: true },
    { alt: `${p.name}, আকার বোঝাতে হাতে নিয়ে`, caption: "আকার" },
    { alt: `${p.name}, প্যাকিং`, caption: "প্যাকিং" },
  ];
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getCategory(id: CategoryId): CategoryInfo {
  return categories.find((c) => c.id === id)!;
}

export function categoryLabel(id: CategoryId): string {
  return getCategory(id).label;
}

export function productsIn(id: CategoryId): Product[] {
  return products.filter((p) => p.category === id);
}

/** Lightweight card data that is safe to pass to client components. */
export type CardProduct = Pick<Product, "slug" | "name" | "short" | "category" | "art" | "badge" | "variants" | "defaultVariant"> & { tasteLine?: string; image?: string };

export function toCard(p: Product): CardProduct {
  const { slug, name, short, category, art, badge, variants, defaultVariant } = p;
  return { slug, name, short, category, art, badge, variants, defaultVariant, tasteLine: p.taste?.oneLine, image: p.images?.[0]?.src };
}
