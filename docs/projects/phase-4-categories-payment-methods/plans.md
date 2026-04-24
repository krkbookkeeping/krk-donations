# Phase 4 — Categories & Payment Methods: Plans

## Scope

Add two admin screens — Categories and Payment Methods — that provide the lookup tables required for donation entry in Phase 5.

---

## Categories

### Features
- List all categories, ordered by name, with Name / Receiptable / Status / Actions columns
- Create / edit form: name + tax-receiptable toggle
- Archive (soft-delete) and restore
- Seed four defaults on first load when collection is empty: General Donation (receiptable), Event Ticket (non-receiptable), Silent Auction (non-receiptable), Memorial (receiptable)
- Guard: cannot change the `receiptable` flag if any **locked** donation (one attached to an issued receipt) references this category — would invalidate the receipt snapshot

### In-use detection
- On `startEdit(cat)`: query `donations` where `categoryIds array-contains cat.id`
- `inUseCount` — total matching donations (shown as informational warning)
- `lockedUseCount` — how many of those have `locked == true`; if > 0, the receiptable toggle is disabled and saving with a changed flag is blocked with a clear error message

---

## Payment Methods

### Features
- List all payment methods, ordered by name, with Name / Status / Actions columns
- Create / edit form: name only
- Archive and restore
- Seed seven defaults: Cash, Cheque, E-transfer, Debit, Credit Card, Square, Online

---

## Files

| File | Change |
|---|---|
| `public/js/categories.js` | New Alpine component |
| `public/js/paymentMethods.js` | New Alpine component |
| `public/app.html` | Add script imports; replace category/payment-method placeholders with full views |
| `public/styles.css` | Add `.badge.receiptable` and `.badge.non-receiptable` colour variants |
| `firestore.indexes.json` | Add `donations (categoryIds CONTAINS + locked)` index for locked-use query |

---

## Firestore index added

`donations` collection:
- `categoryIds ARRAY_CONTAINS` + `locked ASCENDING` — supports the locked-donation guard query
