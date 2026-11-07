SULMOS26 — GITHUB NPM INSTALL DEPENDENCY FIX V2

1. Unzip this patch.
2. Copy package.json into the ROOT of your sulmos26-retail-hub GitHub repository (replace existing).
3. Commit and push. GitHub will rerun npm install.
4. Do NOT copy this into maliksgroupza (PowerBuild Hub).

This pins wrangler@4.158.0 and @cloudflare/workers-types@5.20261107.1, the versions identified in your GitHub npm ERESOLVE log. This resolves the stated peer dependency mismatch.

If you already committed a package-lock.json with the old versions, update it by running `npm install --package-lock-only --no-audit --no-fund` on a machine with npm registry access and commit the new lockfile. There is no lockfile in the original Sulmos26 V1 ZIP.

Validation: package.json parsed correctly and existing Node tests passed locally. The npm registry is not reachable from this environment, so the complete npm install and GitHub check still need to be verified on GitHub.
