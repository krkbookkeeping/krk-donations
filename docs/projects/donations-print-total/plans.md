# Donations List — Print + Total Footer Plans

## Goal

1. Add a **Print** action on the Donations list that prints whatever is currently shown (filters + sort applied) with a clean header and a column picker — mirrors the Reports pattern.
2. Add a **Total** footer row to the table summing the Total column across the currently-visible (filtered) rows.

## Approach

### Print

Reuse the print pipeline already built for Reports:

- `showPrintModal` + `printColumns` state in the donations Alpine component.
- `openPrintModal()` / `closePrintModal()` / `triggerPrint()` methods (the last calls `window.print()` on the next Alpine tick).
- Print-only header block above the table containing:
  - `<h1>Donations List</h1>`
  - Filter summary (Period / Donor / Total range / Payment / Receiptable)
  - **Sorted by:** label
- Column visibility driven by `:class="{ 'print-hide-col': !printColumns.<col> }"` on every `<th>` / `<td>` (uses the existing `.print-hide-col` rule under `@media print`).
- Reuse the existing `.print-only`, `.print-report-header`, `.print-filters`, `.print-sort`, `.print-totals`, and modal CSS classes — zero CSS additions needed.

**Print columns offered:** Date, Donor, Total, Payment, Receiptable. The Actions column is screen-only (no point printing edit/archive buttons), so it's hidden in print via `@media print { .no-print { display: none } }` on the `<th>`/`<td>` for actions.

**Defaults:** all five print columns on. The user can untick before printing.

### Total footer

- New `get filteredTotalCents()` — sums `totalAmountCents` across `sortedDonations` (which is already filtered).
- New `<tfoot>` row showing **Total** spanning the first columns and the dollar total under the Total column. Render only when there are rows visible.
- The footer is part of the on-screen table; it's also visible when printed (the `.report-table tfoot` is hidden by `@media print` rules — but that was for the Reports tfoot to avoid colspan issues with hidden columns. For the donations table the issue is the same: hidden columns make colspans wrong. So use a separate `.print-only.print-totals` block below the table for the printed total, matching the Reports approach.

## Why this design

- **Reuse, don't rebuild.** Every print helper (CSS, modal pattern, `.print-only` blocks, `triggerPrint`) already exists for Reports. The donations page just plugs into the same machinery.
- **Total footer separate from print totals.** On screen the existing-style `<tfoot>` is the most natural place. For print, the existing rule that hides the on-screen tfoot still applies, so we add a small `.print-only.print-totals` block beneath the table — same as Reports does.

## Out of scope

- Server-side full-dataset print (donations list is paginated; print prints what's loaded + filtered, same as the on-screen view). For full-history printing, the Reports page is still the right tool.
- Per-row receiptable-amount totals (the donations list shows Yes/No badges, not dollar amounts).
- Persisting print column preferences.

## Risks

- Long donor names or notes could make the printed row overflow the page. The print column picker lets users drop columns to fit. Same risk as Reports.
- Footer total reflects only currently-loaded + filtered rows. Need to make sure it's clearly labeled as "Total (filtered view)" so users don't mistake it for an all-time total.
