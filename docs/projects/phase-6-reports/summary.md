# Phase 6 — Reports: Summary

## What was built

**Transaction Report** — a filterable list of all donations in a date range:
- Filters: year or custom date range, multi-select category, multi-select payment method, receiptable status (all / yes / no), single donor search
- Results table: date, donor, total, receiptable amount, payment method, reference #, notes
- Footer row with column totals
- CSV export includes donor email and full address (fetched from donor docs in chunks)

**Yearly Summary Report** — per-donor aggregation for a selected year:
- Groups all donations by donor, summing total and receiptable amounts and counting records
- Results table: donor name, # donations, total, receiptable total
- CSV export includes donor email and full mailing address for mail-merge use

## Key decisions

- **Client-side filtering**: Firestore query fetches all active donations in the date range using the existing `(status, date)` composite index. Category, payment method, receiptable, and donor filters are applied in JavaScript — avoids additional composite indexes and keeps the query simple.
- **Donor address fetch**: addresses are not stored on donation documents. After the donation query, donor IDs are batched into groups of 30 and fetched via `where(documentId(), "in", chunk)` to stay within Firestore's `in` limit.
- **`receiptableAmountCents` on donation docs**: added to `validateDonation()` return value in `donation.js` so the transaction report can display the receiptable portion without querying allocations. Donations saved before this field will show $0 receiptable.

## New features
- Transaction report with multi-criteria filtering and CSV export
- Yearly donor summary report with CSV export (suitable for mail-merge and year-end donor letters)
