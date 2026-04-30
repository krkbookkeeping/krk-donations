# GitHub Pages Deploy — Plans

## Goal

Publish the static frontend in `public/` to GitHub Pages so the app is reachable at `https://krkbookkeeping.github.io/krk-donations/` without changing the existing Firebase backend (Auth, Firestore, Functions, Storage).

## Approach

Use a **GitHub Actions workflow** to deploy `public/` to Pages. GitHub Pages' "deploy from a branch" mode only supports `/` or `/docs` as the source folder — it cannot serve from `/public` directly. A workflow avoids restructuring the repo and re-pointing `firebase.json`.

## Architecture notes

- Frontend (`public/`): pure static — HTML, ES module JS, CSS. Loads Firebase JS SDK from `gstatic.com` CDN. No build step needed → upload `public/` as-is.
- Firebase config (`public/js/env.js`): safe to commit. The apiKey/projectId/etc. are public identifiers; security is enforced by Firestore rules + Auth.
- Backend (`functions/`): unaffected. Pages serves only the static frontend; the frontend continues to call Cloud Functions via the Firebase SDK against the deployed `krk-donations` project.

## Workflow design

`.github/workflows/pages.yml`:

- Triggers on push to `master` and manual `workflow_dispatch`.
- Uses official `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`.
- Uploads `./public` as the artifact root → `index.html` becomes the site landing page.
- Concurrency group `pages` prevents overlapping deploys.
- Permissions: `pages: write`, `id-token: write` (required by `deploy-pages`).

## Out of scope (manual user steps)

These cannot be done from the workflow:

1. **Enable Pages** in repo settings → Pages → Source = "GitHub Actions" (one-time).
2. **Add authorized domain** in Firebase Console → Authentication → Settings → Authorized domains → add `krkbookkeeping.github.io`. Without this, sign-in fails with `auth/unauthorized-domain`.
3. **Commit untracked frontend files** (`public/js/env.js`, `public/js/receipts.js`, `public/js/reports.js`, `public/js/settings.js`) — these are required by `app.html` but currently untracked. Without them the deployed site will 404 on those imports.

## Risks / things to watch

- **CORS on Cloud Functions**: callable functions from the Firebase SDK include the auth header automatically and don't require CORS config. HTTP onRequest functions (none currently) would need explicit CORS for the new origin.
- **Firestore rules**: rely on `request.auth.token.companyId` and email allowlists, not origin — no change needed.
- **Existing CI workflow** (`ci.yml`) triggers on `main`, but the actual branch is `master`. Pre-existing bug, not in scope here, but worth flagging.
- **Subpath hosting**: site lives at `/krk-donations/` not `/`. All current asset references in `index.html` and `app.html` are relative (`./js/...`, `styles.css`), so they work correctly under a subpath.
