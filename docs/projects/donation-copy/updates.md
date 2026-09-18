# Donation Copy — Updates

## 2026-09-18 — Codex

### Planning and system alignment

- Added the approved donation-copy workflow to the app overview.
- Documented the intended copy behaviour, exclusions, implementation plan, and receipt-integrity safeguards.

### Implementation and verification

- **`public/js/donations.js`**: Added `copyDonation()` to create a clean, unsaved donation form from the current edit values while omitting allocation IDs and attachments.
- **`public/app.html`**: Added edit-only Copy buttons beside Cancel in both the donation-form header and bottom actions.
- **`public/styles.css`**: Styled Copy as a compact, muted dark-green action.
- Verified with `node --check public/js/donations.js` and `git diff --check`.
