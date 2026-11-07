# SULMOS26 V18 — Sales Phase 4: Stock Availability & Requests

**IMPORTANT: No live stock ledger exists in the current system.** The figures displayed are management-entered snapshots. Quotes, reservations, transfer approvals and the Cash Office lookup do not move stock.

## Install
1. Extract ZIP. Copy matching files to your GitHub main branch: `src/index.ts`, `public-pos/app.js`, `public-pos/styles.css`, `migrations/0006_sales_stock_requests.sql`, `tests/sales-stock-phase4.test.mjs`.
2. **Before replacing `src/index.ts`**, check your live branch hasn't gained other changes after V17. If it has, merge the V18 stock routes rather than overwriting the file.
3. Commit to main and wait for Sulmos26 Check to be green.
4. Run Green Manager Hub deployment first. Confirm D1 migration `0006` applied successfully.
5. Then run Red POS deployment. Refresh the POS page.
6. Manager selects a product, enters physically verified quantity in the new Stock panel. Sales can view this snapshot, request a reservation or a transfer. Another manager/owner can approve.

## Controls
- Manager snapshot entries are logged. No consultant can enter stock.
- An approved reservation reduces displayed **available** (snapshot minus approved reservations), not physical on-hand.
- Approval checks quantity atomically against current snapshot.
- Creator may not approve their own request.
- Transfer approval creates no shipment or receiving.
- All figures are store scoped, and quotes do not block stock.
- No cash payments or receipts have been added.

## Known limitations
- This is not integrated with GRV, POS sales, adjustment or dispatch ledgers; snapshots can be stale.
- Reservation expiry/release workflow needs to be added before production stock commitment.
- Cross-store snapshot lookup reveals quantities for other active stores only when a product is selected; internal staff only.
- Actual stock posting and warehouse reconciliation are later phases.
