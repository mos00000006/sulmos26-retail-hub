SULMOS26 GREEN HUB STARTUP REPAIR

CAUSE VERIFIED: GitHub's public/app.js contains unresolved Git conflict markers such as <<<<<<< HEAD, =======, >>>>>>> and @@ patch markers. Those must not be deployed.

REPLACE ONLY: public/app.js

1. Open https://github.com/mos00000006/sulmos26-retail-hub/edit/main/public/app.js
2. Remove all existing content and paste the full content of app.js included here, or upload this file to public/app.js.
3. Commit to main.
4. Verify Sulmos26 Check succeeds.
5. Run Deploy Sulmos26 to Cloudflare (green manager hub).
6. Test in normal Chrome browser with hard refresh before installed app.

DO NOT modify index.html, the D1 database, or public-pos files.

This file is a rollback recovery version, before V21 stock-entry UI. When the Hub starts, we can reintroduce the stock sync safely.
