# SULMOS26 V19 — Sales Phase 5: Collections & Delivery Coordination

## What this patch does
- Sales can update collection/delivery instructions on a confirmed sales order.
- Record requested date, contact person, phone, address, and follow-up notes.
- Updates are in a separate audit/history table; quotation amount and order status are not changed.
- Sales may update only their own orders in their assigned store; owner/manager can access store orders.
- Does NOT take payment, mark a sale paid, reserve physical delivery slots, deduct stock, release dispatch, or claim delivery.
- Every saved quotation remains available to Cash Office by quotation number (Phase 3).

## Install
1. Review conflicts with live main before replacing `src/index.ts`; this patch is based on the V18 package.
2. Copy `src/index.ts`, `public-pos/app.js`, `public-pos/styles.css`, `migrations/0007_sales_fulfilment_coordination.sql`, and `tests/sales-fulfilment-phase5.test.mjs` to corresponding GitHub paths.
3. Commit to main and wait for `Sulmos26 Check` to pass.
4. Run green Manager Hub deployment and verify migration 0007 applied.
5. Run red POS deployment and refresh the installed app.
6. Test on a new quotation; confirm order details, then update collection/delivery instructions. Verify the order remains awaiting Cash Office.

## Important
The requested date is NOT a booking. Cash Office and Dispatch must separately verify payment, availability and logistics in later phases. Do not use this as a payment or stock record.
