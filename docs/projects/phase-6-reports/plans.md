# Phase 6 — Reports: Plan

## Scope

Two reports accessible from the Reports nav tab:

1. **Transaction Report** — filterable list of all donations in a period
2. **Yearly Summary** — per-donor totals aggregated across a full year

## Schema Change

`validateDonation()` currently stores `hasReceiptable` (bool) on the donation doc
but not the actual receiptable dollar amount. Add `receiptableAmountCents` so the
summary report can aggregate without reading every allocation subcollection.

```
value.receiptableAmountCents = allocations
  .filter(a => a.receiptable)
  .reduce((sum, a) => sum + a.amountCents, 0);
```

Donations saved before this field was added will show $0 receiptable in reports.

## New Component: `reports.js`

Alpine.data("reports") with:

### State
- `reportType` — "transaction" | "summary"
- `filterDateMode` — "year" | "custom"
- `filterYear` — integer (default current year)
- `filterDateFrom` / `filterDateTo` — ISO strings for custom mode
- `filterCategories` — array of selected categoryIds (multi-select via checkboxes)
- `filterPaymentMethods` — array of selected paymentMethodIds
- `filterReceiptable` — "all" | "yes" | "no"
- `filterDonorId` / `filterDonorName` / `filterDonorQuery` — donor filter
- `transactionRows` / `summaryRows` — result arrays
- `reportLoading` / `reportRun` — UI state

### Firestore query
```
where("status","==","active")
+ where("date",">=", from)
+ where("date","<=", to)
+ orderBy("date","desc")
```
Uses existing composite index `(status ASC, date DESC)` — no new index needed.
All other filters (category, payment method, receiptable, donor) applied client-side.

### Computed totals
- `transactionTotal` — sum of `totalAmountCents` across rows
- `transactionReceiptableTotal` — sum of `receiptableAmountCents` across rows
- `summaryTotal` / `summaryReceiptableTotal` — same for summary

### CSV export
Client-side only — builds a CSV string, creates a Blob, triggers a download link.

## app.html Changes

- Add `<script type="module" src="js/reports.js"></script>`
- Replace `<div><h1>Reports</h1><p>Coming in Phase 6.</p></div>` with full UI
- Structure: tabs → filters card → [Run Report] → results table with footer totals

## styles.css Additions

- `.report-tabs` — tab button group
- `.report-filters` — filter card
- `.filter-group` / `.filter-label` / `.filter-checks` / `.filter-radios`
- `.filter-count` — muted count badge
- `.report-results` / `.report-results-header`
- `.report-table` — borderless table with right-aligned number columns (`.num`)
