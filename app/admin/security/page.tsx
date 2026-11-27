import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { cancelTotpAction, confirmTotpAction, disableTotpAction, startTotpAction } from "@/app/admin/actions/security";
import { TOTP_ERRORS, TotpCodeField } from "@/components/admin/totp-code-field";
import { requireStaff } from "@/lib/admin";
import { pendingSecret } from "@/lib/mfa";
import { otpauthUri } from "@/lib/totp";

export const metadata = { title: "নিরাপত্তা" };

/** Each staff member turns their own 2FA on or off here. */
export default function SecurityPage({ searchParams }: PageProps<"/admin/security">) {
  return (
    <Suspense fallback={<p className="lead">লোড হচ্ছে...</p>}>
      <Security searchParams={searchParams} />
    </Suspense>
  );
}

async function Security({ searchParams }: { searchParams: PageProps<"/admin/security">["searchParams"] }) {
  await connection();
  const me = await requireStaff();
  if (me.mfaPending) redirect("/admin/verify");
  const sp = await searchParams;
  const err = typeof sp.err === "string" ? TOTP_ERRORS[sp.err] : undefined;
  const secret = me.totpEnabled ? null : await pendingSecret(me.id);

  return (
    <>
      <div className="admin-head">
        <h1>নিরাপত্তা: ২-ধাপ লগইন</h1>
        <p className="lead">চালু করলে প্রতিবার লগইনে ইমেইলের কোডের পরে ফোনের অথেনটিকেটর অ্যাপের ৬ অঙ্কের কোডও লাগবে। ইমেইল কেউ হাতিয়ে নিলেও অ্যাডমিনে ঢুকতে পারবে না।</p>
      </div>
      {sp.on && <p className="notice ok" role="status">২-ধাপ লগইন চালু হয়েছে।</p>}
      {sp.off && <p className="notice ok" role="status">২-ধাপ লগইন বন্ধ হয়েছে।</p>}
      {err && <p className="notice bad" role="alert">{err}</p>}

      <section className="panel" aria-labelledby="h-2fa">
        <h2 id="h-2fa">অবস্থা: {me.totpEnabled ? "চালু ✓" : secret ? "সেটআপ চলছে" : "বন্ধ"}</h2>

        {me.totpEnabled ? (
          <form action={disableTotpAction} className="stack">
            <p className="hint">বন্ধ করতে অ্যাপের বর্তমান কোডটি দিন।</p>
            <TotpCodeField />
            <button className="btn btn-ghost" type="submit">২-ধাপ লগইন বন্ধ করুন</button>
          </form>
        ) : secret ? (
          <div className="stack">
            <ol className="steps-list">
              <li>ফোনে Google Authenticator, Microsoft Authenticator বা অনুরূপ অ্যাপ খুলুন।</li>
              <li>
                এই ফোনেই সাইট খোলা থাকলে <a href={otpauthUri(secret, me.email)}>এখানে চাপুন</a>; নাহলে অ্যাপে “Enter a setup key” বেছে নিচের কী লিখুন (ধরন: Time based):
                <code className="totp-secret break">{secret.replace(/(.{4})/g, "$1 ").trim()}</code>
              </li>
              <li>অ্যাপে যে ৬ অঙ্কের কোড দেখাবে, নিচে দিন।</li>
            </ol>
            <form action={confirmTotpAction} className="stack">
              <TotpCodeField />
              <button className="btn btn-primary" type="submit">যাচাই করে চালু করুন</button>
            </form>
            <form action={cancelTotpAction}><button className="linkish" type="submit">বাতিল</button></form>
          </div>
        ) : (
          <form action={startTotpAction}>
            <button className="btn btn-primary" type="submit">২-ধাপ লগইন চালু করুন</button>
          </form>
        )}
      </section>
    </>
  );
}
