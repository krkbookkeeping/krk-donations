# Phase 4 — Categories & Payment Methods: Summary

## What Was Built

Two admin screens providing the configurable lookup tables required for donation entry.

## Key Components

| Component | File |
|---|---|
| Categories Alpine component | `public/js/categories.js` |
| Payment Methods Alpine component | `public/js/paymentMethods.js` |
| UI (both sections) | `public/app.html` |
| Badge styles | `public/styles.css` |
| Firestore index | `firestore.indexes.json` |

## Key Decisions

- **Seed on first load**: Both components check if the collection is empty on `init()` and batch-write defaults. This runs once per company and is idempotent — the batch only fires if Firestore returns 0 documents.
- **Locked-receipt guard**: When editing a category, the component queries `donations` where `categoryIds array-contains id` and counts how many are locked. If any are locked, the receiptable toggle is disabled and a save attempt with a changed flag is rejected. This prevents retroactively invalidating an issued receipt's snapshot.
- **No hard delete**: Archive/restore is the only status change. Categories and payment methods in use can still be archived (removes them from dropdowns in Phase 5) while preserving historical data integrity.
- **No separate "in-use" counter field**: Usage count is queried on demand when the edit form opens, not stored as a denormalized counter. At Phase 4 scale (handful of categories, no donations yet), this is negligible. Phase 5 can add denormalized counters if needed.

## Next Phase

Phase 5 — Donations & Allocations.
