SULMOS26 V21 GREEN HUB FULL FILE RECOVERY

This package supplies COMPLETE replacement files for the green HUB only:
 public/app.js (V21 stock controls + standalone safeItems helper)
 public/index.html (cache-busted app script and startup failure messaging)

DO NOT replace any red POS file. DO NOT run database migrations for this package.

GitHub instructions:
 1. Open repository -> public -> app.js, replace its contents with this app.js.
 2. Open repository -> public -> index.html, replace its contents with this index.html.
 3. Commit both files to main.
 4. Run Green Hub deploy workflow.
 5. Open the Green Hub in a Chrome tab, hard refresh, then reopen the installed app.

IMPORTANT: This package reproduces the last local V21 stock hotfix sources.
If your Github branch contains newer Hub edits, replacing them will overwrite those edits.
The actual cause of the user's current loading problem is not verified remotely.
Do not modify or delete the D1 database.
