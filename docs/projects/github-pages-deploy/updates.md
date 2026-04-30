# GitHub Pages Deploy — Updates

## 2026-04-30 — Claude Opus 4.7

### Initial Pages workflow

- **`.github/workflows/pages.yml`** (new): Deploy workflow that uploads `public/` to GitHub Pages on push to `master` (and manual dispatch). Uses official `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`.
- **`docs/projects/github-pages-deploy/plans.md`** (new): Approach, architecture notes, manual steps required of the user, and risks.

### Adjacent fixes required to make the deploy actually work

- **`.github/workflows/ci.yml`**: Changed `on.push.branches` and `on.pull_request.branches` from `main` to `master`. The repo's default branch is `master`, so CI had silently never been running. Pre-existing bug — surfaced while reviewing workflow files.
- **`public/js/env.js`** (committed; was untracked): Firebase web config. The committed `public/js/firebase.js` already imports it; without env.js committed, every page on the deployed site would fail at module load. Per the file's own header, values are public identifiers (security enforced by Firestore rules + Auth), safe to commit.
