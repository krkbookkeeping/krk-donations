# Phase 7 — Settings & Receipts: Summary

## What was built

**Organization Settings page** — a full form to configure the company's CRA registration details:
- Legal name and charity number (required to generate receipts)
- Mailing address (appears on receipts)
- Authorized signatory name and title
- Customizable receipt header, body, and footer text

**Receipts page** — end-to-end CRA-compliant tax receipt workflow:
- **Pending tab**: shows all donors who have unlocked receiptable donations in the selected year, with a "Generate Receipt" button per donor
- **Issued tab**: shows all receipts for the selected year with Download PDF and Void actions
- Receipts are letter-format PDFs generated client-side using jsPDF, containing all required CRA fields

**Cloud Functions** (`northamerica-northeast2`):
- `generateReceipt`: atomic transaction assigns a sequential receipt number (`YYYY-NNNN`), creates the receipt document with a full org/donor snapshot, and locks all included donation documents
- `voidReceipt`: marks a receipt void and unlocks its donations for re-receipting

## Key decisions

- **Sequential numbering without race conditions**: Counter stored in `counters/receipts.nextNumber` and incremented atomically inside a Firestore transaction in the Cloud Function (Admin SDK only — clients cannot write this collection).
- **Donation locking**: `locked: true` written to each donation at receipt time prevents edits until the receipt is voided. Firestore security rules enforce this.
- **PDF regeneration from snapshot**: The receipt document stores a full `orgSnapshot` so PDFs can be regenerated at any time without the current settings affecting historical receipts.
- **No composite index needed for receipt generation**: The Cloud Function queries donations by `donorId` only (single-field index), then filters date/status/locked in code.
- **Settings readiness gate**: The receipts page shows a warning and disables generation if `legalName` or `charityNumber` are not yet saved, preventing incomplete receipt data.

## New features
- Organization settings form with CRA charity registration fields
- Authorized signature image upload in settings (canvas-resized to max 600×200, stored as base64 PNG in Firestore for direct jsPDF use)
- CRA-compliant PDF receipt generation (client-side, jsPDF) — includes org header, donor name + full address, total eligible amount, signatory with image, footer pinned to page bottom
- Sequential receipt numbering (YYYY-NNNN)
- Donation locking after receipt issuance
- Void receipt with automatic donation unlock
- Receipts page with Pending / Issued tabs and year filter
- Donation file attachments — drag-and-drop, file picker, clipboard paste (Ctrl+V); image thumbnails; delete; stored in Firebase Storage under `companies/{id}/donations/{donationId}/`
- Smart donation form defaults — E-Transfer payment method and General Donation category pre-selected on new donations; allocation amount auto-populated from total
- Province defaults to AB on donor create/edit
