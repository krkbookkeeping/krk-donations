// Donation + allocations validator. The critical invariant is that the sum of
// allocation.amountCents equals donation.totalAmountCents exactly (integer).

import { sumCents } from "../money.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function trimOrEmpty(v) {
  return typeof v === "string" ? v.trim() : "";
}

export function validateDonation(input, allocations) {
  const errors = {};
  const value = {};

  value.donorId = trimOrEmpty(input.donorId);
  if (!value.donorId) errors.donorId = "Donor is required.";

  value.date = trimOrEmpty(input.date);
  if (!DATE_RE.test(value.date)) {
    errors.date = "Date must be YYYY-MM-DD.";
  }

  if (!Number.isInteger(input.totalAmountCents) || input.totalAmountCents < 1) {
    errors.totalAmountCents = "Total amount must be a positive integer (cents).";
  } else {
    value.totalAmountCents = input.totalAmountCents;
  }

  value.paymentMethodId = trimOrEmpty(input.paymentMethodId);
  if (!value.paymentMethodId) errors.paymentMethodId = "Payment method is required.";

  value.referenceNumber = trimOrEmpty(input.referenceNumber);
  value.notes = trimOrEmpty(input.notes);
  if (value.notes.length > 2000) errors.notes = "Max 2000 characters.";

  if (!Array.isArray(allocations) || allocations.length === 0) {
    errors.allocations = "At least one allocation is required.";
  } else {
    const allocErrors = [];
    for (let i = 0; i < allocations.length; i++) {
      const a = allocations[i];
      const e = {};
      if (!a.categoryId) e.categoryId = "Category is required.";
      if (!Number.isInteger(a.amountCents) || a.amountCents < 1) {
        e.amountCents = "Amount must be a positive integer (cents).";
      }
      if (typeof a.receiptable !== "boolean") {
        e.receiptable = "Receiptable flag must be set from the category.";
      }
      allocErrors.push(e);
    }
    if (allocErrors.some((e) => Object.keys(e).length > 0)) {
      errors.allocations = allocErrors;
    } else if (Number.isInteger(value.totalAmountCents)) {
      const allocated = sumCents(allocations.map((a) => a.amountCents));
      if (allocated !== value.totalAmountCents) {
        errors.balance = `Allocations (${allocated}¢) must equal total (${value.totalAmountCents}¢).`;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  value.locked = false;
  value.categoryIds = [...new Set(allocations.map((a) => a.categoryId))];
  value.hasReceiptable = allocations.some((a) => a.receiptable);

  return { ok: true, value, allocations };
}
