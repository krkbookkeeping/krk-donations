# Phase 5 — Donations & Allocations: Summary

## What Was Built

The core transaction engine: donation entry with a multi-line allocation grid, strict balance validation, and atomic Firestore writes.

## Key Components

| Component | File |
|---|---|
| Donations Alpine component | `public/js/donations.js` |
| Donations UI | `public/app.html` |
| Donation styles | `public/styles.css` |
| Firestore index | `firestore.indexes.json` |

## Key Decisions

- **Integer cents everywhere**: The form stores dollar strings in state (`amountDollars`), which are converted to cents via `toCents()` immediately before validation and write. Floats never touch the database.
- **Save disabled until balanced**: `isBalanced` is a computed getter that returns true only when `totalCents > 0` and `allocatedCents === totalCents`. The save button is also disabled until a donor is selected. The validator enforces the same rule server-side — balance errors surface as field errors, not silent failures.
- **Atomic batch writes**: Both create and edit use `writeBatch`. Create generates an auto-ID ref before the batch so the subcollection can be written in the same commit. Edit fetches old allocation IDs first (outside the batch), then deletes and re-creates them atomically.
- **donorName snapshot**: Stored on the donation doc at write time so the list can display donor names without a join query. If a donor is later merged, the snapshot may be stale — acceptable for Phase 5 MVP.
- **Inline new-donor panel**: Quick donor creation directly inside the donation form with name/email/phone only. Uses the full `validateDonor` validator; newly created donor is auto-selected.
- **Batch mode**: After a save in batch mode, date and payment method are preserved and focus returns to the donor search field. Intended for rapid weekly collection entry.

## Next Phase

Phase 6 — Transactions List & Reporting (full filter bar, CSV export, yearly donor summary report).
