import { logout } from "@/lib/auth";

export async function POST() {
  await logout().catch(() => {});
  return Response.json({ ok: true });
}
