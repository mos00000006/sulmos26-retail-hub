SULMOS26 GREEN HUB RECOVERY V22 (ROLLBACK)

This package restores an earlier known Green Hub frontend from before the V21 stock-sync modifications.
It includes the safeItems() helper and retains basic Hub modules, quotations and owner discount interface.
It does not delete or alter any D1 database information.

REPLACE ONLY THESE TWO FILES IN GITHUB:
public/app.js
public/index.html

1. Keep a backup copy of your present files or GitHub commit hash.
2. Replace files in the SAME paths in GitHub, not in a new directory.
3. Commit to main.
4. Run Deploy Sulmos26 to Cloudflare (GREEN HUB) workflow.
5. After success open the green workers.dev URL in Chrome and press Ctrl+Shift+R.
6. Do not change src/index.ts, migrations, database or red POS.

IMPORTANT: This deliberately rolls back the NEW Green Hub V21 stock quantity form. The backend stock records remain; the enhanced stock screen can be restored separately after the Hub loads.

If the screen remains stuck, check browser DevTools (F12 > Console), and the Green Hub deployment's latest run. A browser error is necessary for further diagnosis.
