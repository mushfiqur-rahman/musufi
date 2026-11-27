// Role-based access control. Pure data + pure functions, safe to import
// anywhere. The owner edits which role may do what on Admin → স্টাফ ও ভূমিকা;
// that table is stored in the database (lib/roles.ts) and the defaults below
// are used until it is first saved. The SERVER always re-checks with lib/admin.ts.

export const ROLES = ["owner", "manager", "order_staff", "content_editor"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard.view",
  "orders.view",
  "orders.manage", // change status, notes, tracking
  "customers.view",
  "customers.manage", // block, notes
  "products.view",
  "products.manage", // create, edit, publish, images, stock
  "reports.view", // profit, expenses
  "finance.manage", // expenses, cost prices, courier costs
  "content.manage", // pages, announcement bar
  "marketing.manage", // coupons, review moderation
  "settings.manage",
  "staff.manage", // add/remove staff, change roles
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type RoleMatrix = Record<Role, readonly Permission[]>;

/**
 * Never given to anyone but the owner: managing staff includes editing this
 * table, so granting it would let someone raise their own access.
 */
export const OWNER_ONLY: readonly Permission[] = ["staff.manage"];

/** Starting table (used until the owner saves their own). Owners can do everything. */
export const DEFAULT_ROLE_PERMISSIONS: RoleMatrix = {
  owner: PERMISSIONS,
  manager: [
    "dashboard.view",
    "orders.view",
    "orders.manage",
    "customers.view",
    "customers.manage",
    "products.view",
    "products.manage",
    "reports.view",
    "finance.manage",
    "content.manage",
    "marketing.manage",
    "audit.view",
  ],
  order_staff: ["dashboard.view", "orders.view", "orders.manage", "customers.view", "products.view"],
  content_editor: ["dashboard.view", "products.view", "products.manage", "content.manage"],
};

/** Bangla names for the permission table. */
export const permissionLabel: Record<Permission, string> = {
  "dashboard.view": "ড্যাশবোর্ড",
  "orders.view": "অর্ডার দেখা",
  "orders.manage": "অর্ডার বদলানো",
  "customers.view": "ক্রেতা দেখা",
  "customers.manage": "ক্রেতা ব্লক/নোট",
  "products.view": "পণ্য দেখা",
  "products.manage": "পণ্য ও ক্যাটাগরি সম্পাদনা",
  "reports.view": "লাভ-ক্ষতি",
  "finance.manage": "খরচ ও কেনা দাম",
  "content.manage": "পেজ ও ঘোষণা",
  "marketing.manage": "কুপন ও রিভিউ",
  "settings.manage": "সেটিংস",
  "staff.manage": "স্টাফ পরিচালনা",
  "audit.view": "অ্যাক্টিভিটি লগ",
};

export const roleLabel: Record<Role, string> = {
  owner: "মালিক",
  manager: "ম্যানেজার",
  order_staff: "অর্ডার স্টাফ",
  content_editor: "কনটেন্ট এডিটর",
};

export const roleDescription: Record<Role, string> = {
  owner: "সব কিছু। স্টাফ ও ভূমিকা শুধু মালিকই বদলাতে পারেন।",
  manager: "শুরুতে: স্টাফ আর সেটিংস ছাড়া সব",
  order_staff: "শুরুতে: অর্ডার দেখা ও অবস্থা বদলানো, ক্রেতার তথ্য দেখা",
  content_editor: "শুরুতে: পণ্য, ক্যাটাগরি, পেজ ও ঘোষণা",
};

export function isPermission(v: unknown): v is Permission {
  return typeof v === "string" && (PERMISSIONS as readonly string[]).includes(v);
}

/** Cleans a stored or submitted table: owner always has everything, unknown names and owner-only rights dropped. */
export function normalizeMatrix(raw: unknown): RoleMatrix {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const out = {} as Record<Role, readonly Permission[]>;
  for (const role of ROLES) {
    if (role === "owner") { out.owner = PERMISSIONS; continue; }
    const list = src && Array.isArray(src[role]) ? (src[role] as unknown[]) : DEFAULT_ROLE_PERMISSIONS[role];
    out[role] = PERMISSIONS.filter((p) => list.includes(p) && !OWNER_ONLY.includes(p));
  }
  return out;
}

/** Permissions of a role under a given table. */
export function permissionsOf(matrix: RoleMatrix, role: Role | null | undefined): readonly Permission[] {
  return role ? matrix[role] : [];
}

/** Checks a staff member (from requirePermission / assertPermission, which carry their permissions). */
export function can(staff: { permissions: readonly Permission[] } | null | undefined, permission: Permission): boolean {
  return Boolean(staff?.permissions.includes(permission));
}

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}
