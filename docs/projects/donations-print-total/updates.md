# Donations List — Print + Total Footer Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/donations.js`**: Added `showPrintModal`, `printColumns` state, `openPrintModal` / `closePrintModal` / `triggerPrint` methods, `filteredTotalCents` getter, and computed labels for the print header (`printDateLabel`, `printDonorLabel`, `printTotalRangeLabel`, `printPaymentLabel`, `printReceiptableLabel`, `printSortLabel`).
- **`public/app.html`**: Added a Print button at the right end of the donations filter bar; new on-screen `<tfoot>` row showing the filtered Total; print-only header block above the table with title + filter summary + sort label; print-only totals block below the table; `:class="{ 'print-hide-col': !printColumns.<col> }"` on every `<th>` and `<td>`; print column-selection modal at the end of the donations component.
- **`public/styles.css`**: No new rules — reuses existing `.print-only`, `.print-report-header`, `.print-filters`, `.print-sort`, `.print-totals`, `.print-modal`, `.print-column-checks`, and the `@media print` block from the reports work.
