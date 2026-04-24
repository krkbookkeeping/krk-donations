# Phase 3 — Donor Management: Plans

## Scope

Implement the full donor management module: list, detail, create/edit, archive/restore, duplicate detection, and merge.

---

## Components

### Cloud Function: `mergeDonors`

- `runMerge(callerUid, data)` — exported for unit testing
- Steps:
  1. Validate input (companyId, primaryId, secondaryIds)
  2. Verify caller is a company member
  3. Transaction: update primary fields, archive secondaries, write audit entry
  4. Batched writes (499/batch): reassign donations from secondaryIds → primaryId
- Field sanitization: only allow known donor fields (firstName, lastName, orgName, email, phone, address, preferredContact, notes)
- Recompute searchTokens after merge

### Frontend: `public/js/donors.js`

Alpine.data component with four views:
- `list` — paginated donor table with search + status filter
- `detail` — donor info cards, recent donations, YTD receiptable total
- `form` — create/edit form with duplicate detection warning
- `merge` — two-step: select secondaries → resolve conflicts → confirm

### HTML: `public/app.html`

Replace "Coming in Phase 3" placeholder with full `x-data="donors"` section containing all four views.

### CSS: `public/styles.css`

Add donor-specific classes: `.page-header`, `.filters-bar`, `.clickable-row`, `.badge`, `.detail-grid`, `.detail-card`, `.warning-card`, `.merge-primary`, `.merge-selected`, `.conflict-row`, etc.

### Firestore Indexes: `firestore.indexes.json`

- `donors`: `(status ASC, lastName ASC)` — filtered list
- `donations`: `(donorId ASC, date DESC)` — recent donations query
- `donations`: `(donorId ASC, hasReceiptable ASC)` — YTD receiptable query

---

## Duplicate Detection Strategy

Two-layer check:
1. Exact email match via Firestore query
2. Client-side Levenshtein distance (≤2) on lastName + phone prefix (first 6 digits)

---

## Unit Tests

- `buildSearchTokens`: tokenization correctness, deduplication, lowercase
- `runMerge` validation branches: all throw `HttpsError("invalid-argument")` before Firestore is touched
