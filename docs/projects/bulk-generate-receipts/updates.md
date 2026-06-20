# Bulk Generate Receipts — Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/receipts.js`**: Added `generatingAll`, `bulkProgress`, `bulkFailures` state and a new `generateAllReceipts()` method that snapshots `pendingDonors`, sequentially calls the existing `generateReceipt` Cloud Function for each, saves the PDF, and tracks per-donor + aggregate progress. Failures don't abort the run; an end-of-run summary lists them. Calls `loadData()` once at the end.
- **`public/app.html`**: Added a bulk-action row above the Pending table showing the donor count and the **Generate All Receipts** button. While running, the row swaps to a live progress label ("Generating receipt N of M…").
