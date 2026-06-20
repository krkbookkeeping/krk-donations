# Donor Multi-Email Support — Updates

## 2026-05-11 — Claude Opus 4.7

### Initial implementation

- **`public/js/schemas/donor.js`**: Email validator now splits on `,` or `;`, validates each piece against `EMAIL_RE`, names the offending value if any piece fails, and normalizes valid input to a comma-space-separated string. `addWords()` splits on `[\s,;]+` so multi-email and punctuated names/orgs tokenize cleanly for search.
- **`functions/src/shared/schemas/validators.ts`**: Mirrored the same email-parsing change in the server-side validator.
- **`public/app.html`**: Added a hint line under the Email field in the donor form: "Separate multiple emails with commas."

### Follow-up — donor detail Email overflow

- **`public/app.html`**: Donor detail Email row now splits the stored string on commas and renders one `<a>` per address, stacked vertically. Each is its own `mailto:` link.
- **`public/styles.css`**: `.detail-card dt` width shrunk 120 → 90px and made non-shrinking; `.detail-card dd` now `flex: 1; min-width: 0; overflow-wrap: anywhere` so long values can shrink + wrap. New `.email-list` modifier stacks the per-email links with a tight gap.

### Follow-up #2 — widen Contact card

- **`public/app.html`**: Added `detail-card--wide` modifier class to the Contact card.
- **`public/styles.css`**: `.detail-card--wide { grid-column: span 2 }` so the Contact card takes 2 grid columns when the viewport is wide enough, giving each email line room to render on a single line. Other cards (Address, Notes) stay one column and shift right accordingly.
