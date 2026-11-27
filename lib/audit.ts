// Activity log: who changed what, when, from where. Server-only.
// Call audit() after every successful admin change. It never throws, so a
// logging problem can't undo or block the actual change.
import { headers } from "next/headers";
import { execute, select } from "./db";

type Actor = { id: number; email: string } | null;

export async function audit(
  actor: Actor,
  action: string,
  entity: string,
  entityId: string | number | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    let ip: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    } catch {
      // not in a request (e.g. a script)
    }
    await execute(
      "INSERT INTO audit_log (actor_id, actor_email, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [actor?.id ?? null, actor?.email ?? null, action, entity, entityId === null ? null : String(entityId), details ? JSON.stringify(details) : null, ip],
    );
  } catch (e) {
    console.error("[audit] could not write:", e instanceof Error ? e.message : e);
  }
}

export type AuditRow = {
  id: number;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: unknown;
  ip: string | null;
  created_at: Date;
};

export async function listAudit(opts: { entity?: string; entityId?: string; limit?: number } = {}): Promise<AuditRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.entity) { where.push("entity = ?"); params.push(opts.entity); }
  if (opts.entityId) { where.push("entity_id = ?"); params.push(opts.entityId); }
  params.push(Math.min(opts.limit ?? 100, 500));
  return select<AuditRow>(
    `SELECT id, actor_email, action, entity, entity_id, details, ip, created_at FROM audit_log
     ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`,
    params,
  );
}

/** Human-readable Bangla label for an action code. */
export const actionLabel: Record<string, string> = {
  "order.status": "অর্ডারের অবস্থা বদল",
  "order.note": "অর্ডারের নোট",
  "order.tracking": "ট্র্যাকিং নম্বর",
  "order.payment": "পেমেন্ট",
  "order.export": "অর্ডার CSV ডাউনলোড",
  "product.create": "নতুন পণ্য",
  "product.update": "পণ্য সম্পাদনা",
  "product.publish": "পণ্য প্রকাশ",
  "product.unpublish": "পণ্য লুকানো",
  "product.delete": "পণ্য মুছে ফেলা",
  "product.image.add": "ছবি যোগ",
  "product.image.delete": "ছবি মুছে ফেলা",
  "product.image.update": "ছবির তথ্য",
  "category.update": "ক্যাটাগরি সম্পাদনা",
  "category.create": "নতুন ক্যাটাগরি",
  "staff.role": "স্টাফের ভূমিকা",
  "staff.remove": "স্টাফ বাদ",
  "customer.block": "ক্রেতা ব্লক",
  "customer.unblock": "ক্রেতা আনব্লক",
  "customer.note": "ক্রেতার নোট",
  "expense.create": "খরচ যোগ",
  "expense.delete": "খরচ মুছে ফেলা",
  "settings.update": "সেটিংস",
  "stock.adjust": "স্টক বদল",
};
