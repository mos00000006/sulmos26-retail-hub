SULMOS26 V7 — DIAGNOSE FIRST-OWNER SETUP (SAFE, NO RESET)
=========================================================
PURPOSE
Your browser is still showing the old generic "Request could not be completed"
message after attempts at the V5 and V6 recovery patches. V7 establishes
whether the live Worker really has the updated backend and returns stage-
specific errors rather than requiring further guesses.

INSTALL (existing repo: sulmos26-retail-hub)
1. Extract ZIP and copy the src and tests folders into your repo, merging files.
2. Replace src/index.ts and add tests/setup-diagnostics-v7.test.mjs.
   The included logic.mjs and logic.d.mts are unchanged dependencies of index.ts.
3. Commit to GitHub. Check Actions > Sulmos26 Check.
4. IMPORTANT: A green "Sulmos26 Check" does not publish the Worker.
   Go to Actions > Deploy Sulmos26 to Cloudflare > Run workflow > main.
   Wait for this NEW deploy run to finish successfully.

VERIFY THE LIVE DEPLOYMENT WITHOUT SHARING CREDENTIALS
Open this URL (normal browser tab):
https://sulmos26-retail-hub.moyanamoses006.workers.dev/api/version
Expected response:
{"application":"Sulmos26 Retail Hub","version":"V7-SETUP-DIAGNOSTICS"}
If you see 404, another version, or an HTML page, GitHub code is not yet
published to this Worker. Check the deploy log and exact Worker account.

CHECK EXISTING OWNER BEFORE RETRYING
Refresh main app. If "Sign in" appears, use previous owner email/password.
If "Create your business workspace" remains, try setup only once.
- SETUP_DB_READ: D1 query failed (check DB binding and migrations)
- SETUP_HASH: runtime password hashing problem
- SETUP_WRITE: D1 transaction failed (check schema, logs)
- SETUP_SESSION: owner saved, but session creation failed (refresh/sign in)
- SETUP_UNHANDLED: unexpected failure early in request; check Worker logs
- "Owner setup locked": private key/binding mismatch
NEVER delete/recreate D1, publish setup key, or paste password in chat.

WHAT CHANGED
This V7 patch changes only the Worker setup error classification and adds
read-only GET /api/version. No schema, data, UI, marketing, or employee changes.
It does NOT claim to solve an unknown production DB/configuration error;
it makes its cause observable and confirms if the patched code was deployed.
