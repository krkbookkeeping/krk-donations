# Phase 5 — Donations & Allocations: Updates

## 2026-04-24 — Claude Sonnet 4.6 (continued)

### Bug fixes + partial search enhancement

- **`public/js/schemas/donor.js`**: Added `addNgrams()` helper. `donorSearchTokens()` now generates sliding-window substrings (4-6 chars) for phone digits and (3-6 chars) for address line1/line2, enabling partial-number and partial-address searches. Added `donorQueryTokens()` for search-time tokenization — simple normalization, max 10 tokens, stays within Firestore's `array-contains-any` limit.
- **`public/js/schemas/index.js`**: Exported `donorQueryTokens` from barrel.
- **`public/js/donors.js`**: Fixed `loadDonors()` to use `donorQueryTokens(this.searchQuery)` instead of incorrectly calling `donorSearchTokens()` with the raw query string. Added `reindexDonors()` background method (runs on `init()`) to re-tokenize existing donor docs with the new n-gram algorithm. Fixed imports to include `donorQueryTokens`, `db`, and `writeBatch`.
- **`public/js/donations.js`**: Fixed `searchDonors()` to use `donorQueryTokens(q)` instead of a manual `.split()`. Fixed `loadLookups()` to remove status-equality `where` clause (avoided composite-index requirement); now filters client-side. Fixed `searchDonors()` to remove `where("status","==","active")` (same reason); filters client-side. Added `donorQueryTokens` to schema imports.
- **`functions/src/mergeDonors.ts`**: Updated `buildSearchTokens()` to mirror the new n-gram logic: phone → digit string + 4-6 char windows; address lines → word tokens + 3-6 char n-grams.
- **`functions/test/unit/mergeDonors.test.ts`**: Updated phone token assertions to match new format (stripped digits + n-gram windows instead of raw `"416-555-0100"`).

## 2026-04-24 — Claude Sonnet 4.6

### Initial Phase 5 implementation

- **`public/js/donations.js`** (new): Alpine "donations" component. List view with pagination. Create/edit form with donor type-ahead, inline new-donor panel, allocation grid with auto-receiptable, real-time balance bar, and batch mode. Atomic batched Firestore writes (donation + allocations in one commit). Edit replaces allocations atomically. Archive (soft-delete).
- **`public/app.html`**: Added `donations.js` script import. Replaced donations placeholder with full list + form views including the complete allocation grid UI.
- **`public/styles.css`**: Added donation-specific CSS — donor search dropdown, inline new-donor panel, allocation table, balance bar (green/red states), batch mode toggle, lock badge.
- **`firestore.indexes.json`**: Added `donations (status ASC, date DESC)` composite index for the filtered/sorted list query.
