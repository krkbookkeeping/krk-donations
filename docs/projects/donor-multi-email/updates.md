# Donor Multi-Email Support — Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/schemas/donor.js`**: Email validator now splits on `,` or `;`, validates each piece against `EMAIL_RE`, names the offending value if any piece fails, and normalizes valid input to a comma-space-separated string. `addWords()` splits on `[\s,;]+` so multi-email and punctuated names/orgs tokenize cleanly for search.
- **`functions/src/shared/schemas/validators.ts`**: Mirrored the same email-parsing change in the server-side validator.
- **`public/app.html`**: Added a hint line under the Email field in the donor form: "Separate multiple emails with commas."
