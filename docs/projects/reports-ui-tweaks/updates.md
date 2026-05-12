# Reports UI Tweaks — Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/reports.js`**: Added `displayColumns` state (parallel to `printColumns`, defaults to all-visible), `showDisplayColumnsModal` flag, and `openDisplayColumnsModal` / `closeDisplayColumnsModal` methods.
- **`public/app.html`**: Added **Columns** button to each report's `.report-results-header`; combined `:class` bindings for `display-hide-col` + `print-hide-col` on every `<th>` and `<td>`; added the display-columns modal; tagged Categories / Payment Methods / Receiptable Status filter-groups with `filter-group--separated`.
- **`public/styles.css`**:
  - Sidebar `--sidebar-width` 240px → 200px; tightened `.sidebar` paddings and nav-link sizing.
  - Shrunk report-table font + padding, filter-label + check-item + filter-radios sizing, report-filters padding/gap, report-results-header margin.
  - Added `.display-hide-col { display: none }` (screen) and `.filter-group--separated .filter-label` top-border separator (inline-block so width matches text).
