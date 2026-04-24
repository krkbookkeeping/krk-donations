# Phase 3 — Donor Management: Updates

## 2026-04-24 — Claude Sonnet 4.6

### Initial Phase 3 implementation

- **`functions/src/mergeDonors.ts`** (new): `runMerge()` exported function + `mergeDonors` onCall. Atomic transaction for donor updates and archival; batched writes for donation reassignment. Exported `buildSearchTokens` for unit testing.
- **`functions/src/index.ts`**: Added import + re-export of `mergeDonors`.
- **`public/js/donors.js`** (new): Full Alpine "donors" component — list/detail/form/merge views, Levenshtein duplicate detection, validateDonor integration.
- **`public/app.html`**: Replaced Phase 3 placeholder with complete donor UI (all four views, inline conflict resolution, merge confirmation).
- **`public/styles.css`**: Added donor-specific CSS classes (page-header, filters-bar, badges, detail-grid, detail-card, warning-card, merge row highlights, conflict resolution, danger button, small button).
- **`firestore.indexes.json`**: Added three composite indexes — donors `(status, lastName)`, donations `(donorId, date DESC)`, donations `(donorId, hasReceiptable)`.
- **`functions/test/unit/mergeDonors.test.ts`** (new): Unit tests for `buildSearchTokens` and `runMerge` input validation (8 tests for tokens, 7 tests for validation).
- **`.link-button`** CSS scope changed from `.topbar .link-button` to global `.link-button` to support the duplicate-warning "View" link in the donor form.
