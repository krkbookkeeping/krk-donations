# GitHub Pages Deploy — Updates

## 2026-04-30 — Claude Opus 4.7

### Initial Pages workflow

- **`.github/workflows/pages.yml`** (new): Deploy workflow that uploads `public/` to GitHub Pages on push to `master` (and manual dispatch). Uses official `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`.
- **`docs/projects/github-pages-deploy/plans.md`** (new): Approach, architecture notes, manual steps required of the user, and risks.
