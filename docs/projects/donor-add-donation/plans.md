# + New Donation from Donor Detail — Plans

## Goal

Let users start a new donation **for a specific donor** directly from that donor's detail screen, with the donor field pre-selected on arrival at the donations form. Avoids the round-trip through the Donations page and the donor-search step.

## Approach

A simple **window-stash + navigate** handoff between the two components:

1. **Donor detail** has a new `+ New Donation` button. Clicking it:
   - Stashes `{ donorId, donorName }` on `window.krkPendingNewDonation`.
   - Navigates to `#/donations`.
2. **Donations** component, in `init()`, checks `window.krkPendingNewDonation`. If present:
   - Calls `startCreate()` (resets form, switches to form view, applies default payment-method / category in the next tick).
   - Calls `selectDonor({ id: donorId, ...looked-up doc data so orgName / firstName / lastName are populated })` so `donorFullName()` produces the right label and `form.donorName` is set correctly.
   - Clears the stash.

Looking up the donor doc inside `init()` is needed because the stash carries only `donorId` (and a display name fallback). We need the full doc to feed `donorFullName()` properly (org vs person). One small `getDoc()` call.

### Why stash, not URL params

The router (`shell.js`) splits the hash on `#/` and treats the rest as the route name. Adding query params (`#/donations?donor=X`) would require teaching the router to strip them. The stash variable is two lines, lives only for one navigation, and is cleared after consumption.

### Why stash, not custom event

A custom `window.dispatchEvent(...)` would fire before the donations component mounts (`x-if="route === 'donations'"` is still false at click time). Listeners attached in `init()` arrive too late. Stash-then-consume sidesteps the timing problem.

## UI placement

The button goes inside the existing Donations card on the donor detail page, next to the `YTD receiptable: $X.XX` line in the `.section-header`. Reasons:

- Contextual: it's the action that belongs with the Donations section.
- Doesn't crowd the top page-header (which already has Edit / Merge / Archive).
- A small primary button styled `class="small"`, label `+ New Donation`.

## Out of scope

- Inline donation creation on the donor page (would duplicate the form). Existing flow already lives in the Donations page and supports edit + batch mode — better to reuse it.
- Pre-filling more than the donor (date, amount, payment method) — `startCreate()` already applies the user's default payment method / category.
- A back-to-donor link after saving the donation.

## Risks

- If the user has unsaved donor edits open in `view === 'detail'`, navigating away discards them — but that view doesn't have inline editing, so this isn't an issue.
- If `window.krkPendingNewDonation` somehow persists (init failed, page reload), it could fire on a fresh donations visit. The consumer clears it immediately on read, and it's only set by the explicit button click, so this is very unlikely.
