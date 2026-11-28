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
  <h1 style="font-size:20px;margin:0 0 4px;color:#097f00">নতুন অর্ডার ${esc(o.orderNo)}</h1>
  <p style="margin:0 0 16px;color:#55665b">ক্রেতাকে ফোন করে অর্ডার নিশ্চিত করুন।</p>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #dce5dd">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><th style="text-align:left;padding:10px 12px;border-bottom:1px solid #dce5dd;background:#e7f0e9;width:40%;font-weight:600">${esc(k)}</th><td style="padding:10px 12px;border-bottom:1px solid #dce5dd">${esc(v)}</td></tr>`,
      )
      .join("")}
  </table>
  <p style="margin:20px 0 0"><a href="tel:${esc(o.phone)}" style="display:inline-block;background:#097f00;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">ক্রেতাকে কল করুন ${esc(o.phone)}</a></p>
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
  <p style="margin:0 0 16px;font-weight:700;font-size:18px;color:#097f00">${esc(site.name)}</p>
  <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
  ${body}
  <p style="margin:28px 0 0;font-size:12px;color:#55665b">${esc(site.slogan)}<br>${esc(site.url)}</p>
</div></body></html>`;
}

/**
 * Emails a 6-digit login code.
 * Subject and first line are in plain English ("Use code 123456 to log in to
 * Musufi", "Your Musufi login code is 123456") because Gmail recognises codes
 * written that way and then shows its own "Copy code" button above the email.
 * (An email itself can't run a copy button; that card is Gmail's feature.)
 */
export async function sendLoginCode(to: string, code: string): Promise<void> {
  const digits = code
    .split("")
    .map((d) => `<td style="width:44px;height:52px;background:#fff;border:1px solid #dce5dd;border-radius:8px;text-align:center;font:700 28px/52px 'Courier New',monospace;color:#1a2820">${esc(d)}</td>`)
    .join('<td style="width:8px"></td>');
  await getTransport().sendMail({
    from: { name: "Musufi", address: env("SMTP_USER") },
    to,
    subject: `Use code ${code} to log in to Musufi`,
    text:
      `Your Musufi login code is ${code}\n\n` +
      `আপনার মুসুফি লগইন কোড: ${code}\nকোডটি ১০ মিনিট পর্যন্ত কাজ করবে। আপনি কোড না চাইলে এই ইমেইল উপেক্ষা করুন। কাউকে এই কোড বলবেন না।`,
    html: shell(
      `Your Musufi login code is ${code}`,
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:separate"><tr>${digits}</tr></table>
       <p style="margin:0 0 12px;color:#55665b">ওয়েবসাইটে এই কোডটি লিখুন। কোডটি ১০ মিনিট পর্যন্ত কাজ করবে।</p>
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

/** Tells the customer their parcel is on the way, with the courier tracking number. */
export async function sendShippedEmail(to: string, o: { orderNo: string; name: string; courier: string | null; trackingNo: string; total: number }): Promise<void> {
  const courier = o.courier || "কুরিয়ার";
  await getTransport().sendMail({
    from: { name: site.name, address: env("SMTP_USER") },
    to,
    subject: `আপনার অর্ডার ${o.orderNo} পাঠানো হয়েছে`,
    text: `${o.name}, আপনার অর্ডার ${o.orderNo} ${courier}-এ পাঠানো হয়েছে।\nট্র্যাকিং নম্বর: ${o.trackingNo}\nহাতে পেয়ে দেবেন: ${taka(o.total)}`,
    html: shell(
      "আপনার অর্ডার পথে আছে",
      `<p style="margin:0 0 12px;color:#55665b">${esc(o.name)}, অর্ডার ${esc(o.orderNo)} ${esc(courier)}-এ পাঠানো হয়েছে।</p>
       <p style="margin:0 0 12px;font-size:18px"><b>ট্র্যাকিং নম্বর: ${esc(o.trackingNo)}</b></p>
       <p style="margin:0;color:#55665b">হাতে পেয়ে দেবেন: ${esc(taka(o.total))}। ডেলিভারির সময় পণ্য দেখে নিন।</p>`,
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
