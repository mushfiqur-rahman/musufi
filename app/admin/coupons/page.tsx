import { connection } from "next/server";
import { Suspense } from "react";
import { CouponForm } from "@/components/admin/coupon-form";
import { requirePermission } from "@/lib/admin";
import { couponStats, couponTypeLabel, listCoupons, type Coupon } from "@/lib/coupons";
import { bn, taka } from "@/lib/site";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "কুপন" };

function summary(c: Coupon): string {
  const what = c.type === "percent" ? `${bn(c.value)}% ছাড়${c.max_discount ? ` (সর্বোচ্চ ${taka(c.max_discount)})` : ""}` : c.type === "fixed" ? `${taka(c.value)} ছাড়` : "ফ্রি ডেলিভারি";
  return `${what}${c.min_subtotal ? ` · ${taka(c.min_subtotal)}+ কেনাকাটায়` : ""}`;
}

export default function CouponsPage() {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Coupons />
    </Suspense>
  );
}

async function Coupons() {
  await connection();
  await requirePermission("marketing.manage");
  const [list, stats] = await Promise.all([listCoupons(), couponStats()]);
  return (
    <>
      <div className="admin-head">
        <h1>কুপন</h1>
        <p className="lead">ক্রেতা অর্ডার ফর্মে কোড দিলে ছাড় পান। একই কোড দোকানের সার্ভারে আবার যাচাই হয়, তাই সীমার বেশি ব্যবহার হয় না।</p>
      </div>
      {list.map((c) => {
        const s = stats.get(c.code);
        return (
          <details key={c.id} className="panel cat-edit">
            <summary>
              <b className="num">{c.code}</b>
              <span className={`pill ${c.active ? "ps-published" : "ps-hidden"}`}>{c.active ? "চালু" : "বন্ধ"}</span>
              <small>{couponTypeLabel[c.type]} · {summary(c)} · {bn(c.used_count)}{c.usage_limit ? `/${bn(c.usage_limit)}` : ""} বার ব্যবহার{s ? ` · মোট ছাড় ${taka(s.discount)}` : ""}{c.ends_at ? ` · শেষ ${dhakaDateTime(c.ends_at)}` : ""}</small>
            </summary>
            <CouponForm coupon={c} />
          </details>
        );
      })}
      <details className="panel cat-edit" open={list.length === 0}>
        <summary><b>+ নতুন কুপন</b></summary>
        <CouponForm coupon={null} />
      </details>
    </>
  );
}
