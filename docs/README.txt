SULMOS26 V13 GitHub test compatibility fix

The prior member-login-v9 test asserted that ONLY owners could POST new staff.
V13 intentionally allows owners and managers to create accounts, but managers may create sales consultants only.
The new test checks these controls and confirms owner-only discounts are audited.

Upload only tests/member-login-v9.test.mjs to the same location in your GitHub repository.
Commit to main and rerun the check. This patch does not touch your website, POS, Worker, or database.
