// Role-based access control: the single source of truth for who may do what.
// Pure data + pure functions, safe to import anywhere (also client components,
// e.g. to hide a button). The SERVER always re-checks with lib/staff.ts.

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

/** What each role may do. Owners can do everything. */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
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

export const roleLabel: Record<Role, string> = {
  owner: "মালিক",
  manager: "ম্যানেজার",
  order_staff: "অর্ডার স্টাফ",
  content_editor: "কনটেন্ট এডিটর",
};

export const roleDescription: Record<Role, string> = {
  owner: "সব কিছু, স্টাফ ও সেটিংসসহ",
  manager: "স্টাফ আর সেটিংস ছাড়া সব",
  order_staff: "অর্ডার দেখা ও অবস্থা বদলানো, ক্রেতার তথ্য দেখা",
  content_editor: "পণ্য, ক্যাটাগরি, পেজ ও ঘোষণা",
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false;
}

export function permissionsOf(role: Role | null | undefined): readonly Permission[] {
  return role ? ROLE_PERMISSIONS[role] : [];
}

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}
