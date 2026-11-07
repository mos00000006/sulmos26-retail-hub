# SULMOS26 Cash Office – Phase 1 (V26)

This creates a completely separate teal Cash Office app. Sales Desk stays red and remains quotations-only. Green Hub stays management-only.

## Features

- Cashier account and assigned-store sign-in (same existing D1 users, username/password, and store assignments).
- Cashier-scoped APIs: cashier accounts cannot access sales, stock, tasks, admin or product-management endpoints.
- Quotation number lookup: any saved quotation for the assigned store is automatically available to Cash Office.
- Show customer, store, consultant, products, unit prices, discounts and approved total.
- Record one FULL payment per quotation (cash, card or EFT), with confirmation and unique receipt reference.
- For card/EFT: cashier must independently verify successful receipt of funds before recording; bank and terminal integrations are NOT provided.
- Cash tendered and change due.
- Read-only receipt reprint, daily cashier receipts and total by method.
- Database-level duplicate-payment prevention, stale quote/revision checks, discount freeze after payment, audit entries.
- NEVER edits selling prices or discounts from Cash Office.
- NEVER releases goods or deducts stock.
- Receipt is NOT a tax invoice. Full payment only: no split tender, deposits, credit, voids, refunds, cash-up closure or direct payment gateway in Phase 1.

## Changes to the repository

- `src/index.ts` — adds cashier-only API restrictions, payment and receipt endpoints and paid lookup status.
- `migrations/0008_cash_office_receipts.sql` — cash receipt ledger with unique quotation payment.
- `public-cash/` — separate Cash Office application and stylesheet.
- `.github/scripts/prepare-cash-deploy.mjs` — config generation sharing the Manager Hub D1 database.
- `.github/workflows/deploy-cash.yml` — separate manual deploy workflow.

## Important compatibility note

The provided `src/index.ts` is based on V20 Sales Phase 6, with V26 payment changes. If your live backend has newer edits, MERGE the new routes and guards; do NOT blindly overwrite a newer backend file. This patch deliberately does not change `public/app.js` or `public/index.html`, the two files currently involved in Hub startup recovery.

## Deployment order

1. Back up current GitHub source code and the remote D1 database before enabling real payment records.
2. Add/merge the patch files to GitHub on `main`.
3. Run `Sulmos26 Check`, and do not deploy if it fails.
4. Run `Deploy Sulmos26 to Cloudflare` (green manager Worker) to apply migration `0008_cash_office_receipts.sql` to the EXISTING `sulmos26-db`. Check migration output is successful.
5. In Green Hub > Staff & Access, have the OWNER create each employee with role `cashier`, a strong unique password, and their assigned store(s). Existing manager role can only create `sales` accounts in this version.
6. Run `Deploy SULMOS26 Cash Office (Separate Worker)`; it prepares `wrangler.cash.deploy.jsonc` and deploys `sulmos26-cash-office` with the existing shared D1 database.
7. Open the Cash Office Worker through Cloudflare > Workers > `sulmos26-cash-office` > Visit. Install its app if supported by your browser. Cashiers sign in HERE, not the green Hub or red Sales Desk.
8. Create a **test-only quotation** in the red Sales Desk for a nominal amount. Retrieve by exact quote number from Cash Office. Verify total, payment receipt, duplicate block, and daily summary. Mark the test receipt in your accounting reconciliation and do not confuse test entries with real customer payments.

## Migration and status limitations

Original `quotations.status` has a CHECK allowing only `awaiting_payment` and `cancelled`. This V26 deliberately does NOT rewrite that historic table: paid state is derived from presence of a unique `cash_receipts` record. Cash Office lookup displays `paid` and blocks re-payment. Other legacy reports that only count `quotations.status='awaiting_payment'` will still show paid quotes until those reports are updated to join `cash_receipts`. Cash office figures are NOT net sales after returns or refunds. The new receipt ledger becomes the source for recorded payment totals.

**No stock deduction** occurs until a later audited dispatch/stock posting phase. A quotation also does not reserve stock automatically.

## Tests performed before packaging

- `node --check` on Cash Office frontend and deployment helper.
- Applied migrations 0001 through 0008 to isolated in-memory SQLite.
- Inserted one test receipt, verified change amount, and verified duplicate insert prevented.
- A full TypeScript compile with Cloudflare typings / full GitHub test suite has NOT been completed here; the GitHub `npm run check` step is mandatory.

## Security controls requiring further testing before operational use

- Payment gateway / EFT status verification is external to the app. Do not mark card/EFT paid before independent confirmation.
- Refunds, voids, reversals and end-of-day reconciliation are NOT built yet. Do not deploy for unsupervised live cash handling until accounting sign-off.
- A full checkout audit and payments reconciliation should be completed before production roll-out.
