import { currentCustomer } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";

// Lets static pages (product pages) learn who is logged in after they load.
export async function GET() {
  if (!dbConfigured()) return Response.json({ customer: null, loginAvailable: false });
  const c = await currentCustomer().catch(() => null);
  return Response.json(
    {
      loginAvailable: true,
      customer: c ? { email: c.email, name: c.name, phone: c.phone, address: c.address, addressParts: c.addressParts, isAdmin: c.isAdmin, hasPassword: c.hasPassword } : null,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
