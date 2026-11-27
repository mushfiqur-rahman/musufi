import { setOwnPassword } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { serverTrouble } from "@/lib/api";

/** Sets or changes the logged-in person's password (rules in lib/auth.ts). */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ message: "এখন সম্ভব নয়।" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { password?: unknown; current?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const current = typeof body?.current === "string" ? body.current : "";
  try {
    const r = await setOwnPassword(password, current);
    if (!r.ok) return Response.json({ message: r.message }, { status: r.status });
    return Response.json({ ok: true, message: "পাসওয়ার্ড সেট হয়েছে। এরপর থেকে ইমেইল আর পাসওয়ার্ড দিয়ে লগইন করুন।" });
  } catch (e) {
    return serverTrouble("set-password", e);
  }
}
