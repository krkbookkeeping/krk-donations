# Phase 4 — Categories & Payment Methods: Updates

## 2026-04-24 — Claude Sonnet 4.6

### Initial Phase 4 implementation

- **`public/js/categories.js`** (new): Alpine "categories" component. List view with name/receiptable/status/actions table. Form for create/edit with locked-receipt guard on receiptable flag change. Seed defaults batch-written on first load. Archive/restore.
- **`public/js/paymentMethods.js`** (new): Alpine "paymentMethods" component. Same pattern, simpler (name only). Seed defaults on first load.
- **`public/app.html`**: Added `<script>` imports for both new modules. Replaced categories and payment-methods placeholder sections with full list + form views.
- **`public/styles.css`**: Added `.badge.receiptable` (blue) and `.badge.non-receiptable` (yellow) badge colour variants.
- **`firestore.indexes.json`**: Added `donations (categoryIds ARRAY_CONTAINS, locked ASC)` composite index for the locked-donation check in the category form.
