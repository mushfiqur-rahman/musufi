// Order alert emails through Hostinger SMTP.
// Server-only: imported by route handlers, never by client components.
import nodemailer, { type Transporter } from "nodemailer";
import { bn, site, taka } from "./site";

export type OrderAlert = {
  orderNo: string;
  productName: string;
  variantLabel: string;
  unitPrice: number;
  qty: number;
  zoneLabel: string;
  deliveryFee: number;
  total: number;
  name: string;
  phone: string;
  address: string;
  placedAt: Date;
};

const env = (key: string) => process.env[key]?.trim() ?? "";

// Hostinger's mail server. Only needs overriding for a different provider.
const DEFAULT_SMTP_HOST = "smtp.hostinger.com";
const DEFAULT_SMTP_PORT = 465;

/**
 * True when the three settings the owner must choose are present:
 * SMTP_USER, SMTP_PASSWORD and ORDER_ALERT_EMAIL. Host and port have defaults.
 */
export function mailConfigured(): boolean {
  return Boolean(env("SMTP_USER") && env("SMTP_PASSWORD") && env("ORDER_ALERT_EMAIL"));
}

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (transporter) return transporter;
  const port = Number(env("SMTP_PORT")) || DEFAULT_SMTP_PORT;
  transporter = nodemailer.createTransport({
    host: env("SMTP_HOST") || DEFAULT_SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL/TLS (Hostinger default); 587 = STARTTLS
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function dhakaTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** Sends the new-order email to the owner. Throws if the SMTP server refuses it. */
export async function sendOrderAlert(o: OrderAlert): Promise<void> {
  const rows: [string, string][] = [
    ["অর্ডার নম্বর", o.orderNo],
    ["সময়", dhakaTime(o.placedAt) + " (ঢাকা)"],
    ["পণ্য", `${o.productName} · ${o.variantLabel}`],
    ["দাম × সংখ্যা", `${taka(o.unitPrice)} × ${bn(o.qty)} = ${taka(o.unitPrice * o.qty)}`],
    ["ডেলিভারি", `${o.zoneLabel} · ${taka(o.deliveryFee)}`],
    ["মোট (ক্যাশ অন ডেলিভারি)", taka(o.total)],
    ["ক্রেতার নাম", o.name],
    ["মোবাইল", o.phone],
    ["ঠিকানা", o.address],
  ];

  const text =
    `নতুন অর্ডার এসেছে।\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n\nক্রেতাকে ফোন করে অর্ডার নিশ্চিত করুন: ${o.phone}`;

  const html = `<!doctype html><html lang="bn"><body style="margin:0;background:#f5f8f4;font-family:Arial,'Hind Siliguri',sans-serif;color:#1a2820">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <h1 style="font-size:20px;margin:0 0 4px;color:#23613f">নতুন অর্ডার ${esc(o.orderNo)}</h1>
  <p style="margin:0 0 16px;color:#55665b">ক্রেতাকে ফোন করে অর্ডার নিশ্চিত করুন।</p>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #dce5dd">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><th style="text-align:left;padding:10px 12px;border-bottom:1px solid #dce5dd;background:#e7f0e9;width:40%;font-weight:600">${esc(k)}</th><td style="padding:10px 12px;border-bottom:1px solid #dce5dd">${esc(v)}</td></tr>`,
      )
      .join("")}
  </table>
  <p style="margin:20px 0 0"><a href="tel:${esc(o.phone)}" style="display:inline-block;background:#23613f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">ক্রেতাকে কল করুন ${esc(o.phone)}</a></p>
  <p style="margin:24px 0 0;font-size:12px;color:#55665b">${esc(site.nameLatin)} · ${esc(site.url)}</p>
</div></body></html>`;

  await getTransport().sendMail({
    from: { name: `${site.name} অর্ডার`, address: env("SMTP_USER") },
    to: env("ORDER_ALERT_EMAIL"),
    subject: `নতুন অর্ডার ${o.orderNo} · ${o.name} · ${taka(o.total)}`,
    text,
    html,
  });
}

/** True when login codes and customer emails can be sent (alert address not needed). */
export function smtpReady(): boolean {
  return Boolean(env("SMTP_USER") && env("SMTP_PASSWORD"));
}

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="bn"><body style="margin:0;background:#f5f8f4;font-family:Arial,'Hind Siliguri',sans-serif;color:#1a2820">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <p style="margin:0 0 16px;font-weight:700;font-size:18px;color:#23613f">${esc(site.name)}</p>
  <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
  ${body}
  <p style="margin:28px 0 0;font-size:12px;color:#55665b">${esc(site.slogan)}<br>${esc(site.url)}</p>
</div></body></html>`;
}

