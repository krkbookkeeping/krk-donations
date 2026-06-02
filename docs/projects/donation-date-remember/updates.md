# Remember Last Donation Date — Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/donations.js`**: Added `lastEnteredDate: ""` state; on successful create-save it captures `this.form.date`; `startCreate()` overrides `this.form.date` with it when set.

### Follow-up — batch mode keeps category too

- **`public/js/donations.js`**: Batch-mode reset now preserves the categoryId (and the derived `receiptable` flag) on each allocation, only clearing `amountDollars`. Allocation count is preserved.
- **`public/app.html`**: Updated the batch-mode helper text to mention the category.
