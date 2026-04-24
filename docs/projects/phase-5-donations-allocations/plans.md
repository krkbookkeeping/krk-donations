# Phase 5 — Donations & Allocations: Plans

## Scope

The core transaction engine: create/edit donations with a multi-line allocation grid that must balance exactly. Batch entry mode for rapid weekly input.

---

## Donation entry form

### Donor selection
- Debounced type-ahead (250ms) queries donors via `searchTokens array-contains-any`
- Dropdown shows up to 8 matches with name + email
- Inline "New Donor" panel expands below the search box — quick-add with name/email/phone only (no address). Newly created donor is auto-selected.

### Core fields
- Date (default today, YYYY-MM-DD)
- Total amount (dollar input → stored as integer cents)
- Payment method (dropdown from active paymentMethods)
- Reference number (optional — cheque #, e-transfer ID)
- Notes (optional)

### Allocation grid
- Table rows: Category (dropdown, active categories) | Amount (dollar input) | Receiptable (auto-derived from category, read-only checkbox) | Remove
- Category change auto-populates the receiptable flag from the category doc
- Enter on the last row's amount field adds a new row
- Minimum 1 row (remove disabled when only 1 row)

### Balance bar
- Shows: `Allocated $X.XX / Total $Y.YY` + difference
- Green when balanced (difference = 0), red when unbalanced
- Save button disabled until balanced AND donor selected
- Validator enforces the same constraint server-side (in validateDonation)

### Batch mode toggle
- After saving in batch mode: keep date + payment method, reset donor/amount/allocations
- Used for rapid entry of weekly collections

---

## Donation list
- Columns: Date | Donor | Total | Payment | Rec. (yes/no badge) | Actions
- Status filter: only shows `status == "active"` donations (archived hidden)
- Ordered by date DESC
- Paginated with Load More (50 per page)
- Actions: Edit (disabled with lock icon for locked donations), Archive

---

## Firestore write strategy

**Create**: generate auto-ID doc ref via `doc(companyCollection("donations"))`, then `writeBatch.set()` for the donation doc + all allocation docs (subcollection). Single atomic commit.

**Edit**: fetch existing allocation doc IDs, then `writeBatch.update()` donation + `writeBatch.delete()` old allocations + `writeBatch.set()` new allocations. Single atomic commit.

---

## Data fields stored

Donation: all from `validateDonation.value` (donorId, date, totalAmountCents, paymentMethodId, referenceNumber, notes, locked, categoryIds[], hasReceiptable) + `donorName` snapshot for list display + `status: "active"` + `createdBy` (uid).

Allocations: categoryId, amountCents, receiptable (boolean snapshot at write time).

---

## Indexes added

- `donations (status ASC, date DESC)` — paginated list filtered to active donations
