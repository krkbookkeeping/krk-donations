# Phase 7 — Settings & Receipts: Updates

## 2026-04-24 — Claude Sonnet 4.6

### Cloud Functions
- Created `functions/src/generateReceipt.ts` with two exported callables:
  - `generateReceipt`: validates input, fetches org settings + donor, queries donations by donorId (single-field, no composite index needed), filters eligible donations in code, uses a Firestore transaction to atomically assign a sequential receipt number (`YYYY-NNNN` format from `counters/receipts.nextNumber`), create the receipt document, and lock all included donations. Returns full receipt data for immediate PDF generation.
  - `voidReceipt`: marks receipt as void, unlocks all associated donations.
- Updated `functions/src/index.ts` to export both new callables.
- Deployed all functions successfully via `firebase deploy --only functions`.

### Organization Settings (`public/js/settings.js`)
- New Alpine component `settings` registered on `alpine:init`.
- Loads/saves `companies/{id}/settings/org` via `getDoc`/`setDoc` with `merge: true`.
- Validates via `validateOrganizationSettings()` before save.
- Fields: legalName, charityNumber, address (line1/2/city/province/postalCode/country), signatory (name/title), receiptTemplate (headerText/bodyText/footerText) with sensible CRA-compliant defaults.
- Shows 3-second "Settings saved." confirmation and error banners on failure.
- Reloads on company switch.

### Receipts (`public/js/receipts.js`)
- New Alpine component `receipts` registered on `alpine:init`.
- Checks org settings completeness on init; shows warning if legalName or charityNumber are missing.
- Year selector (current year default, 7-year range) reloads both tabs on change.
- **Pending tab**: queries active donations by date range using existing `(status, date)` index; filters `hasReceiptable && !locked` client-side; groups by donor. Shows donor name, count, total receiptable amount, and "Generate Receipt" button (per-row loading state).
- **Issued tab**: queries `receipts` collection filtered by year; shows receipt number, donor, date, amount, status badge, Download PDF and Void buttons.
- `generateReceipt()`: calls Cloud Function, builds PDF, auto-downloads, reloads data.
- `downloadReceipt()`: regenerates PDF from stored Firestore snapshot (no server call).
- `voidReceipt()`: calls Cloud Function after confirm dialog, reloads data.
- `buildReceiptPDF()`: jsPDF letter-format CRA-compliant receipt with org header, receipt metadata, donor information, donations table, total, body/footer text, and signatory line.

### UI (`public/app.html`)
- Added `<script type="module">` tags for `settings.js` and `receipts.js`.
- Added jsPDF 2.5.1 UMD CDN script tag (loaded before Alpine).
- Replaced "Coming in Phase 7" placeholder for Settings with full form: Organization section (legalName, charityNumber), Mailing Address, Authorized Signatory, Receipt Template, save button with success/error feedback.
- Replaced "Coming in Phase 7" placeholder for Receipts with full UI: year selector, settings-incomplete warning, Pending/Issued tabs, tables with appropriate columns and actions.

### Styles (`public/styles.css`)
- Added `.settings-form`, `.settings-section`, `.settings-section-title`, `.settings-card`, `.settings-saved` for the settings page.
- Added `.receipt-tabs`, `.tab-count`, `.save-success-banner` for the receipts page.
- Added `.badge.issued` (blue) and `.badge.void` (grey) for receipt status badges.

## 2026-04-28 — Claude Sonnet 4.6

### Donation file attachments
- `storage.rules`: added rule for `companies/{companyId}/donations/{donationId}/{allPaths=**}` — read/write by company members. Deployed via `firebase deploy --only storage`.
- `public/js/donations.js`:
  - Added `storage` import from `firebase.js` and Firebase Storage SDK imports (`ref as storageRef`, `uploadBytesResumable`, `getDownloadURL`, `listAll`, `deleteObject`, `getMetadata`) from the Firebase CDN.
  - Added `getActiveCompanyId` to company.js import.
  - Added attachment state: `attachments`, `attachmentsLoading`, `uploading`, `uploadProgress`, `dragOver`.
  - Added methods: `loadAttachments()`, `handleFiles()`, `uploadFile()`, `onFileInput()`, `onPaste()`, `deleteAttachment()`, `formatFileSize()`, `isImage()`.
  - `startEdit()` now calls `loadAttachments()` after populating the form.
  - `cancelForm()` clears `attachments`.
- `public/app.html`:
  - Donation form wrapper gains `@paste.window="onPaste($event)"` to capture clipboard image paste from anywhere on the page.
  - Added Attachments section (visible in edit mode only): drag-and-drop drop zone, file browser, upload progress indicator, image thumbnails for image files, file icon for non-images, name/size/delete per attachment. In create mode shows a note to save first.
- `public/styles.css`: added attachment styles — `.attach-section`, `.attach-dropzone`, `.attach-dropzone.drag-over`, `.attach-item`, `.attach-thumb`, `.attach-list`, and related helpers.

### Donation form defaults fix
- `public/js/donations.js` — `startCreate()` was setting `this.form = emptyForm()` and then mutating nested properties (`this.form.allocations[0].categoryId`) on the freshly-assigned Alpine reactive proxy. Alpine 3 can lose track of nested mutations on a proxy before the template is mounted. Fixed by resolving all defaults first (using a `norm()` helper for flexible payment method name matching), building the complete form object as a plain JS object, and assigning it to `this.form` in one operation so Alpine wraps it reactively all at once. Also added `this.attachments = []` to `startCreate()` to clear stale attachments from any previous edit session.
