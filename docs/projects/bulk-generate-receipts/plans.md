# Bulk Generate Receipts — Plans

## Goal

Let the user generate receipts for **all** pending donors in one action, rather than clicking "Generate Receipt" 46 times. Keep the per-row button untouched.

## Approach

Sequential per-donor calls to the existing `generateReceipt` Cloud Function, downloading each PDF as it completes. No batching on the server side — that would mean reshaping the Cloud Function. Sequential client-side is simpler, predictable, and lets the existing per-row `generating[donorId]` state continue to drive the row-level "Generating…" label.

### State additions (receipts.js)

```js
generatingAll: false,
bulkProgress: { current: 0, total: 0, ok: 0, failed: 0 },
bulkFailures: [],   // [{ donorName, error }] for the end-of-run summary
```

### New method

```js
async generateAllReceipts()
```

- Early-returns if `generatingAll || pendingDonors.length === 0`.
- Confirms via `confirm()` with the count so the user can back out of a bulk download (browsers prompt for multi-file download too, but the confirm prevents accidental clicks).
- Resets `bulkProgress` + `bulkFailures`, sets `generatingAll = true`.
- Snapshots `[...this.pendingDonors]` at the start (the list mutates as `loadData()` may run; safer to iterate the snapshot).
- For each donor: bumps `current`, marks the row's `generating[donorId]`, calls the `generateReceipt` Cloud Function, saves the PDF, increments `ok` or `failed`, clears the row's generating flag. On failure, push to `bulkFailures` and continue — don't abort the whole batch on one bad donor.
- After the loop, calls `loadData()` once (refreshes counts and moves issued receipts off the Pending tab).
- Sets `generatingAll = false`.
- Renders a summary: success → `successMessage = "Generated N receipts."`; partial → `errorMessage = "Generated N receipts. K failed: …"`.

### UI changes (app.html)

Add a small bulk-action row above the pending table:

```
46 donors ready for receipts                    [ Generate All Receipts ]
Generating receipt 5 of 46…                     [ Generating… ] (disabled)
```

Place: inside the Pending tab `<div>`, just before `.report-table-wrap`. Use the existing `.report-results-header` styling for consistency with Donations / Reports.

## Why sequential

- Simpler error handling — one failure doesn't kill ten in flight.
- The browser's "allow multiple downloads" prompt fires once; subsequent saves go through.
- Doesn't hammer the Cloud Function (and Firestore writes inside it) with parallel requests that could trip quota or contention on the company-level receipt-number sequence.
- The user sees progress in real time rather than a long single freeze.

## Out of scope

- A "Generate selected" multi-select flow (per-row checkboxes). The user asked for all + individual; selected-subset can come later if needed.
- A consolidated multi-page PDF combining all receipts. Each donor gets a separate file (matches the per-row behaviour today).
- Background / resumable batches that survive page navigation.

## Risks

- **Multi-file download prompt.** Chrome and Edge show a "this site wants to download multiple files — Allow / Block" prompt the first time. If the user picks Block, every PDF after the first silently fails to save. Acceptable; the receipts are still issued in Firestore and remain downloadable from the Issued tab.
- **Partial failure mid-run.** Some receipts may have been issued before a failure (Firestore writes are atomic per call). The end-of-run summary lists the failures with donor name so the user can retry just those.
- **Receipt-number sequencing.** The Cloud Function holds the sequence — sequential calls preserve order naturally. Parallel calls would risk gaps/contention; another reason to avoid parallelism here.
