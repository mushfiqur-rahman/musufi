import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { saveAnnouncementAction } from "@/app/admin/actions/marketing";
import { PageForm } from "@/components/admin/page-form";
import { requirePermission } from "@/lib/admin";
import { getAnnouncement, listPagesAdmin } from "@/lib/content";
import { dhakaDateTime } from "@/lib/time";

export const metadata = { title: "পেজ ও ঘোষণা" };

/** Starter pages a shop needs; offered until each slug exists. Owner fills in the details. */
const STARTERS = [
  { slug: "about", title: "আমাদের সম্পর্কে", body: "## মুসুফি কারা\n\n[আপনার গল্প লিখুন: কবে, কেন শুরু করলেন, কে চালান।]\n\n## পণ্য কীভাবে বাছাই করি\n\n- উৎস নিজে দেখে আনি\n- মান পরীক্ষা করি\n- যত্নে প্যাক করি" },
  { slug: "return-policy", title: "ফেরত ও বদল নীতি", body: "## কখন ফেরত বা বদল করা যায়\n\n- পণ্য ভাঙা, নষ্ট বা ভুল এলে\n- ডেলিভারির [২৪] ঘণ্টার মধ্যে ছবিসহ জানালে\n\n## কীভাবে জানাবেন\n\nহোয়াটসঅ্যাপে অর্ডার নম্বর ও ছবি পাঠান। আমরা বদলে দেব বা টাকা ফেরত দেব।\n\n## মাছের ক্ষেত্রে\n\nডেলিভারির সময়ই খুলে দেখুন। সমস্যা থাকলে নেবেন না।" },
  { slug: "privacy", title: "গোপনীয়তা নীতি", body: "## আমরা কী তথ্য রাখি\n\n- নাম, ফোন, ঠিকানা ও ইমেইল: অর্ডার পৌঁছে দিতে\n- অর্ডারের ইতিহাস\n\n## আমরা কী করি না\n\n- আপনার তথ্য বিক্রি করি না\n- কুরিয়ারকে শুধু ডেলিভারির জন্য দরকারি তথ্য দিই\n\n## যোগাযোগ\n\nতথ্য মুছতে চাইলে আমাদের জানান।" },
  { slug: "terms", title: "শর্তাবলি", body: "## অর্ডার\n\nঅর্ডার ফোনে নিশ্চিত করার পর পাঠানো হয়।\n\n## দাম\n\nদাম ও ডেলিভারি চার্জ অর্ডারের সময় যা দেখানো হয় তা-ই প্রযোজ্য।\n\n## [আরও শর্ত লিখুন]" },
];

export default function PagesAdmin({ searchParams }: PageProps<"/admin/pages">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Pages searchParams={searchParams} />
    </Suspense>
  );
}

async function Pages({ searchParams }: { searchParams: PageProps<"/admin/pages">["searchParams"] }) {
  await connection();
  await requirePermission("content.manage");
  const sp = await searchParams;
  const [pages, ann] = await Promise.all([listPagesAdmin(), getAnnouncement()]);
  const have = new Set(pages.map((p) => p.slug));
  return (
    <>
      <div className="admin-head">
        <h1>পেজ ও ঘোষণা</h1>
        <p className="lead">প্রকাশিত পেজ musufi.com/p/স্লাগ ঠিকানায় দেখায় এবং ফুটারে লিংক হয়। নিচের শুরু-পেজগুলোর [বন্ধনী] অংশ নিজের তথ্য দিয়ে বদলে প্রকাশ করুন।</p>
      </div>
      {typeof sp.created === "string" && <p className="notice ok" role="status">পেজ তৈরি হয়েছে: /p/{sp.created}</p>}
      {sp.ann && <p className="notice ok" role="status">ঘোষণা বার সংরক্ষণ হয়েছে।</p>}

      <section className="panel" aria-labelledby="h-ann">
        <h2 id="h-ann">উপরের ঘোষণা বার</h2>
        <form action={saveAnnouncementAction} className="admin-form inline-fields">
          <label className="mini-field grow"><span>লেখা</span><input name="text" defaultValue={ann.text} maxLength={160} placeholder="যেমন: ঈদ অফার! EID10 কোডে ১০% ছাড়" /></label>
          <label className="mini-field"><span>লিংক (ঐচ্ছিক)</span><input name="link" defaultValue={ann.link} maxLength={200} placeholder="/category/fish" /></label>
          <label className="mini-field check"><input type="checkbox" name="active" value="1" defaultChecked={ann.active} /><span>দেখাবে</span></label>
          <button className="btn btn-primary" type="submit">সংরক্ষণ</button>
        </form>
      </section>

      {pages.map((p) => (
        <details key={p.id} className="panel cat-edit">
          <summary>
            <b>{p.title}</b>
            <span className={`pill ${p.status === "published" ? "ps-published" : "ps-draft"}`}>{p.status === "published" ? "প্রকাশিত" : "খসড়া"}</span>
            <small>/p/{p.slug} · {dhakaDateTime(p.updated_at)}{p.status === "published" && <> · <Link href={`/p/${p.slug}`} target="_blank">দেখুন</Link></>}</small>
          </summary>
          <PageForm page={p} />
        </details>
      ))}
      {STARTERS.filter((s) => !have.has(s.slug)).map((s) => (
        <details key={s.slug} className="panel cat-edit">
          <summary><b>+ {s.title}</b><small>শুরু-পেজ, এখনো তৈরি হয়নি</small></summary>
          <PageForm page={null} preset={s} />
        </details>
      ))}
      <details className="panel cat-edit">
        <summary><b>+ নতুন পেজ</b></summary>
        <PageForm page={null} />
      </details>
    </>
  );
}
