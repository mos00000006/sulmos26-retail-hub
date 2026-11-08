# SULMOS26 V36 — Customer & Store Document Branding

## Purpose
SULMOS26 remains the software name and is shown on installed application icons and application navigation.
Each company using the system may give its own identity to printed documents. A company default can be overridden per store.

## What's included
- `migrations/0013_document_branding.sql` — shared D1 table with company defaults and store overrides
- `public/store-branding.html` — owner-only company/store branding screen on the Green Hub domain
- `src/index.ts` — authenticated store-scoped branding GET plus owner-only POST
- `src/stock-office.ts` — Stock Office authenticated branding lookup
- `src/dispatch.ts` — Dispatch authenticated branding lookup
- `public-cash/app.js` — branded customer paid documents and receipts
- `public-stock/app.js` — branded A4 GRVs, count sheets, stock lists, movement reports; preserves V35 silver Stock Office screen identity
- `public-dispatch/app.js` — branded paid customer copies and picking slips; based on V32 Dispatch UI
- `public-pos/app.js` — branded quotation printout; **this file is from the V20 Sales Desk baseline and must be MERGED with any V21+ changes in GitHub, not blindly replaced**
- `tests/store-branding-v36.test.mjs` — focused source safety checks

## Recommended safe installation
1. Back up your D1 database and commit current code to a known-good GitHub commit.
2. Do NOT replace all current application files indiscriminately; merge into your current source of truth. Specifically compare the Red POS `public-pos/app.js` to the current version because later sales stock-visibility work may exist.
3. Add the SQL migration and branding management page.
4. Merge backend changes in `src/index.ts`, `src/stock-office.ts`, and `src/dispatch.ts` while keeping all newer work.
5. Run `npm run check`, inspect relevant Worker deployment workflows, and fix any changes before deployment.
6. Apply migration `0013_document_branding.sql` to the existing shared D1 database **before** deploying APIs that read this table. All appropriate Worker workflows normally apply pending migrations.
7. Deploy Green Hub, Red Sales Desk, Yellow Cash Office, Silver Stock Office, and Blue Dispatch after each merged Worker backend is ready.
8. Open the branding editor at https://sulmos26-retail-hub.moyanamoses006.workers.dev/store-branding.html
9. Sign in to Green Hub as owner; choose Company Default, enter trading name and upload logo, save. Choose an individual store and override as needed.
10. Print a test quotation, paid customer document, Dispatch picking slip, GRV and count sheet. Confirm correct store name/address/phone/logo.

## Security and correctness
- Only the owner can save branding. Staff can view brand identity only for their assigned store, as enforced in the Worker.
- PNG/JPG/WebP only; the editor resizes the image and the backend limits the data URI.
- Missing store logo falls back to the company logo. Missing label falls back to the store name.
- No customer access to other stores' branding through the API.
- This does not implement legal VAT tax invoicing or alter financial/stock posting rules.
- Currently each installation has its own D1 business record. This is per-installation/per-store branding, **not** a multi-tenant SaaS data-isolation release.

## Local tests
- `node --test tests/store-branding-v36.test.mjs`
- `node --check public-cash/app.js`
- `node --check public-stock/app.js`
- `node --check public-pos/app.js`
- `node --check public-dispatch/app.js`
- TypeScript syntax checked via TypeScript parser; full GitHub/Worker builds not independently verified.
