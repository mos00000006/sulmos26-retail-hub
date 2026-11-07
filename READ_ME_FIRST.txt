SULMOS26 V12 - INSTALL ICON PATCH (MANAGER HUB)

This fixes the app metadata and adds proper Chrome/PWA install assets using the original SULMOS26 symbol, without text on the icon.

IMPORTANT: This ZIP is a PATCH, not a replacement project. It must be extracted first, then the CONTENTS placed into the matching folders in your EXISTING GitHub repository. Never upload the ZIP alone as a repo file.

Replace/add:
public/index.html
public/manifest.webmanifest
public/favicon.ico
public/assets/icon-192.png
public/assets/icon-512.png
public/assets/icon-maskable-512.png
public/assets/apple-touch-icon.png
public/assets/favicon-48.png
.github/scripts/check-pwa.mjs
.github/workflows/deploy.yml

If you already edited .github/workflows/deploy.yml since the original repo was uploaded, do NOT replace it blindly. Instead add the step: - name: Validate installed app icon and manifest / run: node .github/scripts/check-pwa.mjs immediately after npm run check.

DEPLOY
1. Commit all new/updated files to the main branch of mos00000006/sulmos26-retail-hub.
2. Run GitHub Actions -> Deploy Sulmos26 to Cloudflare -> Run workflow.
3. Verify on your site: /manifest.webmanifest?v=12 shows name SULMOS26 HUB and /assets/icon-512.png?v=12 displays the SULMOS26 symbol. If those links show old content, the GitHub files are not yet deployed to the correct Worker.
4. Remove the previous installed Chrome app. In Windows Chrome open chrome://apps and uninstall the old SULMOS26 entry.
5. Hard refresh the website (Ctrl+Shift+R) and install again. The Chrome install dialog should use the logo icon, not the S.

The patch does not touch backend logic, database, accounts or passwords.
