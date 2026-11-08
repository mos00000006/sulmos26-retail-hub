# SULMOS26 V29 — Blue Dispatch Desk

This patch uses the **blue SULMOS26 logo provided by the owner** for the Dispatch app.
Green Hub stays teal, Sales POS stays red and Cash Office stays yellow.

## What it does
- Creates a separate `sulmos26-dispatch` Cloudflare Worker and installable PWA.
- Installs the blue logo/icon (192px, 512px, maskable, Apple and favicon).
- Shows assigned stores and payment-verified orders only, with quotation, receipt, products, collection/delivery details.
- Limits Dispatch login to `dispatch`, `manager` and `owner` roles, and applies server-side store restrictions.
- Read-only in Phase 1: cannot take money, mark orders delivered, release dispatch, or deduct stock.

## Installation
1. Open ZIP and copy all files into the matching repository paths, including the hidden `.github` folder.
2. Do **not** replace `src/index.ts`; this uses separate `src/dispatch.ts` to protect the current Green Hub.
3. Commit to `main`.
4. Ensure `SULMOS26_D1_DATABASE_ID`, `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` secrets remain configured.
5. GitHub → Actions → **Deploy SULMOS26 Dispatch (Separate Worker)** → Run workflow on `main`.
6. Visit the `sulmos26-dispatch` Worker URL from Cloudflare Workers & Pages.
7. In Green Hub Staff & Access, owner creates a `dispatch` role user assigned to the correct store (the Hub must be working to do this).
8. Check that the blue install icon appears when installing. If Windows retains a previous icon, uninstall old shortcut and reinstall.

## Existing database requirements
- Uses existing `users`, `sessions`, `login_attempts`, `stores`, `user_stores`, `quotations`, `sales_orders` and `cash_receipts` tables.
- Requires Cash Office migration `0008` and the V16/V19 sales order migrations to have been applied in the shared D1. No new migration in this patch.
- Dispatch displays *paid receipts* only. A manually observed bank payment without a Cash Office receipt will not appear.
- Payment status is verified against `cash_receipts`, NOT a sales quote status.

## Verification performed
- `node --check` of app.js and deployment script.
- Valid JSON manifest, image size and ZIP contents.
- Full Cloudflare/GitHub deployment and live login still require user verification.
