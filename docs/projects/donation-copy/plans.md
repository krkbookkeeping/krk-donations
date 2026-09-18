# Donation Copy — Plans

## Goal

Allow a user editing an unlocked donation to turn it into a new, unsaved copy from the donation form. Put a compact, faded dark-green **Copy** button beside **Cancel** in both the form header and the bottom action row.

## Behaviour

- Show Copy only while editing an existing donation; a new donation cannot copy itself.
- On Copy, keep the donor, date, amount, payment method, reference number, notes, and allocation values.
- Switch the form to create mode and clear the original donation identity and allocation document IDs. Saving then creates a separate donation and allocation set.
- Do not copy attachments, receipts, audit fields, locked state, or timestamps. Attachments belong to the original transaction and receipt/audit fields must remain unique to it.
- Preserve normal validation, including the exact allocation-balance requirement, before the new donation can be saved.

## Implementation

1. Add a `copyDonation()` form-state transition in `public/js/donations.js`.
2. Add the two edit-only buttons in `public/app.html`, disabled while saving.
3. Add a scoped CSS treatment that is visually smaller than Cancel and uses a muted dark-green colour.
4. Perform syntax and focused source checks after the change.

## Risks and safeguards

- Copying an allocation document ID could overwrite or tie the copy to the original allocation. The copy flow will remove those IDs before save.
- Copying attachments could duplicate source records and storage files unexpectedly. They are intentionally excluded.
- Locked donations cannot be opened for edit under the current receipt-integrity workflow, so this action cannot alter or derive directly from a locked record through the edit form.
