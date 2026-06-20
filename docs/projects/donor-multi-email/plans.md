# Donor Multi-Email Support — Plans

## Goal

Let the user enter more than one email address for a donor, separated by commas. Tolerate semicolons too (since email clients often produce them when copy-pasting recipient lists).

## Approach

### Validator (both client + server)

`public/js/schemas/donor.js` and `functions/src/shared/schemas/validators.ts` both currently run the input through a single-email regex. Change both to:

1. Split the input on `,` or `;`.
2. Trim each piece, drop empties (handles trailing commas).
3. Validate each piece against the existing `EMAIL_RE`.
4. If any piece fails, surface the offending value: `Invalid email address: <bad>`.
5. Normalize valid input to a comma-space-separated string (`"a@b.com, c@d.com"`) and store that.

Single-email behaviour is unchanged: one address splits to a single piece, validates, stores as-is.

### Search tokens

`addWords()` in `donor.js` splits on whitespace only — a normalized `"a@b.com, c@d.com"` would yield `"a@b.com,"` as one token (with the trailing comma) and `"c@d.com"` as another. Update the splitter to `[\s,;]+` so both emails become clean search tokens, and so name/org fields containing punctuation (`"Smith, John"`, `"ABC, Inc."`) tokenize sensibly too.

### UI hint

Add a one-line helper under the Email field in the donor form: `Separate multiple emails with commas.` Keep `<input type="email">` — our validator handles the comma parsing and the browser's keyboard hint stays useful on mobile.

## What gets affected automatically

- Donor detail "Email" row renders the stored string as a `mailto:` link. The `mailto:` URI spec accepts comma-separated recipients, so existing email clients will open with all addresses pre-filled.
- Reports CSV/print just dumps the email string; multi works fine as text.

## What's intentionally left alone

- **Duplicate detection** (`detectDuplicates` in donors.js) does `where("email", "==", donor.email)` — an exact-string match. With multi-emails this query won't fire by-email matches, which is no worse than before for the bulk of the duplicate-detection signal (name + phone similarity covers it). Properly indexing each email separately would require an array field and a denormalization layer; out of scope here.
- **Receipts** — `generateReceipt` currently writes the donor email snapshot onto the receipt. Multi-emails would land there as a string. PDF generation just text-prints it. No change needed; user can split later if a single recipient is required.

## Risks

- **Migration of existing data** — none needed. Existing single-email donors satisfy the new validator unchanged (one piece → one valid email).
- **Validator drift between client and server** — both files share the same `EMAIL_RE`. Keep them in sync.
- **Browser type=email behaviour** — `<input type="email">` without `multiple` shows a "please enter an email address" tooltip only on form-submit, which Alpine doesn't do (we listen to the save button). So the native browser check never fires; our validator is the only gate.

## Out of scope

- Per-email validation feedback ("the second email is bad" with a row-level indicator). One inline error message naming the bad value is sufficient.
- A typed array field in Firestore instead of a string. Tempting, but it's a schema change with rule + index implications and downstream consumers (reports, receipts) need adjusting. The comma-string approach is a one-line change with no migration.
