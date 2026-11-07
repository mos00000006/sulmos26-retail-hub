SULMOS26 POS V15 - ALIGNMENT & SPACING

This patch changes only public-pos/styles.css.
It is based on the V14 Sales Desk stylesheet (the version with stats-grid, three columns, quick actions, and My Quotations).

What it improves:
- Equal width alignment within each grid column and consistent 16px gutters
- Consistent card padding and heading spacing
- Product list fills the product panel without oversized empty areas
- Customer quotation totals align at the bottom of their panel
- Quote statuses and reference numbers wrap safely
- Two-column layout for mid-size laptops and one-column layout on small screens
- More consistent button and form-field heights

TO INSTALL
1. Extract ZIP.
2. Open GitHub sulmos26-retail-hub / public-pos / styles.css.
3. Upload/replace that file, or copy its contents into the GitHub editor.
4. Commit to main.
5. Run only the Deploy SULMOS26 POS (Separate Worker) GitHub workflow.
6. Open the red POS website and hard-refresh (Ctrl+Shift+R).

The green Hub, API, D1 database and POS app.js are untouched.
