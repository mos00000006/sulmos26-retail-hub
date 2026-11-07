# SULMOS26 V16 — Sales Desk → Cash Office handoff

This is a **sales-only** phase. Consultants do not handle cash, cards, EFT payments, cash-ups, final tax invoices, payment approvals, or stock movements.

## Files to update in the existing GitHub repository

- `src/index.ts` — adds protected sales-order handoff API, and prevents discount edits once sent
- `migrations/0004_sales_orders_cash_office_queue.sql` — additive new sales_orders table
- `public-pos/app.js` — adds handoff form and sent-order list
- `public-pos/styles.css` — sales handoff styling, preserving V15 alignment
- `tests/sales-handoff-phase2.test.mjs` — new assertions

No existing quotations, products, stores, or users are deleted. However **review your current `src/index.ts` before replacing it**: this patch was based on the latest V13 source from the earlier chat, not a verified fresh GitHub clone. Back up or compare if you've made other backend changes.

## Deploy in order

1. Commit the five files to `main` in their exact paths.
2. Run `Sulmos26 Check` or `npm run check`.
3. Run **Deploy Sulmos26 to Cloudflare** so D1 migration 0004 runs and the Hub API gets the changes.
4. Confirm the migration applied to **sulmos26-db**. Do not create a new D1 database.
5. Run **Deploy SULMOS26 POS (Separate Worker)**.
6. Open the red POS, create a test quotation, then choose **Send to Cash Office** with collection or delivery.
7. Confirm the new order has status `awaiting_cashier`; try a second submission and confirm it is blocked.

## What this does not do

- It does not collect/record money, create paid invoices, finalize sales, or deduct inventory.
- It does not yet implement the Cash Office screen. The order queue data is prepared for that later phase.
- No one should consider an `awaiting_cashier` order paid or ready for dispatch.

## Validation performed

- JavaScript syntax checked.
- Local SQLite executed migrations 0001–0004 and confirmed a sales order inserts and cannot be duplicated.
- New sales handoff tests passed, along with the updated V13 member test.
- Full `npm run check` could not be completed in this local container because dependencies were unavailable. The GitHub check is required before live deployment.
