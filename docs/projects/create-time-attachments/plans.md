# Create-Time Attachments — Plans

## Goal

Let users attach files while creating a donation, not just after saving. The current flow requires a save-then-reopen round trip, which is a chore.

## Constraint

Firebase Storage paths are `companies/{cid}/donations/{donationId}/...`. The `donationId` only exists once the Firestore doc is written. So we can't upload during create-mode the same way edit mode does.

## Approach

**Queue locally, upload after save.**

- New state `pendingAttachments: []` on the donations Alpine component. Each entry is the raw `File` object plus a small metadata object the UI can render.
- In create mode the same dropzone / paste / browse flow goes into the queue instead of triggering `uploadFile()`.
- The list shows pending items inline with a delete button (just splices the array — nothing on Firebase yet).
- On a successful create-save, capture the new donation's auto-generated ID (already obtained via `donationRef.id`), then loop through `pendingAttachments` and upload each one to `companies/{cid}/donations/{newId}/...`.
- Batch mode: clear the queue after upload so the next entry starts fresh.

## State additions (donations.js)

- `pendingAttachments: []`
- `pendingUploadProgress: 0` (single counter; reuses existing `uploading` flag for the busy state)

## Method changes

- **`handleFiles(fileList)`** — branch on `formMode`: edit → existing `uploadFile()` call; create → push to `pendingAttachments`.
- **`onPaste(event)`** — drop the `formMode !== "edit"` guard so paste works in create mode too.
- **`deletePending(idx)`** — new; splices the queue.
- **`startCreate()` / `cancelForm()`** — clear `pendingAttachments`.
- **`saveDonation()`** — in the create branch, after `batch.commit()` succeeds, capture `donationRef.id`, then `await Promise.all(pendingAttachments.map(p => uploadFileToDonation(p.file, newId)))`. Clear the queue.
- New helper **`uploadFileToDonation(file, donationId)`** — extracted from `uploadFile()` so create-mode saves don't depend on `this.editingId`. Existing `uploadFile()` becomes a thin wrapper.

## UI changes (app.html)

- Drop the `x-show="formMode === 'edit'"` on `.attach-section`. Show it in both modes.
- Replace the "Save the donation first…" hint with a thinner inline note that only shows when there's nothing queued in create mode.
- Below the existing `.attach-list`, add a `.attach-list.pending-list` that renders `pendingAttachments` with delete buttons. Same styling, no thumbnails (files aren't uploaded yet so there's no URL — fall back to the file-type icon).

## Why this design

- **No structural change to the save flow.** The donation still saves as one atomic batch; uploads come after and don't gate the save itself.
- **Failure handling is forgiving.** If an upload fails after save, surface the error but keep the donation. The user can re-open and re-attach.
- **Reuses existing UI.** Same dropzone, same paste handler, same list styling — just one more list above it for the pending queue.

## Out of scope

- Background / resumable uploads that survive page navigation.
- Pre-validating file size or type before queueing.
- A progress bar per pending file (single global progress is fine for typical 1–3 attachments).

## Risks

- If the user spams "Save" repeatedly and uploads are slow, multiple `pendingAttachments` runs could overlap. The existing `saving` flag already disables the button — keep that, and the queue is consumed inside the same save call, so this is contained.
- Upload failure after a successful donation save leaves the user in a slightly weird "saved but no attachment" state. We'll surface a clear error and keep them on the form view in that case so they can retry.
