# Reports UI Tweaks — Plans

## Goal

Tighten the Reports page so it carries more data per screen, and give the user the same column-picker control over the on-screen view that they already have for print.

## Requirements (from user)

1. On-screen column picker (same idea as the print column picker — but for the live report view).
2. Shrink the report-page text and overall density.
3. Horizontal bar separators above the **Categories**, **Payment Methods**, and **Receiptable Status** filter section headings. The bar should be only as wide as the heading text.
4. Shrink the left sidebar to give the main view more horizontal space.
5. Overall page should feel more compact.

## Approach

### 1. On-screen column picker

- Add `displayColumns: { transaction: {...}, summary: {...} }` to the `reports` Alpine component. Same shape as `printColumns`, defaulting to **all true** (current behaviour: every column visible).
- Add `showDisplayColumnsModal` boolean + `openDisplayColumnsModal()` / `closeDisplayColumnsModal()` methods.
- New **Columns** button next to **Print** / **Export CSV** in each report's `.report-results-header`.
- Bind `:class="{ 'display-hide-col': !displayColumns.<type>.<col>, 'print-hide-col': !printColumns.<type>.<col> }"` to every `<th>` and `<td>`.
- New modal mirroring the print modal's checkbox list, bound to `displayColumns`.

### 2 & 5. Compaction (font + spacing)

Reduce sizes across the board on the report page (no app-wide changes — scoped to `.report-filters`, `.report-table`, `.report-results-header`, etc.):

- `.report-table` font-size: `0.9rem` → `0.8rem`; th/td padding: `0.5rem 0.75rem` → `0.3rem 0.55rem`.
- `.report-filters`: padding `1.25rem 1.5rem` → `0.9rem 1.1rem`, gap `1rem` → `0.6rem`.
- `.filter-label`: `0.85rem` → `0.78rem`.
- `.check-item`, `.filter-radios label`: `0.9rem` → `0.82rem`.
- `.report-results-header` margin-bottom: `0.75rem` → `0.5rem`.
- Reports `.page-header h1` slightly smaller (target the reports view only).

### 3. Filter section separators

- Add `filter-group--separated` modifier class to the three target filter-groups (Categories, Payment Methods, Receiptable Status).
- CSS:
  ```css
  .filter-group--separated .filter-label {
    border-top: 1px solid var(--border);
    display: inline-block;
    padding-top: 0.45rem;
  }
  ```
- `display: inline-block` makes the border's width match the text width, satisfying "extend the bar horizontally to the right, to the end of the text."

### 4. Sidebar shrink

- `--sidebar-width: 240px` → `200px`.
- `.sidebar .brand` padding tightened.
- `.sidebar nav a`: padding `0.55rem 1.25rem` → `0.5rem 1rem`, font `0.93rem` → `0.88rem`.

## Why this design

- **Separate display/print column state.** The user explicitly asked for both; coupling them would be surprising (e.g. unchecking "Notes" for print would also drop it from the screen view).
- **`display: inline-block` for the separator** keeps the border tight to the text without needing magic widths or `:after` tricks.
- **Scoped compaction.** Changes are mostly inside `.report-*` / `.filter-*` selectors and the sidebar — nothing here changes Donations, Donors, or other pages.

## Out of scope

- Persisting column-picker preferences across sessions.
- Compacting Donors / Donations / Receipts pages (request is specifically about Reports + sidebar).
- A "select all / none" shortcut in either column modal (current 9–12 checkboxes are manageable).

## Risks

- Smaller font on the table makes very long donor names/addresses harder to scan. If it goes too far, bump `.report-table` font back to `0.82rem` or `0.84rem`.
- Narrower sidebar may truncate the longest nav label or company-switcher. Will eyeball after the change; can widen by 10–20 px if anything wraps.
