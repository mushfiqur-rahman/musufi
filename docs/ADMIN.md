# Musufi admin: how it works

This is the maintainer's guide to the admin dashboard and the backend behind it.
Read it before adding a page, a permission or a database change.

## Map of the code

| Area | File(s) | What it does |
|---|---|---|
| Roles and permissions | `lib/permissions.ts` | The only place that says which role may do what. Pure data, safe anywhere. |
| Access gate | `lib/admin.ts` | `requirePermission()` for pages (redirects), `assertPermission()` for server actions (throws). |
| Login and sessions | `lib/auth.ts` | Email codes, session cookie, effective role (`ADMIN_EMAILS` → owner). |
| Activity log | `lib/audit.ts` | `audit()` after every admin change; `listAudit()` for the log page. |
| Input checks | `lib/validate.ts` | Shared validators and `actionError()` (safe error messages). |
| Public catalogue | `lib/catalog.ts` | `getCatalog()` (cached, tag `catalog`), `loadOrderable()` (fresh, for checkout). |
| Admin catalogue | `lib/admin-catalog.ts` | Products, variants, images, categories: database reads and writes. |
| Orders and finance | `lib/orders.ts`, `lib/reports.ts`, `lib/dashboard.ts` | Orders, stock, status, risk, settings, expenses, profit, KPIs. |
| Server actions | `app/admin/actions/products.ts`, `app/admin/actions/operations.ts` | Every admin write goes through here. |
| Admin pages | `app/admin/**` | Each page checks its own permission. |
| Database | `db/migrations/*.sql`, `npm run db:migrate` | Schema changes, applied in name order, once each. |
| Starter catalogue | `lib/products.ts`, `npm run db:seed` | Types + the first products; also the fallback if the DB is down. |

## Roles

Defined in `lib/permissions.ts` (`ROLE_PERMISSIONS`). Owners listed in the
`ADMIN_EMAILS` environment variable are always `owner`, whatever the database
says, so the owner can never lock themselves out.

| Permission | Owner | Manager | Order staff | Content editor |
|---|---|---|---|---|
| dashboard.view | ✓ | ✓ | ✓ | ✓ |
| orders.view / orders.manage | ✓ | ✓ | ✓ | – |
| customers.view | ✓ | ✓ | ✓ | – |
| customers.manage | ✓ | ✓ | – | – |
| products.view | ✓ | ✓ | ✓ | ✓ |
| products.manage | ✓ | ✓ | – | ✓ |
| reports.view, finance.manage | ✓ | ✓ | – | – |
| content.manage | ✓ | ✓ | – | ✓ |
| settings.manage, staff.manage | ✓ | – | – | – |
| audit.view | ✓ | ✓ | – | – |

Staff are added on **Admin → স্টাফ ও ভূমিকা** by email. They log in with their
own email code. Removing a staff member also ends their sessions.

## Rules every change must follow

1. **Pages**: wrap request-time work in `<Suspense>`, call `await connection()`
   first, then `await requirePermission("…")`. (Cache Components requires the
   Suspense; `connection()` keeps database work out of prerendering.)
2. **Server actions** are public HTTP endpoints. Start every action with
   `await assertPermission("…")`. Never rely on a button being hidden.
3. **Validate** every input with `lib/validate.ts`. Never pass raw form values to SQL.
4. **SQL** always uses `?` placeholders. Never build SQL from user input.
5. **Log** every successful change with `audit(me, "area.verb", entity, id, details)`
   and add a Bangla label to `actionLabel` in `lib/audit.ts`.
6. **Catalogue changes** must call `updateTag(CATALOG_TAG)` so the shop updates.
7. **Errors** shown to users come from `actionError()`; it hides internals and logs details.
8. **No native npm packages** (sharp, bcrypt, canvas…): Hostinger's build server
   has an old glibc. Check with `NEXT_TEST_WASM=1 npm run build` before pushing.

## Adding things

**A permission**: add it to `PERMISSIONS`, give it to roles in `ROLE_PERMISSIONS`,
add a label in `app/admin/staff/page.tsx` (`permLabel`).

**An admin page**: create `app/admin/<name>/page.tsx` following rule 1, then add a
menu item to `NAV` in `app/admin/layout.tsx` with its permission.

**A database change**: add `db/migrations/00N_description.sql`, run
`npm run db:migrate` (from a PC that can reach the database). Never edit a
migration that has already been applied; add a new one.

## Security summary

- Login: 6-digit email codes, HMAC-hashed, 10 minutes, 5 attempts, a new code
  cancels older ones, rate-limited per email and IP. Blocked accounts can't log in.
- Session: random 32-byte token in an HttpOnly, SameSite=Lax cookie (Secure in
  production); only its SHA-256 is stored. 30 days.
- Authorisation: `lib/permissions.ts` + `requirePermission`/`assertPermission`
  on every page and action.
- Checkout: prices, stock and zones read fresh from the database; stock is
  decremented with a guarded UPDATE inside the order transaction.
- Uploads: max 1.5 MB, type checked by file signature (not by name), stored in
  the database, served with `nosniff`.
- Admin pages are `noindex` and listed in `robots.txt` as disallowed.
- Every admin change is in the activity log with actor, time and IP.

## Scripts

| Command | Use |
|---|---|
| `npm run dev` | Local development (uses `.env.local`) |
| `npm run build` | Production build (webpack, works on Hostinger) |
| `npm run db:migrate` | Apply new database migrations |
| `npm run db:seed` | Copy the starter catalogue into an empty database (skips existing slugs) |
| `NEXT_TEST_WASM=1 npm run build` | Build the way Hostinger does (no native compiler) |

## Roadmap

- **Phase 2**: orders (search, tracking number, invoice/packing slip, CSV
  export), customers (list, profile, block, notes), settings (store details,
  delivery zones and charges, payment methods).
- **Phase 3**: coupons, reviews, content pages and banners, courier
  integration and fraud check, 2FA for staff, backups.
