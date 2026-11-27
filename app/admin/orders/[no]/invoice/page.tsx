import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PrintButton } from "@/components/admin/print-button";
import { requirePermission } from "@/lib/admin";
import { select } from "@/lib/db";
import { getOrder, paymentMethodLabel, paymentStatusLabel } from "@/lib/orders";
import { bn, phoneDisplay, site, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "ইনভয়েস" };

// Printable invoice (with prices) and packing slip (without prices) for one order.
// Print CSS in globals.css hides the site and admin chrome and puts each on its own page.
export default function InvoicePage({ params }: PageProps<"/admin/orders/[no]/invoice">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Invoice params={params} />
    </Suspense>
  );
}

async function Invoice({ params }: { params: PageProps<"/admin/orders/[no]/invoice">["params"] }) {
  await connection();
  await requirePermission("orders.view");
  const { no } = await params;
  const o = await getOrder(decodeURIComponent(no));
  if (!o) notFound();
  const items = await select<{ product_name: string; variant_label: string; unit_price: number; qty: number }>(
    "SELECT product_name, variant_label, unit_price, qty FROM order_items WHERE order_id = ? ORDER BY id",
    [o.id],
  );
  const due = o.payment_status === "paid" ? 0 : o.total - (o.paid_amount ?? 0);

  const head = (title: string) => (
    <header className="inv-head">
      <div>
        <b className="inv-brand">{site.name}</b>
        <small>{site.slogan}</small>
        <small className="num">{phoneDisplay} · {site.url.replace("https://", "")}</small>
      </div>
      <div className="inv-meta">
        <b>{title}</b>
        <span className="num">{o.order_no}</span>
        <small>{dhakaDateTime(o.created_at)}</small>
      </div>
    </header>
  );
  const to = (
    <section className="inv-to">
      <b>প্রাপক</b>
      <p>{o.name} · <span className="num">{o.phone}</span></p>
      <p>{o.address}</p>
      {o.tracking_no && <p className="num">{o.courier ?? "কুরিয়ার"}: {o.tracking_no}</p>}
    </section>
  );

  return (
    <div className="invoice-wrap">
      <div className="no-print inv-tools">
        <PrintButton />
        <p className="hint">প্রিন্টে প্রথম পাতা ক্রেতার ইনভয়েস, দ্বিতীয় পাতা পার্সেলে লাগানোর প্যাকিং স্লিপ।</p>
      </div>

      <article className="inv-page" aria-label="ইনভয়েস">
        {head("ইনভয়েস")}
        {to}
        <table className="inv-table">
          <thead><tr><th>পণ্য</th><th>সাইজ</th><th className="r">দাম</th><th className="r">সংখ্যা</th><th className="r">মোট</th></tr></thead>
          <tbody>
            {items.map((i, k) => (
              <tr key={k}><td>{i.product_name}</td><td>{i.variant_label}</td><td className="r num">{taka(i.unit_price)}</td><td className="r num">{bn(i.qty)}</td><td className="r num">{taka(i.unit_price * i.qty)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={4}>পণ্যের দাম</td><td className="r num">{taka(o.subtotal)}</td></tr>
            <tr><td colSpan={4}>ডেলিভারি চার্জ</td><td className="r num">{taka(o.delivery_fee)}</td></tr>
            <tr className="grand"><td colSpan={4}>মোট</td><td className="r num">{taka(o.total)}</td></tr>
            <tr><td colSpan={4}>পেমেন্ট: {paymentMethodLabel[o.payment_method]} · {paymentStatusLabel[o.payment_status]}</td><td className="r num">{due > 0 ? `বাকি ${taka(due)}` : "পরিশোধিত"}</td></tr>
          </tfoot>
        </table>
        <p className="inv-thanks">মুসুফি থেকে কেনার জন্য ধন্যবাদ। পণ্যে সমস্যা থাকলে ২৪ ঘণ্টার মধ্যে <span className="num">{phoneDisplay}</span> নম্বরে জানান।</p>
      </article>

      <article className="inv-page" aria-label="প্যাকিং স্লিপ">
        {head("প্যাকিং স্লিপ")}
        {to}
        <table className="inv-table">
          <thead><tr><th>পণ্য</th><th>সাইজ</th><th className="r">সংখ্যা</th><th className="r">✓</th></tr></thead>
          <tbody>
            {items.map((i, k) => <tr key={k}><td>{i.product_name}</td><td>{i.variant_label}</td><td className="r num">{bn(i.qty)}</td><td className="r">☐</td></tr>)}
          </tbody>
        </table>
        <p className="inv-cod"><b>ক্রেতার কাছ থেকে নিতে হবে: <span className="num">{due > 0 ? taka(due) : "৳০ (পরিশোধিত)"}</span></b></p>
      </article>
    </div>
  );
}
