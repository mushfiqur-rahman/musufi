import { connection } from "next/server";
import { Suspense } from "react";
import { SettingsForm } from "@/components/admin/settings-form";
import { requirePermission } from "@/lib/admin";
import { DIVISIONS, districtsOf } from "@/lib/geo";
import { loadStoreSettingsFresh } from "@/lib/store-settings";

export const metadata = { title: "সেটিংস" };

export default function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({ searchParams }: { searchParams: PageProps<"/admin/settings">["searchParams"] }) {
  await connection();
  await requirePermission("settings.manage");
  const [s, sp] = await Promise.all([loadStoreSettingsFresh(), searchParams]);
  const groups = DIVISIONS.map((d) => ({ division: d.bn, districts: districtsOf(d.id).map((x) => ({ id: x.id, bn: x.bn })) }));
  return (
    <>
      <div className="admin-head">
        <h1>সেটিংস</h1>
        <p className="lead">এখানে বদলালে পুরো দোকানে সাথে সাথে বদলে যায়: হেডার, ফুটার, অর্ডার ফর্ম, ইনভয়েস।</p>
      </div>
      {sp.saved && <p className="notice ok" role="status">সংরক্ষণ হয়েছে।</p>}
      <SettingsForm s={s} groups={groups} />
    </>
  );
}
