# Phase 7 — Settings & Receipts: Plan

## Scope

### Settings tab
Form to configure per-company fields required for CRA-compliant receipts:
- Legal name, CRA charity number
- Organization mailing address (printed on receipts)
- Authorized signatory name + title
- Receipt template: header text, body text, footer text (optional)
Stored at `companies/{id}/settings/org` (already writable by client per security rules).
Validated by existing `validateOrganizationSettings()` schema.

### Receipts tab
Two sub-views: **Pending** (donors with unlocked receiptable donations) and **Issued**.

**Pending flow:**
1. Year selector → query active donations with `hasReceiptable:true`, `locked:false` for that year
2. Aggregate by donor → show table of donors + receiptable totals
3. "Generate Receipt" → calls `generateReceipt` Cloud Function

**Issued flow:**
- List receipts for the selected year (from `companies/{id}/receipts`)
- Download PDF (regenerated client-side from stored receipt snapshot)
- Void (calls `voidReceipt` Cloud Function)

## Cloud Functions

### `generateReceipt`
Input: `{ companyId, donorId, year }`

Steps (Admin SDK, bypasses security rules):
1. Verify caller membership
2. Fetch org settings — error if legalName or charityNumber missing
3. Fetch donor doc for name + address snapshot
4. Fetch all donations where `donorId==X` — filter by year, status=active,
   hasReceiptable=true, locked=false in code (avoids composite index)
5. Firestore transaction:
   a. Read `counters/receipts.nextNumber` (create doc if first receipt)
   b. Format receipt number as `YYYY-NNNN` (zero-padded, globally sequential)
   c. Increment counter
   d. Write `receipts/{newId}` with full snapshot (orgSettings, donor, donations)
   e. Update each included donation: `locked = true`
6. Return receipt data for client-side PDF generation

### `voidReceipt`
Input: `{ companyId, receiptId }`

Steps:
1. Verify membership + fetch receipt
2. Transaction: set `receipts/{id}.status = "void"` + unlock all included donations

## PDF Generation (client-side jsPDF)
- Loaded via CDN (`window.jspdf.jsPDF`)
- Generated from the receipt data returned by the Cloud Function (generate) or stored in Firestore (re-download)
- Letter size, CRA-required fields: donor name/address, org name/charity #, receipt number, year, donation table, total eligible amount, signatory

## Indexes needed
No new composite indexes — pending query uses existing `(status ASC, date DESC)`.

## Security rules
No changes needed — `counters` and `receipts` are already server-write-only.
