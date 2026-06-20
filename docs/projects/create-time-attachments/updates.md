# Create-Time Attachments — Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/donations.js`**:
  - Added `pendingAttachments: []` state.
  - Extracted `uploadFileToDonation(file, donationId)` helper; existing `uploadFile()` is now a thin wrapper for edit-mode uploads.
  - `handleFiles()` branches by `formMode` — create-mode files get pushed to `pendingAttachments`; edit-mode behaves as before.
  - Dropped the `formMode !== "edit"` guard on `onPaste` so create-mode paste works too.
  - Added `deletePending(idx)` to remove a queued attachment.
  - `startCreate()` and `cancelForm()` clear `pendingAttachments`.
  - `saveDonation()` captures the new donation's `donationRef.id` in create mode, uploads each queued attachment after the batch commit, and clears the queue. Errors are surfaced via `saveError` but don't roll back the saved donation.
- **`public/app.html`**:
  - Removed `x-show="formMode === 'edit'"` from `.attach-section` so it renders in both modes.
  - Removed the standalone "Save first…" note; replaced with a thin inline hint shown only when the create-mode queue is empty.
  - Added a pending-files list above the existing `.attach-list`, with delete buttons that call `deletePending(idx)`.
