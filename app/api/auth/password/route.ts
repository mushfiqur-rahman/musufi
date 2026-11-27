import { clientIp, loginWithPassword, normalizeEmail } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { serverTrouble } from "@/lib/api";

/** Email + password login. Throttled per email and IP in lib/auth.ts. */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ message: "লগইন এখনো চালু হয়নি।" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email) return Response.json({ message: "সঠিক ইমেইল ঠিকানা দিন।" }, { status: 400 });
  if (!password || password.length > 128) return Response.json({ message: "পাসওয়ার্ড দিন।" }, { status: 400 });

  let result;
  try {
    result = await loginWithPassword(email, password, clientIp(request), request.headers.get("user-agent") ?? "");
  } catch (e) {
    return serverTrouble("login-password", e);
  }
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status });
  const c = result.customer;
  return Response.json({ customer: { email: c.email, name: c.name, phone: c.phone, address: c.address, addressParts: c.addressParts, isAdmin: c.isAdmin, hasPassword: true } });
}
