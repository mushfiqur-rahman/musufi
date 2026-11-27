import { clientIp, normalizeEmail, pruneAuthTables, requestLoginCode } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { smtpReady } from "@/lib/mailer";
import { serverTrouble } from "@/lib/api";

export async function POST(request: Request) {
  if (!dbConfigured() || !smtpReady()) {
    return Response.json({ message: "লগইন এখনো চালু হয়নি। হোয়াটসঅ্যাপে বা ফোনে অর্ডার করুন।" }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = normalizeEmail(body?.email);
  if (!email) return Response.json({ message: "সঠিক ইমেইল ঠিকানা দিন।" }, { status: 400 });

  let result;
  try {
    result = await requestLoginCode(email, clientIp(request));
  } catch (e) {
    return serverTrouble("login-code", e);
  }
  if (Math.random() < 0.05) pruneAuthTables().catch(() => {});
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status });
  return Response.json({ message: `${email} ঠিকানায় ৬ সংখ্যার কোড পাঠানো হয়েছে। ইনবক্সে না পেলে স্প্যাম ফোল্ডার দেখুন।` });
}
