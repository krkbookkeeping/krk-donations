# Print Report Feature — Plans

## Goal

Add a "Print" action on the Reports page that prints the currently-filtered, currently-sorted view with a clean header, filter summary, sort indicator, and user-selected columns. Works for both report types (Transaction Report and Yearly Summary).

## Requirements (from user)

1. Print button alongside Export CSV.
2. Heading: **Donation Report**.
3. Sub-headings showing how the report is filtered (period, categories, payment methods, receiptable status, donor).
4. Output follows the current on-screen sort (column + direction).
5. Sub-heading **Sorted by: ...** just before the table.
6. Column-selection step (checkboxes) **before** printing fires.

## Approach

Use the browser's built-in print pipeline (`window.print()`) with CSS `@media print` rules — no PDF library needed, no extra dependencies, and the user gets the native print preview / Save-as-PDF / paper output.

### State (reports.js)

- `showPrintModal: boolean` — controls the column-picker modal.
- `printColumns: { transaction: {...}, summary: {...} }` — boolean flag per column. Defaults pick a useful subset (Date, Donor, Total, Categories, Receiptable for transaction; Donor, # Donations, Total, Receiptable for summary).
- Computed labels (`printDateLabel`, `printCategoriesLabel`, `printPaymentMethodsLabel`, `printReceiptableLabel`, `printDonorLabel`, `printTransactionSortLabel`, `printSummarySortLabel`) — human-readable strings rendered into the print header.
- `openPrintModal()`, `closePrintModal()`, `triggerPrint()` — `triggerPrint` closes the modal then calls `window.print()` on the next Alpine tick so the updated column visibility is rendered first.

### Markup (app.html)

- **Print button** added to each report's `.report-results-header` (next to Export CSV), only shown when results exist.
- **Print-only header block** (`.print-only.print-report-header`) inserted above each table, containing:
  - `<h1>Donation Report</h1>`
  - Filter list (period, categories, payment methods, receiptable status, donor)
  - Sort label
- **Column visibility** driven via `:class="{ 'print-hide-col': !printColumns.<type>.<col> }"` on every `<th>` and `<td>`. Hidden in print mode only — screen view is unaffected.
- **Print-only totals** block below each table (avoids the existing `<tfoot>` which uses hardcoded colspans that break with hidden columns).
- **Print modal** (uses existing `.modal` / `.modal-backdrop` styles) with column checkboxes and Print / Cancel buttons. One modal that branches its checkbox list on `reportType`.

### Styles (styles.css)

- `.print-only { display: none }` by default.
- `.print-column-checks` — 2-column grid of checkboxes inside the modal.
- `.print-report-header`, `.print-filters`, `.print-sort`, `.print-totals` — typography for the printed page.
- `@media print` rules:
  - Hide page shell: `.topbar`, `.sidebar`, `nav`, `.page-header`, `.report-tabs`, `.report-filters`, `.report-results-header`, `.no-print`, `.modal-backdrop`.
  - Reveal `.print-only` blocks.
  - Hide `.print-hide-col` cells (unchecked columns).
  - Hide existing on-screen `<tfoot>` (replaced by `.print-totals` block).
  - Strip sort indicators / sortable hover styling.
  - `@page { margin: 0.5in }`.

## Why this design

- **No new dependencies.** Uses native print + CSS.
- **Sort follows screen.** Print uses the same `sortedTransactionRows` / `sortedSummaryRows` already on screen — no duplicate sort logic.
- **Column selection doesn't reshape the DOM.** Visibility is toggled by class, so the screen view is unchanged when users open the print picker.
- **Filter summary is derived from existing state.** Computed getters wrap `filterCategories` / `filterPaymentMethods` / etc. into readable strings.

## Out of scope

- Page-break tuning beyond browser defaults (table will break across pages naturally).
- Landscape vs portrait toggle (user picks in the browser's print dialog).
- Saving column-preset preferences across sessions.
- Print for the Donations list page (request is specific to Reports).

## Risks

- **Wide tables** still overflow on narrow paper if the user selects too many columns. Mitigated by sensible defaults; user can re-open the modal and reduce.
- **Print stylesheets can be brittle.** Specifically test: page shell hidden, modal hidden, sort indicators stripped, totals row present.
