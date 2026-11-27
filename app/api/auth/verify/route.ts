import { normalizeEmail, verifyLoginCode } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { serverTrouble } from "@/lib/api";

export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ message: "লগইন এখনো চালু হয়নি।" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { email?: unknown; code?: unknown } | null;
  const email = normalizeEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\s/g, "") : "";
  if (!email) return Response.json({ message: "সঠিক ইমেইল ঠিকানা দিন।" }, { status: 400 });

  let result;
  try {
    result = await verifyLoginCode(email, code, request.headers.get("user-agent") ?? "");
  } catch (e) {
    return serverTrouble("login-verify", e);
  }
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status });
  const c = result.customer;
  return Response.json({ customer: { email: c.email, name: c.name, phone: c.phone, address: c.address, addressParts: c.addressParts, isAdmin: c.isAdmin, hasPassword: c.hasPassword } });
}
