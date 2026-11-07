SULMOS26 V10 APP ICON PATCH

What this patch fixes:
- Chrome install prompt now uses the SULMOS26 mark icon instead of the generic S icon.
- Adds proper PWA manifest.
- Adds install icons (192x192, 512x512, maskable) and Apple touch icon.
- Updates favicon and app title metadata.

Files included:
- public/index.html
- public/manifest.webmanifest
- public/assets/icon-192.png
- public/assets/icon-512.png
- public/assets/icon-maskable-512.png
- public/assets/apple-touch-icon.png
- public/assets/favicon-32.png

How to install:
1. Open your GitHub repository: sulmos26-retail-hub
2. Replace the matching files/folders with the ones from this patch.
3. Commit to main.
4. Run the Deploy Sulmos26 to Cloudflare workflow.
5. After deployment, uninstall the old installed app from your computer.
6. Open the website again in Chrome and choose Install app.

Notes:
- Chrome may keep the old generic icon in cache. Uninstalling the previously installed app and reinstalling usually refreshes it.
- The installed app name will show as SULMOS26 HUB, but the icon itself is just the Sulmos26 mark.
