import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { verifyTotpAction } from "@/app/admin/actions/security";
import { TOTP_ERRORS, TotpCodeField } from "@/components/admin/totp-code-field";
import { requireStaff } from "@/lib/admin";

export const metadata = { title: "২-ধাপ যাচাই" };

/** Second login step for staff with 2FA on. requirePermission() sends them here. */
export default function VerifyPage({ searchParams }: PageProps<"/admin/verify">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Verify searchParams={searchParams} />
    </Suspense>
  );
}

async function Verify({ searchParams }: { searchParams: PageProps<"/admin/verify">["searchParams"] }) {
  await connection();
  const me = await requireStaff();
  if (!me.mfaPending) redirect("/admin");
  const err = (await searchParams).err;
  return (
    <section className="panel narrow" aria-labelledby="h-verify">
      <h1 id="h-verify">২-ধাপ যাচাই</h1>
      <p className="lead">অ্যাডমিন খুলতে আপনার অথেনটিকেটর অ্যাপের (Google Authenticator ইত্যাদি) কোডটি দিন।</p>
      {typeof err === "string" && TOTP_ERRORS[err] && <p className="notice bad" role="alert">{TOTP_ERRORS[err]}</p>}
      <form action={verifyTotpAction} className="stack">
        <TotpCodeField />
        <button className="btn btn-primary" type="submit">যাচাই করুন</button>
      </form>
      <p className="hint">ফোন হারিয়েছেন? দোকানের মালিককে বলুন, তিনি আপনার ২-ধাপ লগইন রিসেট করে দেবেন।</p>
    </section>
  );
}
