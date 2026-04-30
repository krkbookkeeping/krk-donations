# Phase 6 — Reports: Updates

## 2026-04-24 — Claude Sonnet 4.6

### Initial implementation

- **`public/js/schemas/donation.js`**: Added `receiptableAmountCents` to the `validateDonation()` return value — sum of `amountCents` for all receiptable allocations. Stored on every donation doc going forward. Donations saved before this field exist will show $0 receiptable in reports.
- **`public/js/reports.js`** (new): Alpine "reports" component. Transaction report with date-range, multi-select category, multi-select payment method, receiptable status, and donor filters — all applied client-side after a single Firestore query scoped by date + status (uses existing composite index). Yearly summary aggregates per-donor totals client-side. CSV export for both report types.
- **`public/app.html`**: Added `reports.js` script tag. Replaced "Coming in Phase 6" placeholder with full reports UI: report-type tabs, filter card, Run/Reset buttons, results table with footer totals, Export CSV button.
- **`public/styles.css`**: Added report CSS — `.report-tabs`, `.report-filters`, `.filter-group`, `.filter-label`, `.filter-count`, `.filter-row`, `.filter-checks`, `.check-item`, `.filter-radios`, `.donor-selected-tag`, `.report-results`, `.report-table` with right-aligned `.num` columns.
