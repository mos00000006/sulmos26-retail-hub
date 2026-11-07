SULMOS26 V3 — GITHUB TYPESCRIPT BUILD FIX

Error addressed:
src/index.ts(58): Property 'n' does not exist on type '{}'. (5 occurrences)

The overview endpoint uses a D1 database batch containing five COUNT(*) AS n queries. Cloudflare's D1 TypeScript result rows are generic, so directly accessing row.n causes TS2339. The fix introduces one typed count helper and uses it for stores, products, quotations, documents and tasks.

INSTALL THE SMALL PATCH (recommended if V2 is already in GitHub):
1. Extract Sulmos26_GitHub_TS2339_Overview_Counts_V3_PATCH.zip.
2. Copy its src/index.ts into your sulmos26-retail-hub repository, replacing the original file.
3. Copy tests/overview-counts.test.mjs to the existing tests folder.
4. Commit and push. GitHub Actions will rerun npm run check.

ALTERNATIVE: If starting from scratch, use the full V3 GitHub ZIP in a NEW repository.

This change does not touch your logo, customer data, prices, permissions, database, PowerBuild Hub or any migrations.

Validation: node --test tests/*.test.mjs passed in the working container. The complete npm run build cannot be performed in this environment because the project's Cloudflare/TypeScript node_modules are not installed. GitHub CI must confirm that final typecheck and deployment pass.
