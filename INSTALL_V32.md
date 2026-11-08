# SULMOS26 V32 — CENTRAL STOCK LEDGER

## What this release does

- Creates `inventory_balances` (authoritative store + SKU on-hand balance).
- Creates append-only `inventory_movements` with source, actor and timestamp.
- Imports manager-verified `stock_snapshots` as **opening balances**, without duplicating them.
- Retains the current Green Hub manager stock adjustment API; existing stock-snapshot writes automatically create a movement in the ledger.
- Updates the existing `/api/sales-stock` endpoint to read the authoritative ledger (and compute separately approved reservations). Sales Desk V21 already calls this endpoint.
- Adds GET `/api/inventory/availability?store_id=...` (assigned store / owner / manager / sales): distinguishes `0 on hand` from unrecorded stock (`null`).
- Adds GET `/api/inventory/movements?store_id=...&sku=...` (owner/manager only): audit register.
- A verified PAID receipt may be picked, staged and RELEASED. The final Dispatch `ready -> released` transition atomically deducts quoted unit quantities from that store's stock using database triggers.
- Insufficient/unrecorded stock BLOCKS final release and leaves the dispatch state `ready`. Approved reservations for other quotations are protected too.
- Once a receipt is released, it cannot be released again. Posting reference `(reason, source_id, store, sku)` is unique.
- Quotations and payment recording do NOT deduct stock. Dispatch picking and marking ready do NOT deduct stock.

## Before installation — essential

1. Do not install this into a live operating till without a D1 backup and a controlled test. V32 changes how stock is posted at release.
2. Confirm V31 has been installed and migration `0009_dispatch_fulfilment.sql` is present and applied.
3. **Physically verify opening stock per store/SKU.** Existing manager snapshots are imported as opening balances. If snapshots are wrong, the balances will be wrong. Stock not recorded blocks dispatch release.
4. This version uses whole units. Products sold by metre, kilogram or partial quantity require a future unit-of-measure conversion update before posting.
5. V32 does NOT automatically post approved GRVs, supplier returns or inter-store transfers, because prior versions record those as approvals only. Do not assume they update physical stock. Use a manager-verified stock adjustment after real movements until those workflows are built.
6. V32 deliberately does NOT back-post older orders that were marked released BEFORE migration `0010`. Reconcile those separately to avoid duplicate deductions.
7. Cash Office documents are payment receipts, not VAT-compliant tax invoices, until tax-invoice functionality is implemented.

## Files to add/replace

- `migrations/0010_inventory_ledger.sql` — NEW (do not rename)
- `src/index.ts` — latest V31 backend plus read-only inventory endpoints and ledger-backed Sales stock
- `src/dispatch.ts` — latest V31 Dispatch backend plus guarded automatic stock posting confirmation
- `public-dispatch/app.js` — Dispatch wording updated to explain deductions at goods release
- `.github/workflows/deploy-dispatch.yml` — existing Dispatch workflow; deployment description updated, migration step unchanged

Only replace these files if your GitHub repo is still compatible with the supplied V31 code. **Review diffs first**. This is not a replacement for any of the Green Hub frontend files (`public/app.js`, `public/index.html`), Cash Office frontend or POS branding files.

## Safe deployment sequence

1. Back up production D1 database and export current stock snapshot records.
2. Commit files to `main` on GitHub and confirm `npm run check` passes.
3. Apply migration 0010 to the existing `sulmos26-db` using the Dispatch workflow. The Dispatch workflow runs `wrangler d1 migrations apply ... --remote` before deploying Dispatch. Inspect the migration logs before the Worker is deployed.
4. Deploy Green Hub backend and Red POS backend from the same GitHub commit so `/api/sales-stock` uses inventory balances. Hub frontend is not changed by this patch.
5. Refresh the Red POS and Dispatch applications.
6. At a test store/product, enter a VERIFIED opening quantity (for example 5). Confirm Sales reads 5 on hand. Make a test quotation for 2. Confirm it remains 5. Record test payment: still 5. Pick and mark ready: still 5. Release: 3 on hand. Confirm one `dispatch_release` inventory movement is logged.
7. Attempt a second release and a release with insufficient/unrecorded stock. Both must fail with no further quantity change.
8. Verify another store's balance is unaffected. Verify cashier accounts cannot call management inventory routes.

## Existing permissions

Only owner and manager can record stock snapshot adjustments through existing API.
Sales can view their assigned store's quantities and approved reservations; sales cannot post movements or take payments.
Cashiers cannot adjust stock or release goods.
Dispatch can release a payment-verified order at their assigned store; a release MUST pass on-hand checks.

## Rollback caution

Do NOT roll back only `src/dispatch.ts` after activating migration 0010: the database trigger automatically posts releases, even if old frontend wording is restored. Restore code and database migration state together under an operations rollback plan. Do not manually delete ledger movements.

## Validation performed

- Local SQLite integration test using migrations 0001, 0003–0010: opening balance, adjustment, dispatch release, duplicate prevention, negative-stock guard and immutable entries: PASSED.
- TypeScript type check with minimal Cloudflare types: PASSED.
- Dispatch UI JavaScript syntax check: PASSED.
- Live Cloudflare deployment and complete repository test suite: NOT YET VERIFIED.
