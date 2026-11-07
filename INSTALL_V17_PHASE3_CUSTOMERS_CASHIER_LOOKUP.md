# SULMOS26 V17 – Sales Phase 3 / Quote number cashier lookup

## Business rule
Every saved quotation can be retrieved by its `Q-...` reference in Cash Office. The sales consultant does **not** take payment and does **not** have to confirm an order simply to make a quotation searchable. If the customer chooses to buy, the cashier will type the quotation reference in the FUTURE Cash Office application and see a single exact match with the latest owner-approved total and line items. The cashier app and payment posting are NOT provided in this patch.

## Changes
- `migrations/0005_customers_cash_office_lookup.sql`: adds store-specific customer records and optional customer link on quotations; does not touch existing quotations' amounts.
- `src/index.ts`: customer creation/lookup/history APIs, and safe read-only cashier quote lookup/list APIs. Existing discount & V16 handoff rules remain.
- `public-pos/app.js`: sales can save/select customers, see customer quote history, and know that quotes appear automatically at Cash Office. No money controls.
- `public-pos/styles.css`: small customer UI styles.
- `tests/sales-customers-phase3.test.mjs`: targeted checks.

## Deploy safely
1. **Confirm V16** (`0004_sales_orders_cash_office_queue.sql`) is already in the repository. This patch builds upon V16.
2. Back up/compare your live `src/index.ts` and `public-pos/app.js` before replacing them. Do not overwrite newer changes without merging.
3. Commit the five files to the same GitHub `main` branch, in their exact paths. Do not upload the ZIP directly.
4. Run the normal GitHub Check.
5. Run **Deploy Sulmos26 to Cloudflare** (the green Hub) to apply additive D1 migration `0005` **and** update the shared backend. Confirm migration succeeds.
6. Run **Deploy SULMOS26 POS (Separate Worker)** (red POS) so both domains have the updated backend/UI.
7. Test: create customer -> new quote -> confirm Q-reference -> with an authorized cashier login on a future Cash Office client, GET `/api/cash-office/quotation?reference=Q-...`. Verify the returned quote exactly matches without a sales order.

## API contract for Cash Office build
- `GET /api/cash-office/quotation?reference=Q-...` – cashier/manager/owner only, exact reference, assigned-store security, returns `{quotation, payment_recorded:false, cash_office_status}`.
- `GET /api/cash-office/quotations?store_id=<id>&q=<search>` – cashier/manager/owner only, assigned-store security, returns quote previews (up to 100).
- The response includes quote line snapshot (`lines_json`), salesperson, customer, store, owner discount and final total. Cash Office must always re-query this server endpoint before taking payment; it must never trust a client-submitted amount.
- These endpoints **cannot mark quotes paid**, accept cash/card/EFT, post stock, or issue tax invoices. Implement those in the later Cash Office system with atomic payment posting, receipts, duplicate-payment controls, cash-up and dispatch release.

## Verification
- Parsed migrations `0001` through `0005` into local SQLite; confirmed older quotes are still searchable without manual sales-order handoff.
- 4 targeted Node tests passed; `node --check public-pos/app.js` passed.
- Full `npm run check` not run locally because required Cloudflare types are unavailable; GitHub check is required.
- The live Cloudflare database and Workers have NOT been accessed or modified by this patch.
