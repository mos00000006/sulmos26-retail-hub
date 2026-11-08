# SULMOS26 V34 — Professional Stock & Back Office (Foundation)

This is a **separate Stock Office Worker**, deliberately designed not to replace your recently repaired Green Hub or the Red Sales, Yellow Cash, or Blue Dispatch applications.

## Included
- Stock on hand with recorded, reserved, available quantities and missing stock distinctly marked "Not recorded".
- Approved inventory movement history linked to GRVs/stock counts where applicable.
- GRV capture: supplier, invoice/delivery note reference, SKU and quantity, notes, draft/submission/independent approval.
- Physical stock counts: record physical counts and the corresponding system balance at capture. Changes since the count was recorded block posting and require recount.
- Printable A4: stock list, signed GRV, blank receiving sheet, signed count sheet, blank blind count sheet, immutable movement register.
- Role-restricted Stock Office login: owner / manager / stock, store scoping for stock staff.
- Inventory posting only upon APPROVAL. All approved changes create append-only ledger entries, which update Sales stock availability through the existing V32 triggers.

## Files (new only — do not overwrite existing app files)
- src/stock-office.ts
- public-stock/index.html
- public-stock/manifest.webmanifest
- public-stock/app.js
- public-stock/styles.css
- public-stock/assets/icon-192.png
- public-stock/assets/icon-512.png
- migrations/0012_stock_office_documents.sql
- .github/scripts/prepare-stock-office-deploy.mjs
- .github/workflows/deploy-stock-office.yml
- tests/stock-office-v34.test.mjs

## Installation
1. Back up production D1 and current GitHub repository. Do not deploy during live trading.
2. Ensure all migration versions through `0011` are applied, and V32 inventory ledger is working.
3. Upload only the new files to the paths above and commit to `main`.
4. Confirm `npm run check` passes. If an older test fails, fix it rather than skipping checks.
5. In GitHub Actions run `Deploy SULMOS26 Stock Office (Separate Worker)` on `main`.
6. This runs migration 0012 against the **existing** D1, then deploys Worker `sulmos26-stock-office`.
7. Open expected Worker URL `https://sulmos26-stock-office.moyanamoses006.workers.dev/` only after the workflow is green; Cloudflare may assign a different route depending on account configuration.
8. Sign in as owner/manager or an assigned stock user. Start with a TEST store/product and print a stock list.
9. Create a GRV as a stock clerk; submit it; sign in as a different manager or owner to approve; confirm Sales sees updated stock.
10. Create a count with an existing system balance and independently approve it, confirm variance in movement history.

## What this does NOT yet do (important for commercial-grade back office)
- Purchase order matching (two/three-way matching), product-level unit cost/VAT accounting, supplier-credit posting, or attachment evidence.
- Automatic physical receiving on GRV draft. A manager independently APPROVES to post stock; no stock changes before that.
- Blind count multi-user assignment, recount signatures in software, device-connected barcode scanner setup, label generation and PDF download; print uses browser print to A4 / Save as PDF.
- Transfers, supplier returns, damaged-stock quarantine, bin locations, stock valuation and GRV-to-PO matching need subsequent controlled modules.
- An approved GRV is an internal receiving voucher, **not an accounting invoice**. Stock ledger movement reason is stored as `stock_adjustment` for compatibility with V32; the linked document clearly identifies it as a GRV or Count.
- Current stock quantities are integer units only. Fractional packs, lengths or weight units require a UOM conversion model before use.

## Testing
- Stock Office front end JS syntax check: passed locally.
- Stock Office TypeScript strict check with D1 interface stubs: passed locally.
- Five focused structural tests passed locally.
- SQLite tests: approved GRV +4, stock count -3, distinct approval, stale count rejection passed.
- Full GitHub check, Cloudflare migration and real printing remain **unverified** until your production workflow completes.

## Safety
No existing application frontend or core backend files are replaced. No unauthorised posting. A posted stock movement remains immutable; reversals should use a new approved adjustment rather than overwriting history.
