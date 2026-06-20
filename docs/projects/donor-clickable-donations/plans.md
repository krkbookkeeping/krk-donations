# Clickable Donations on Donor Detail — Plans

## Goal

On the donor detail page, let the user click a row in the "Donations" card to open that donation for view/edit on the donations page. Saves the round-trip via the Donations list.

## Bug spotted in passing

The same table shows the raw `paymentMethodId` string (e.g. `2zdyPkcULphSstGUhAi1`) under the **Payment** column instead of the readable method name. Fix while we're in the file.

## Approach

### Click → handoff (mirror the existing "+ New Donation" pattern)

The Donors and Donations Alpine components are separate. The cleanest cross-component handoff is the same stash-and-navigate already used for `window.krkPendingNewDonation`:

- Donors component:
  - On row click, call `openDonationForEdit(don)` which stashes `window.krkPendingEditDonation = { donationId: don.id }` and sets `window.location.hash = "#/donations"`.
  - Lock-out: rows where `don.locked === true` are not clickable (matches the donations list behaviour where locked rows show 🔒 instead of an Edit button). Show a small lock icon in place of the cursor cue.
- Donations component, in `init()`:
  - After the existing `krkPendingNewDonation` handling, check `window.krkPendingEditDonation`. If present, fetch the donation doc via `getDoc(companyDoc("donations", donationId))`, then call the existing `startEdit(donation)` flow with the doc data. Clear the stash.

### Payment method name resolution

Donors component doesn't currently load payment methods. Add a `paymentMethods: []` array, fetch it in `init()` (same query Donations already uses), and add a `paymentMethodName(id)` helper that returns the name or `"—"`. Use it in the donations row template instead of the raw id.

## UI

- Add `.clickable-row` (existing class) to the donation `<tr>` in the donor-detail donations card, gated on `!don.locked`.
- Locked rows: keep them as plain rows with a `🔒` prefix next to the date (or show as separate cell).
- Add `@click` handler that calls the new method.

## Out of scope

- Hovering preview / inline expansion — full edit lives on the Donations page.
- Reloading the donor detail after an edit completes; the user can navigate back via the existing back-button.
- Showing receiptable amount / total in the donor-detail mini table.

## Risks

- **Stale paymentMethods cache.** If the user creates a new payment method in another tab and then opens donor detail, the new method won't be in the cached list. Acceptable — donor detail is read-only for the donation row and a refresh fixes it.
- **Locked donations.** Users may click expecting to see details. Decision: disable click on locked rows entirely; the lock icon communicates why.
