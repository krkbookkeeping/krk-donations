# Donation Copy — Summary

## Completed work

Added donation copying from the edit form. The new Copy controls appear beside Cancel at the top and bottom of the form, with a smaller muted dark-green treatment.

## Key decisions

- Copying changes the current edit form into a new, unsaved donation instead of modifying the original.
- Donor, date, total, payment method, reference number, notes, and allocations carry over.
- Attachments, allocation IDs, receipt state, audit metadata, and timestamps are excluded so the saved copy is an independent transaction and receipt records remain reliable.
