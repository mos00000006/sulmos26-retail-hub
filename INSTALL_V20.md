# SULMOS26 V20 — Sales Phase 6: Reports and Controls

## Upgrade from V19
Files to replace/create:
- `src/index.ts` — adds authenticated, role- and store-scoped `GET /api/sales-performance`.
- `public-pos/app.js` — report filters, consultant scorecard, quotation follow-ups and CSV export.
- `public-pos/styles.css` — report styling.
- `tests/sales-performance-phase6.test.mjs` — new focused tests.

**No new D1 migration** is required; all reports use existing quotation, order and user data. No payment, cash, price-edit, stock movement or dispatch APIs are introduced.

## Deployment
1. Back up your GitHub files. Compare `src/index.ts` with existing `main` if your repository has later commits than V19.
2. Upload these files into the matching folders and commit.
3. Let GitHub `Sulmos26 Check` pass.
4. Deploy the Green Hub Worker first (new API), then the Red POS Worker.
5. Sign in as sales and run a report; confirm it only contains that sales user's records.
6. Sign in as manager/owner, verify multi-consultant totals and store filtering.

## Important reporting definitions
- Quotation value = saved quote totals (not cash received).
- Confirmed order value = handoff order totals (not cash received).
- Both figures filter by their respective creation dates.
- The order/quote count ratio is NOT a conversion rate for the same quotation cohort.
- Follow-up list flags quotes at least three days old without a sales order, max 75. These are leads to contact, not confirmed sales or payment requests.
- All data is scoped in the backend; sales consultants cannot retrieve other consultants' performance.
- No targets or commission engine in V20; those require agreed KPI targets and actual paid-sales feed from Cash Office.
