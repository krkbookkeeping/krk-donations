# Clickable Donations on Donor Detail — Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/donors.js`**: Added `paymentMethods: []` state, loaded in `init()` from `companyCollection("paymentMethods")`. New `paymentMethodName(id)` helper. New `openDonationForEdit(don)` method that stashes `window.krkPendingEditDonation = { donationId }` and navigates to `#/donations`. Skips locked donations.
- **`public/js/donations.js`**: Extended `init()` to also consume `window.krkPendingEditDonation` — fetches the donation doc via `getDoc` and calls the existing `startEdit()` flow.
- **`public/app.html`**: Donor detail "Donations" card rows now use `paymentMethodName(don.paymentMethodId)` instead of the raw id. Non-locked rows get `.clickable-row` + a click handler that calls `openDonationForEdit(don)`. Locked rows render a 🔒 alongside the date.
