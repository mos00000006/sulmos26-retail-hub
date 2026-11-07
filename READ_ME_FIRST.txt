SULMOS26 — FIRST OWNER SETUP / CLOUDFLARE ERROR RECOVERY V5
==========================================================

FIRST, BEFORE INSTALLING ANYTHING
---------------------------------
1. Refresh the LIVE Sulmos26 Worker page.
2. If it now shows "Sign in" instead of "Create your business workspace", the
   owner may ALREADY have been saved and only the session step failed. Try the
   email and password you just chose. DO NOT create another owner or reset D1.
3. If it still shows the setup form, V5 can identify which stage fails.

INSTALL SMALL PATCH IN EXISTING sulmos26-retail-hub GITHUB REPOSITORY
--------------------------------------------------------------------
Overwrite exactly:
  src/index.ts
Add:
  tests/setup-recovery.test.mjs
DO NOT merge this with PowerBuild/Maliks Hub.
The ZIP intentionally excludes any credentials, database files, project assets
and migrations. No database reset or schema migration is needed.

Commit changes in GitHub and confirm Sulmos26 Check succeeds.
Then open Actions > Deploy Sulmos26 to Cloudflare > Run workflow > main.
A green GitHub check alone does not update the live Worker; deployment must run.

AFTER DEPLOY
------------
Refresh Worker page. If the owner signup is still shown, try once using the
same private installation key, email, and password.
Potential error codes:
 SETUP_HASH    = secure password hashing failed
 SETUP_WRITE   = new owner/business database records could not be written
 SETUP_SESSION = owner was saved, but automatic session creation failed.
                 Refresh the page and try the Sign in form instead.

If an error repeats, open Cloudflare > Workers & Pages > sulmos26-retail-hub >
Observability > Logs (or Logs > Live). Locate SULMOS26_SETUP_<stage>.
Share only the ERROR CODE and redacted error message, never the private setup
key, your password, Cloudflare API token, complete request headers, or HAR.

WHAT V5 CHANGES
---------------
- Prevents repeat owner registration if the owner already exists.
- Distinguishes hashing, database write, and session creation failures.
- Logs stage names, not credentials or data.
- Does not change password hashing, token validation, role permissions,
  transactions, staff, products, database migrations, or UI styling.
- Does not fix an unknown underlying Cloudflare error by itself: it makes
  the failure stage actionable while preserving existing saved accounts.

VERIFICATION
------------
15 local Node tests passed against the V4 project with this patch applied;
includes runtime simulation of valid setup, wrong key, duplicate owner,
failed database write and failed session. Cloudflare live deployment was not run.
