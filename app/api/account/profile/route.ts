import { currentCustomer } from "@/lib/auth";
import { BD_MOBILE, parseAddress } from "@/lib/address";
import { dbConfigured, execute } from "@/lib/db";
import { serverTrouble } from "@/lib/api";

/**
 * Saves the logged-in customer's name, mobile number and default delivery
 * address (pre-filled in the order form). Same address rules as orders.
 * The address is optional: leave the address fields empty to keep only name/phone.
 */
export async function POST(request: Request) {
  if (!dbConfigured()) return Response.json({ message: "এখন সম্ভব নয়।" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { name?: unknown; phone?: unknown; address?: unknown } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) return Response.json({ message: "আপনার নাম দিন (২ থেকে ৮০ অক্ষর)।", field: "name" }, { status: 400 });
  const phone = typeof body?.phone === "string" ? body.phone.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[\s-]/g, "") : "";
  if (!BD_MOBILE.test(phone)) return Response.json({ message: "১১ সংখ্যার মোবাইল নম্বর দিন, যেমন ০১৭XXXXXXXX।", field: "phone" }, { status: 400 });

  // Address is optional; if any part is filled, all of it must be valid.
  const a = body?.address as Record<string, unknown> | undefined;
  const hasAddress = Boolean(a && (a.divisionId || a.districtId || a.upazilaId || (typeof a.line === "string" && a.line.trim())));
  const addr = hasAddress ? parseAddress(a) : null;
  if (addr && !addr.ok) return Response.json({ message: addr.message, field: "address" }, { status: 400 });

  try {
    const me = await currentCustomer();
    if (!me) return Response.json({ message: "আগে লগইন করুন।" }, { status: 401 });
    if (addr?.ok) {
      await execute("UPDATE customers SET name = ?, phone = ?, address = ?, address_parts = ? WHERE id = ?", [name, phone, addr.line, JSON.stringify(addr.parts), me.id]);
    } else {
      await execute("UPDATE customers SET name = ?, phone = ? WHERE id = ?", [name, phone, me.id]);
    }
    return Response.json({ ok: true, message: "আপনার তথ্য সংরক্ষণ হয়েছে। পরের অর্ডারে এগুলো নিজে থেকেই বসে যাবে।" });
  } catch (e) {
    return serverTrouble("profile", e);
  }
}
