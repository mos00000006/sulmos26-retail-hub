SULMOS26 — CLOUDFLARE FIRST-OWNER SETUP FIX V6
================================================

ROOT CAUSE
The original password derivation used 210,000 PBKDF2 iterations in ONE
WebCrypto deriveBits call. Cloudflare workerd rejects more than 100,000
iterations per call (Cloudflare/workerd issue #1346). Therefore the setup
can fail before an owner is saved, despite a green GitHub deployment.

PATCH INSTALLATION
1. Extract this ZIP. In GitHub repo sulmos26-retail-hub, replace exactly:
     src/index.ts
   and add/update:
     tests/setup-recovery.test.mjs
     tests/cloudflare-password-runtime.test.mjs
2. Commit, run 'Sulmos26 Check', then manually run:
     Actions > Deploy Sulmos26 to Cloudflare > Run workflow > main
3. After the green deployment, reload the WORKERS.DEV URL (Ctrl+F5).
4. If you see Sign in, the owner already exists: sign in, do not re-register.
5. If you see Create your business workspace, retry the same setup key
   and owner email/password. Never paste secrets into screenshots or chat.

WHAT CHANGED
- Replaces unsupported single 210k PBKDF2 call with six chained
  100k PBKDF2-SHA-256 calls using domain-separated salts. The new
  hashes have the v2$ prefix. This keeps each invocation below the
  Cloudflare runtime limit while maintaining an expensive derivation.
- Keeps the V5 specific failure codes SETUP_HASH, SETUP_WRITE, SETUP_SESSION.
- No schema changes, database reset, GitHub secrets changes or UI changes.

SECURITY / OPERATIONS
- For customer-commercial deployment, replace the interim chained PBKDF2
  construction with a reviewed Argon2id password-hashing integration and
  a versioned migration strategy, after testing it in Cloudflare.
- Previously-created accounts using the old unversioned hash cannot be
  authenticated by this V6 interim patch. If the setup screen is still
  visible, there should be no such owner. Never delete customer data or
  reset the DB without a separate recovery plan.
- If setup still fails, open Cloudflare > Workers & Pages >
  sulmos26-retail-hub > Logs > Live, attempt setup ONCE and send only
  the error code or a screenshot with all credentials and headers redacted.

Source: https://github.com/cloudflare/workerd/issues/1346
