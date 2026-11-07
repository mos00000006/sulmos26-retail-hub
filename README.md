# Sulmos26 — Your business. One system.

**Standalone GitHub-ready retail hub starter.** This is an **independent project**. Do **not** merge it into your PowerBuild / Maliks Group Hub repository. The fresh D1 database contains **no demo stores, branches, customers, products, photos, users, prices or transactions**.

## Open Sulmos26 (the actual app)

**The GitHub Pages link is documentation, not the running Hub.** The Worker + D1 app must be deployed to Cloudflare. Follow [OPEN_SULMOS26_AFTER_GITHUB.txt](OPEN_SULMOS26_AFTER_GITHUB.txt). GitHub Actions has a manual **Deploy Sulmos26 to Cloudflare** workflow. A private 32+ character installation key is required before the first owner can register. The separate `sulmos26-retail-hub` Worker and D1 database are used; never reuse PowerBuild credentials or bindings.

## What works in V1

- Company onboarding: the first owner creates the business and secure owner login.
- Teal / charcoal / white Sulmos26 branded responsive dashboard using your supplied logo.
- Manual location creation, SKU/product entry with optional image URL, and business profile.
- Staff accounts with roles (owner, manager, sales, cashier, stock, dispatch, viewer) and store assignments.
- Quote capture with server-validated current product prices and immutable item snapshots, numbering, unpaid printout and Cash Office review queue.
- GRV, counts, adjustments, supplier returns and transfers **as controlled documents**, with independent manager approval and audit history.
- Tasks, basic operational counts and access-controlled activity log.
- Password hashing (PBKDF2), secure opaque HttpOnly session cookies, basic login rate-limiting, and same-origin checks on state-changing API calls.
- A **separate deployment and D1 database per customer** (recommended V1 sales / installation model).

**Not operational:** cash/card payments, paid tax invoices, stock ledger balances and posting, accounting, barcode hardware, debtor accounts, R2 image uploads, actual dispatch release, offline POS, payroll, comprehensive reports, and group-wide SaaS tenant billing. The Dispatch, Cash Office and reports sections are intentionally guarded or illustrative. **Never market this starter as a complete financial POS or TOUCH365 replacement.**

## Before uploading to GitHub

1. Create a **new repository** called `sulmos26-retail-hub` (do not copy into `maliksgroupza`).
2. Extract the ZIP. Upload the **contents of the `Sulmos26_Retail_Hub_GitHub` folder** to the root of that new repository (or use GitHub Desktop).
3. The supplied PowerBuild/Maliks code, catalogues and databases are **not included**. The only brand assets are the Sulmos26 logo and mark.

## Run on Cloudflare (requires your own Cloudflare account and Node.js 22+)

1. `npm install`
2. Sign in securely: `npx wrangler login`
3. Create a **NEW database** for this project: `npx wrangler d1 create sulmos26-db`
4. Copy the resulting `database_id` into `wrangler.jsonc` **replacing** `REPLACE_WITH_YOUR_NEW_D1_DATABASE_ID`. Do **not** use the Maliks Hub database ID.
5. Apply migrations locally for testing: `npm run db:local`
6. Start: `npm run dev`. Open the local URL shown by Wrangler. Create the owner and business (no seed data).
7. Run `npm run check`.
8. For a real fresh customer installation, apply migration to the NEW remote database: `npm run db:remote` and deploy with `npm run deploy`.
9. At the deployment URL, complete the initial owner setup immediately; **do not leave an unused publicly accessible bootstrap deployment**. Prefer restrict access during setup, or deploy behind an access gateway.

**Production security:** Use HTTPS, secret management and a customer-specific deployment. Protect / monitor first-owner setup, use backups, verify user permissions and legal compliance, and arrange independent security review before selling. Cloudflare Access (or another secure private bootstrap) is recommended. Do not store credentials in GitHub. All initial passwords must have at least 12 characters.

## Per-customer delivery model

Each new shop gets a **new deployment + new D1 database**, its own owner credentials, and its own store/product data. This is not a multi-tenant shared database; do not place unrelated businesses in the same installation. Your platform brand stays Sulmos26, but each shop fills its own company trading details.

## Project folders

| Path | Purpose |
|---|---|
| `public/` | Responsive interface, supplied logo and browser scripts |
| `src/index.ts` | Cloudflare Worker API, role protection and document workflows |
| `src/logic.mjs` | Tested validation and role-policy helpers |
| `migrations/0001_initial.sql` | Empty D1 schema (no seed records) |
| `.github/workflows/check.yml` | GitHub syntax/type and regression checks |
| `tests/` | Node.js regression tests |
| `docs/` | Scope and delivery guidance |

## Additional notes

*Product images:* users can optionally enter their own direct HTTPS image URL; image file uploads to R2 are not included in V1. A new customer never receives another customer's product photos. 

*VAT and quotations:* quotation totals are a price snapshot. VAT settings are not yet a tax engine. Don't label them tax invoices.

*Approval:* independent management approval changes a **document status only**, not inventory. The future ledger must add secure stock movement posting and opening balance validation.
