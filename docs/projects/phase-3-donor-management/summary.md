# Phase 3 — Donor Management: Summary

## What Was Built

A complete donor management module covering the full lifecycle: list, create, edit, archive/restore, duplicate detection, and multi-donor merge.

## Key Components

| Component | File | Notes |
|---|---|---|
| Merge Cloud Function | `functions/src/mergeDonors.ts` | Atomic transaction + batched donation reassignment |
| Donor Alpine component | `public/js/donors.js` | Four views: list / detail / form / merge |
| Donor UI | `public/app.html` | Inline conflict resolution, YTD receiptable display |
| Styles | `public/styles.css` | ~160 lines of donor-specific CSS |
| Firestore indexes | `firestore.indexes.json` | Three composite indexes for donor queries |
| Unit tests | `functions/test/unit/mergeDonors.test.ts` | 15 tests covering tokens + input validation |

## Key Decisions

- **Merge atomicity**: Donor field updates and secondary archival run in a single Firestore transaction. Donation reassignment runs in batches of 499 outside the transaction — it is idempotent on retry if the function is interrupted.
- **Field sanitization in merge**: Server enforces an allowlist of donor fields; the client cannot overwrite system fields (status, searchTokens, createdAt, etc.) via the merge call.
- **Duplicate detection**: Two-layer check — exact email match via Firestore query, then client-side Levenshtein (≤2) on lastName combined with first-6-digits phone match. Runs before every create/edit save.
- **Search tokens**: Lowercased n-grams stored on the donor document; searched via `array-contains-any`. Token limit of 10 applied on the query side to stay within Firestore bounds.
- **YTD receiptable**: Computed client-side by fetching allocations subcollections for the current calendar year. Will move to a server-side aggregate when Phase 5 introduces donation write paths.

## Next Phase

Phase 4 — Categories and Payment Methods.
