# Donations List — Filter + Compaction Plans

## Goal

Add quick filtering on the Donations list (Date, Donor, Total, Payment, Receiptable) and tighten the page typography/spacing to match the Reports page.

## Filter scope

Filtering is **client-side** over the currently-loaded donations (50 per page, "Load more" extends the set). Same behaviour pattern as the Reports page once a report is run. For searching the full historical dataset, the Reports page remains the right tool (it queries Firestore directly with date bounds).

## State additions (donations.js)

```js
filter: {
  dateFrom: "",
  dateTo: "",
  donor: "",         // free-text contains-match on donorName (case-insensitive)
  totalMin: "",      // dollars (parsed → cents)
  totalMax: "",
  paymentMethodId: "",
  receiptable: "all", // "all" | "yes" | "no"
},
```

## New methods / getters

- `clearFilters()` — reset all filter fields to defaults.
- `get hasActiveFilters` — true if any field is non-default; drives a "Clear" button's visibility and an active-filter badge.
- Existing `sortedDonations` is updated to filter first, then sort. Template binding unchanged.

## UI (app.html)

A `.donations-filters` row above the table:

```
[ From <date> | To <date> ]  [ Donor <text> ]  [ Min $ | Max $ ]  [ Payment <select> ]  [ Rec. <select> ]  [Clear]
```

- Date range pair (two `<input type="date">`).
- Donor: free-text input, debounce not needed (filter is local).
- Total: two `number` inputs, dollar values, 80–90 px wide each.
- Payment: `<select>` populated from `paymentMethods`, first option "All".
- Receiptable: `<select>` with All / Receiptable / Non-receiptable.
- Clear button visible only when `hasActiveFilters` is true.

Table is wrapped in `.report-table-wrap` and given `.report-table` class so it inherits the same compact styling as Reports.

## CSS additions (styles.css)

- `.donations-filters` — flex row, 0.5rem gap, small fonts, wraps on narrow screens.
- `.donations-filters input`, `.donations-filters select` — height/padding tightened, no built-in `margin-bottom` from Pico.
- `.donations-filters label` — inline label + input, tight gap, small font.

## Why this design

- **Inline filter row > sticky panel**: keeps the page compact and matches the user's "scale down to match reports" goal.
- **Client-side filter**: simple, consistent with how Reports operates post-run; no new Firestore indexes.
- **Reuse `.report-table`**: zero duplication; the donations table immediately picks up the same fonts/padding.

## Out of scope

- Server-side full-history filtering (Reports already does this for date ranges with allocations data).
- Saving filter state across sessions.
- Filter chips/badges UI (a Clear button is sufficient for now).

## Risks

- 50-row page limit means filters can produce confusingly-empty results if the matching donations haven't been paged in yet. The "Load more" button remains visible, and the Reports page is the alternative for cross-page searches.
