# + New Donation from Donor Detail — Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/donors.js`**: Added `startNewDonation()` method that stashes the selected donor on `window.krkPendingNewDonation` and navigates to `#/donations`.
- **`public/js/donations.js`**: After `init()` finishes loading donations + lookups, consumes `window.krkPendingNewDonation` if present — looks up the donor doc, calls `startCreate()`, then `selectDonor()` once Alpine's next tick has applied form defaults.
- **`public/app.html`**: Added a small `+ New Donation` button in the donor detail Donations-card `.section-header`, next to the YTD receiptable line.
