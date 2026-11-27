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
| Orders and finance | `lib/orders.ts`, `lib/order-filters.ts`, `lib/reports.ts`, `lib/dashboard.ts` | Orders (search, filters, bulk status, CSV, payment, shipping), stock, risk, expenses, profit, KPIs. |
| Customers | `lib/customers.ts` | List with segments (new, repeat, high value, inactive), profile, block, notes. |
| Store settings | `lib/store-config.ts` (pure), `lib/store-settings.ts` (DB, tag `settings`) | Contact, delivery zones and fees, free delivery, payment methods. One JSON row. |
| Coupons | `lib/coupons.ts` | `evaluateCoupon()` is the single rule check, used by the preview API and at checkout. |
| Reviews | `lib/reviews.ts` | Verified buyers only (delivered order), moderated before showing (tag `reviews`). |
| Content | `lib/content.ts`, `lib/markup.tsx` | Pages at `/p/<slug>`, announcement bar (tag `content`); safe mini-markup renderer. |
| Staff 2FA | `lib/totp.ts` (RFC 6238 + AES-GCM), `lib/mfa.ts` | Authenticator-app codes for staff logins. |
| Server actions | `app/admin/actions/*.ts` (products, operations, settings, marketing, security) | Every admin write goes through here. |
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
| content.manage (pages, announcement) | ✓ | ✓ | – | ✓ |
| marketing.manage (coupons, reviews) | ✓ | ✓ | – | – |
| settings.manage, staff.manage | ✓ | – | – | – |
| audit.view | ✓ | ✓ | – | – |

Staff are added on **Admin → স্টাফ ও ভূমিকা** by email. They log in with their
own email code. Removing a staff member also ends their sessions.

### Two-factor login (2FA)

Any staff member can turn it on under **Admin → নিরাপত্তা**: scan/enter the key
in an authenticator app, confirm with a code. After that every new login needs
the email code **and** an app code before any admin page or action works
(`requirePermission`/`assertPermission` check `mfaPending`). Codes work once,
±30 seconds clock drift is allowed, wrong codes are throttled (6 per 10 minutes).
The secret is stored encrypted with a key derived from `SESSION_SECRET`, so
**changing `SESSION_SECRET` turns everyone's 2FA unusable**: the owner then resets
it per person. Lost phone: the owner presses **২-ধাপ লগইন রিসেট** on the staff page,
which also signs that person out everywhere. Only `/admin/security` and
`/admin/verify` use `requireStaff()` (no 2FA check); everything else must use
`requirePermission`.

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
- Coupons: re-checked inside the order transaction; `used_count` is raised with a
  guarded UPDATE so a limited coupon can't be over-used; cancelling releases it.
- Reviews and pages: shown as plain text or through the safe markup renderer
  (no raw HTML; links only to `/…` or `https://…`).
- Staff 2FA: see above.
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

- Done: phase 1 (roles, activity log, dashboard, products in DB), phase 2
  (orders, customers, settings), phase 3 (coupons, reviews, pages and
  announcement, staff 2FA).
- **Next**: courier integration and fraud check (needs the courier's API
  account: Steadfast, Pathao or RedX), automatic database backups.
