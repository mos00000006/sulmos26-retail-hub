# SULMOS26 V21 — Hub stock on-hand + clean Sales Desk

## Contents
- `src/index.ts` — extends the shared stock snapshot list beyond the earlier 300 SKU cap.
- `public/app.js` — Hub Stock operations now includes manager/owner stock-on-hand entry by store and SKU. This file was based on the V13 Hub frontend; **COMPARE it with current GitHub code and merge newer work**.
- `public-pos/app.js` — product cards show store-specific `N on hand`, including `0 on hand`, or `Stock not recorded` if no snapshot exists. Refreshes on product refresh and on window focus.
- `public-pos/styles.css` — compact, aligned sales workspace; no tall blank panel stretching.

## Critical business rules
- Hub stock adjustment is an **absolute verified on-hand quantity**, not an increment/decrement.
- Current Hub document approvals (stock documents, GRVs, adjustments) do not automatically post stock movements; this patch does not change that rule.
- There is no live inventory ledger yet: quotations and sales order handoffs do not deduct stock. Deduction requires a future atomic, paid-transaction/dispatch stock ledger. The sales-side snapshot may become stale if nobody verifies new physical movements.
- A SKU with no recorded snapshot shows `Stock not recorded`, not a false zero. A verified zero shows `0 on hand`.
- Reserved quantities are distinct from on-hand. Sales-stock availability can be checked in the stock panel.

## Installation
1. Back up your current `public/app.js`, `src/index.ts`, `public-pos/app.js` and `public-pos/styles.css`. Compare the files to GitHub before replacing; do not overwrite newer customizations.
2. Upload/merge these 4 files into matching GitHub paths.
3. Commit, run `npm run check`, then deploy **Green Manager Hub** and after success **Red POS**.
4. In Hub → Stock operations, manager/owner selects the store + SKU and sets on hand to 5 or 0.
5. In Red POS, select the same store and click `Refresh products`, or switch away/back to the POS tab. Product row should show the same on-hand number.
6. Check a SKU with no stock record shows `Stock not recorded` rather than `0 on hand`.

There is **no migration** in this patch because it reuses Phase 4 `stock_snapshots` and `stock_requests`.
