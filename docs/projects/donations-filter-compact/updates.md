# Donations List — Filter + Compaction Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/donations.js`**: Added `filter` state object (`dateFrom`, `dateTo`, `donor`, `totalMin`, `totalMax`, `paymentMethodId`, `receiptable`), `clearFilters()` method, and `hasActiveFilters` computed getter. Reworked `sortedDonations` to apply filters before sorting; template binding unchanged.
- **`public/app.html`**: Added a compact `.donations-filters` row above the donations table with date range, donor text, total min/max, payment select, receiptable select, and a Clear button shown only when filters are active. Wrapped the table in `.report-table-wrap` and applied the `.report-table` class so it picks up the same compact styling as the Reports page.
- **`public/styles.css`**: Added `.donations-filters` flex-row styling plus tightened input/select sizing inside it.
