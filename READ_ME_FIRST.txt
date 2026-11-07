SULMOS26 Hub app icon fix (V11) — icon ONLY; no name in the graphic.

IMPORTANT: Do NOT upload this ZIP file into GitHub as-is; GitHub will not extract it.
Extract this ZIP on your computer first.

Upload the supplied public folder CONTENTS to the matching folder in your existing repository.
This patch changes ONLY public/index.html, public/manifest.webmanifest and five public/assets icon PNG files. It does not alter staff, products, database, passwords or application scripts.

Easiest method if using GitHub website:
1. Extract the ZIP.
2. In GitHub go to YOUR repository /public.
3. Add file > Upload files, drag index.html and manifest.webmanifest from the extracted /public folder; commit to main.
4. Open repository /public/assets.
5. Add file > Upload files, drag the five new PNGs from extracted /public/assets; commit to main.
6. Actions > Deploy Sulmos26 to Cloudflare > Run workflow on main.
7. Verify these URLs load:
   https://sulmos26-retail-hub.moyanamoses006.workers.dev/manifest.webmanifest?v=11
   https://sulmos26-retail-hub.moyanamoses006.workers.dev/assets/icon-192.png?v=11
8. Remove any previously installed SULMOS26 app in Chrome (chrome://apps), hard-refresh website (Ctrl+Shift+R), and install it again.

Expected manifest name: SULMOS26 HUB.
If Chrome still shows old title, the new index.html was not deployed or a cached site is open.
