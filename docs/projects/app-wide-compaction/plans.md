# App-Wide Compaction — Plans

## Goal

Apply the typography/density used on the Donations and Reports pages to every other page (Donors, Categories, Payment Methods, Receipts, Settings) so the whole app reads at a consistent compact scale.

## Approach

Two kinds of change:

### 1. Reuse `.report-table` on every list table

Add the `.report-table` class (and wrap in `.report-table-wrap`) to:

- Donors list (`<table>` at app.html ~line 113)
- Categories list (~line 848)
- Payment Methods list (~line 942)
- Receipts → Pending (~line 1488)
- Receipts → Issued (~line 1523)

Donor-detail "recent donations" already uses `.compact-table` — leave alone (it lives inside a card and is intentionally smaller).

### 2. Global + per-page CSS compaction

- `.page-header h1` — Pico's default is ~2rem; pin to `1.35rem` and reduce `.page-header { margin-bottom }` from `1rem` → `0.6rem`. Affects every page.
- `.filters-bar` (Donors page) — smaller gap + tighter input/select sizing.
- `.detail-card` — reduce padding, shrink dt/dd font.
- `.settings-section` margin-bottom `1.75rem` → `1rem`; `.settings-card` padding `1.25rem 1.5rem` → `0.9rem 1.1rem`; `.settings-section-title` margin-bottom `0.6rem` → `0.4rem`.
- `.receipt-tabs` — mirror the `.report-tabs` shrink already done (font `0.85rem`, padding `0.4rem 0.9rem`, margin-bottom `1.5rem` → `1rem`).
- `.form-row` gap reduce.
- `.form-actions` `margin-top: 1.5rem` → `1rem`.
- `.warning-card` padding tighter, font smaller.

## Why this design

- **Reuse over rewrite.** The `.report-table` rules already encode our compact baseline; applying them to other tables is a one-class change per table.
- **No Pico-default form input overrides.** Tempting to shrink all inputs globally, but that risks breaking the donor and donation forms (busy layouts with allocation grids, address details, etc.). Scoped to filter/page chrome only.
- **`.page-header h1` is the highest-leverage change.** Every page has one; shrinking it saves significant vertical space everywhere.

## Out of scope

- Touching the sign-in page (already compact).
- Touching the donor form, donation form, or allocation grid — those have intentionally generous spacing for data entry.
- Restyling buttons, badges, or `.action-group`.

## Risks

- `.page-header h1` becoming too small. `1.35rem` is roughly h3 size; should still read as a page title. Easy to tune.
- Settings card padding may feel cramped on small screens. The Settings page is form-heavy; if it bites, bump padding to `1rem 1.25rem`.
