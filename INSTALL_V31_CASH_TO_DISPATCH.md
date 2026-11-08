SULMOS26 V31 — Cash Office → Dispatch (paid-document, picking, handover)

THIS IS AN INCREMENTAL PATCH — preserves Cash Office V28 yellow and Dispatch V29 blue logos.

Files to upload to their exact GitHub locations:
- src/dispatch.ts
- public-dispatch/app.js
- public-dispatch/styles.css
- public-dispatch/index.html
- public-cash/app.js
- public-cash/index.html
- migrations/0009_dispatch_fulfilment.sql
- .github/workflows/deploy-dispatch.yml
- tests/dispatch-v31.test.mjs

DO NOT upload the entire ZIP into the repository root. Do not replace the Green Hub public/ folder,
main src/index.ts, or Cash Office/Dispatch logo assets. This patch does not require new credentials.

HOW IT WORKS
1) Red Sales Desk saves quote. Quotation remains unpaid.
2) Cash Office checks exact quote, verifies funds and records payment in existing cash_receipts table.
3) Cash Office prints a PAID CUSTOMER INVOICE / COLLECTION COPY with stable 'INV-' reference derived from
   the receipt reference. This is NOT A VAT TAX INVOICE. A compliant tax invoice still needs business VAT
   details and separate implementation.
4) Dispatch shows all cash_receipts for its assigned store as PAID, automatically refreshes while idle
   approximately every 15 seconds (or Refresh button). Staff can print a picking slip and paid copy.
5) Dispatch progresses Awaiting Picking → Picking → Ready → Released. Final release requires recorded
   payment, proper state, assigned-store access and the recipient's name, with staff/time audit in D1.
6) Stock is NOT automatically deducted. Manual reconciliation remains required until the dedicated
   inventory-posting flow is built and tested. Refunds/reversals are not yet included.

INSTALL IN THIS ORDER
A. Back up the existing repository and Cloudflare D1 database (recommended before migrations).
B. Copy the nine files above into their matching paths, commit to main.
C. Confirm 'Sulmos26 Check' passes.
D. Run GitHub Actions → 'Deploy SULMOS26 Dispatch (Separate Worker)'. The workflow now applies migration
   0009 to the existing shared D1 first and then deploys Dispatch.
E. Run GitHub Actions → 'Deploy SULMOS26 Cash Office (Separate Worker)' to publish the paid customer copy.
   DO NOT run an older Cash Office ZIP which might overwrite V28 branding.
F. On Windows, close/reopen both apps; refresh browser if cached.

TEST
1. Sign in to Dispatch with an assigned Dispatch account; pick the correct store.
2. Create a test quotation in Sales, record a test payment in Cash Office and print customer copy.
3. In Dispatch, refresh; confirm new invoice is PAID and amount matches receipt.
4. Print picking slip; mark Picking, then Ready.
5. Enter invoice number in verification box. Ensure it returns PAID.
6. Record person receiving goods and release once. Try releasing again: should be blocked.
7. Confirm an unpaid quotation never enters paid order queue and fails the verification endpoint.

SAFETY / LIMITATIONS
Cash Office is only software-recorded payment confirmation; for card/EFT, confirm independently in terminal/bank.
This patch is NOT a VAT-compliant tax-invoice generator and does not integrate a fiscal printer or tax profile.
This patch does NOT perform automatic stock deductions, refunds or accounting postings.
Until those modules are ready, keep your existing manual stock and accounting controls.

LOCAL CHECKS
- JavaScript syntax for both frontends.
- TypeScript strict compile of src/dispatch.ts against minimal Cloudflare interface stubs.
- 7 focused Node tests (structural assertions).
- SQLite migration/transition/duplicate record smoke test.
Full GitHub checks and remote Worker behavior are not independently verified.
