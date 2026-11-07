# Sulmos26 retail product scope

## Implemented V1
One-time owner setup; editable business profile; independent database; staff roles and store assignments; manual stores and products; secure quotation creation with server-verified price snapshots; printable UNPAID quotes; Cash Office read queue; stock document register with multi-document types and independent sign-off; task list; audit history; responsive dashboard.

## Planned phases (not included in current ZIP)
1. Production-grade auth: login email verification, password resets, two-factor authentication, security telemetry and tested backup recovery.
2. Live inventory engine: verified opening stocks, per-store stock balances, GRV posting, stock adjustment posting, in-transit transfers, stock valuation and reconciliation.
3. Payment processing, invoice numbering / tax controls, cash-office shifts, proper cash/card verification and refunds.
4. Dispatch picking, signed collection/delivery, stock release after verified payments.
5. Purchasing/PO-to-GRV, supplier accounts, debtor accounts, reports, document uploads and product-photo uploads.
6. Licensing, customer billing, tenant provisioning, audit exports and reusable templates.

## Key distinction
Each customer's records belong in its own fresh D1 database. The Sulmos26 brand is a product identity, **not** a pre-populated PowerBuild/Maliks customer database.