/** Emails a 6-digit login code. */
export async function sendLoginCode(to: string, code: string): Promise<void> {
  const spaced = code.split("").join(" ");
  await getTransport().sendMail({
    from: { name: site.name, address: env("SMTP_USER") },
    to,
    subject: `${site.name} লগইন কোড: ${code}`,
    text: `আপনার ${site.name} লগইন কোড: ${code}\n\nকোডটি ১০ মিনিট পর্যন্ত কাজ করবে। আপনি না চাইলে এই ইমেইল উপেক্ষা করুন।`,
    html: shell(
      "আপনার লগইন কোড",
      `<p style="margin:0 0 12px;color:#55665b">ওয়েবসাইটে এই কোডটি লিখুন। কোডটি ১০ মিনিট পর্যন্ত কাজ করবে।</p>
       <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;background:#fff;border:1px solid #dce5dd;border-radius:10px;padding:14px 18px;text-align:center">${esc(spaced)}</p>
       <p style="margin:0;color:#55665b;font-size:13px">আপনি কোড না চাইলে এই ইমেইল উপেক্ষা করুন। কাউকে এই কোড বলবেন না।</p>`,
    ),
  });
}

/** Tells the customer their order was received. */
export async function sendOrderConfirmation(to: string, o: OrderAlert): Promise<void> {
  const rows: [string, string][] = [
    ["অর্ডার নম্বর", o.orderNo],
    ["পণ্য", `${o.productName} · ${o.variantLabel} × ${bn(o.qty)}`],
    ["ডেলিভারি", `${o.zoneLabel} · ${taka(o.deliveryFee)}`],
    ["মোট (হাতে পেয়ে দেবেন)", taka(o.total)],
    ["ঠিকানা", o.address],
  ];
  await getTransport().sendMail({
    from: { name: site.name, address: env("SMTP_USER") },
    to,
    subject: `অর্ডার পাওয়া গেছে: ${o.orderNo}`,
    text: `ধন্যবাদ, ${o.name}। আপনার অর্ডার পাওয়া গেছে।\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nআমরা ${o.phone} নম্বরে ফোন করে অর্ডার নিশ্চিত করব।`,
    html: shell(
      `ধন্যবাদ, ${o.name}। অর্ডার পাওয়া গেছে।`,
      `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #dce5dd">${rows
        .map(([k, v]) => `<tr><th style="text-align:left;padding:10px 12px;border-bottom:1px solid #dce5dd;background:#e7f0e9;width:40%">${esc(k)}</th><td style="padding:10px 12px;border-bottom:1px solid #dce5dd">${esc(v)}</td></tr>`)
        .join("")}</table>
       <p style="margin:16px 0 0;color:#55665b">আমরা ${esc(o.phone)} নম্বরে ফোন করে অর্ডার নিশ্চিত করব। অর্ডারের অবস্থা দেখতে: ${esc(site.url)}/account</p>`,
    ),
  });
}

/** Human-friendly order number, e.g. MS-261127-4F7K (date in Dhaka time). */
export function newOrderNo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `MS-${get("year")}${get("month")}${get("day")}-${code}`;
}
