// Server-side validators that mirror public/js/schemas/*. Kept intentionally
// aligned with the frontend copy — when one changes, update the other.

import { sumCents } from "../money";
import type {
  Address,
  Allocation,
  Category,
  Company,
  Donation,
  Donor,
  OrganizationSettings,
  PaymentMethod,
  ValidationResult,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+()-]{7,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHARITY_RE = /^\d{9}RR\d{4}$/;
const PREFERRED = new Set(["email", "phone", "mail", "any"]);
const STATUS = new Set(["active", "archived"]);

function trimOrEmpty(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function addressFrom(input: unknown): Address | null {
  if (!input || typeof input !== "object") return null;
  const a = input as Record<string, unknown>;
  return {
    line1: trimOrEmpty(a.line1),
    line2: trimOrEmpty(a.line2),
    city: trimOrEmpty(a.city),
    province: trimOrEmpty(a.province),
    postalCode: trimOrEmpty(a.postalCode),
    country: trimOrEmpty(a.country) || "Canada",
  };
}

export function validateDonor(input: Record<string, unknown>): ValidationResult<Donor> {
  const errors: Record<string, string> = {};

  const firstName = trimOrEmpty(input.firstName);
  const lastName = trimOrEmpty(input.lastName);
  const orgName = trimOrEmpty(input.orgName);

  if (!orgName && !(firstName && lastName)) {
    errors.firstName = "Either a first + last name or an organization name is required.";
  }
  if (firstName.length > 100) errors.firstName = "Max 100 characters.";
  if (lastName.length > 100) errors.lastName = "Max 100 characters.";
  if (orgName.length > 200) errors.orgName = "Max 200 characters.";

  const email = trimOrEmpty(input.email);
  if (email && !EMAIL_RE.test(email)) errors.email = "Invalid email.";

  const phone = trimOrEmpty(input.phone);
  if (phone && !PHONE_RE.test(phone)) errors.phone = "Invalid phone.";

  const preferredContact = (input.preferredContact as string) || "any";
  if (!PREFERRED.has(preferredContact)) errors.preferredContact = "Invalid preferred contact.";

  const notes = trimOrEmpty(input.notes);
  if (notes.length > 2000) errors.notes = "Max 2000 characters.";

  const status = (input.status as string) || "active";
  if (!STATUS.has(status)) errors.status = "Must be active or archived.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      orgName,
      email,
      phone,
      address: addressFrom(input.address),
      preferredContact: preferredContact as Donor["preferredContact"],
      notes,
      status: status as Donor["status"],
      searchTokens: Array.isArray(input.searchTokens) ? (input.searchTokens as string[]) : [],
    },
  };
}

export function validateCompany(input: Record<string, unknown>): ValidationResult<Company> {
  const errors: Record<string, string> = {};
  const name = trimOrEmpty(input.name);
  if (!name) errors.name = "Company name is required.";
  else if (name.length > 200) errors.name = "Max 200 characters.";
  const ownerUid = trimOrEmpty(input.ownerUid);
  if (!ownerUid) errors.ownerUid = "Owner uid is required.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, ownerUid } };
}

export function validateCategory(input: Record<string, unknown>): ValidationResult<Category> {
  const errors: Record<string, string> = {};
  const name = trimOrEmpty(input.name);
  if (!name) errors.name = "Name is required.";
  else if (name.length > 100) errors.name = "Max 100 characters.";
  if (typeof input.receiptable !== "boolean") errors.receiptable = "Receiptable flag required.";
  const status = (input.status as string) || "active";
  if (!STATUS.has(status)) errors.status = "Must be active or archived.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { name, receiptable: input.receiptable as boolean, status: status as Category["status"] },
  };
}

export function validatePaymentMethod(input: Record<string, unknown>): ValidationResult<PaymentMethod> {
  const errors: Record<string, string> = {};
  const name = trimOrEmpty(input.name);
  if (!name) errors.name = "Name is required.";
  else if (name.length > 100) errors.name = "Max 100 characters.";
  const status = (input.status as string) || "active";
  if (!STATUS.has(status)) errors.status = "Must be active or archived.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, status: status as PaymentMethod["status"] } };
}

export function validateDonation(
  input: Record<string, unknown>,
  allocations: Array<Record<string, unknown>>
): ValidationResult<{ donation: Donation; allocations: Allocation[] }> {
  const errors: Record<string, unknown> = {};

  const donorId = trimOrEmpty(input.donorId);
  if (!donorId) errors.donorId = "Donor is required.";

  const date = trimOrEmpty(input.date);
  if (!DATE_RE.test(date)) errors.date = "Date must be YYYY-MM-DD.";

  const totalAmountCents = input.totalAmountCents as number;
  if (!Number.isInteger(totalAmountCents) || totalAmountCents < 1) {
    errors.totalAmountCents = "Total must be a positive integer (cents).";
  }

  const paymentMethodId = trimOrEmpty(input.paymentMethodId);
  if (!paymentMethodId) errors.paymentMethodId = "Payment method is required.";

  const referenceNumber = trimOrEmpty(input.referenceNumber);
  const notes = trimOrEmpty(input.notes);
  if (notes.length > 2000) errors.notes = "Max 2000 characters.";

  const cleaned: Allocation[] = [];
  if (!Array.isArray(allocations) || allocations.length === 0) {
    errors.allocations = "At least one allocation is required.";
  } else {
    const allocErrors: Record<string, string>[] = [];
    for (const a of allocations) {
      const e: Record<string, string> = {};
      const categoryId = trimOrEmpty(a.categoryId);
      if (!categoryId) e.categoryId = "Category is required.";
      const amountCents = a.amountCents as number;
      if (!Number.isInteger(amountCents) || amountCents < 1) {
        e.amountCents = "Amount must be a positive integer (cents).";
      }
      if (typeof a.receiptable !== "boolean") e.receiptable = "Receiptable flag required.";
      allocErrors.push(e);
      if (Object.keys(e).length === 0) {
        cleaned.push({ categoryId, amountCents, receiptable: a.receiptable as boolean });
      }
    }
    if (allocErrors.some((e) => Object.keys(e).length > 0)) {
      errors.allocations = allocErrors;
    } else if (Number.isInteger(totalAmountCents)) {
      const allocated = sumCents(cleaned.map((a) => a.amountCents));
      if (allocated !== totalAmountCents) {
        errors.balance = `Allocations (${allocated}) must equal total (${totalAmountCents}).`;
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      donation: {
        donorId,
        date,
        totalAmountCents,
        paymentMethodId,
        referenceNumber,
        notes,
        locked: false,
        categoryIds: [...new Set(cleaned.map((a) => a.categoryId))],
        hasReceiptable: cleaned.some((a) => a.receiptable),
      },
      allocations: cleaned,
    },
  };
}

export function validateOrganizationSettings(
  input: Record<string, unknown>
): ValidationResult<OrganizationSettings> {
  const errors: Record<string, string> = {};

  const legalName = trimOrEmpty(input.legalName);
  if (!legalName) errors.legalName = "Legal name is required.";

  const charityNumber = trimOrEmpty(input.charityNumber).toUpperCase();
  if (!charityNumber) errors.charityNumber = "Charity number is required.";
  else if (!CHARITY_RE.test(charityNumber)) errors.charityNumber = "Invalid format.";

  const address = addressFrom(input.address) ?? {
    line1: "",
    line2: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Canada",
  };
  if (!address.line1) errors.addressLine1 = "Address line 1 is required.";
  if (!address.city) errors.addressCity = "City is required.";
  if (!address.province) errors.addressProvince = "Province is required.";
  if (!address.postalCode) errors.addressPostalCode = "Postal code is required.";

  const sigIn = (input.signatory || {}) as Record<string, unknown>;
  const signatory = { name: trimOrEmpty(sigIn.name), title: trimOrEmpty(sigIn.title) };
  if (!signatory.name) errors.signatoryName = "Signatory name is required.";

  const tmplIn = (input.receiptTemplate || {}) as Record<string, unknown>;
  const receiptTemplate = {
    headerText: trimOrEmpty(tmplIn.headerText),
    bodyText: trimOrEmpty(tmplIn.bodyText),
    footerText: trimOrEmpty(tmplIn.footerText),
  };

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      legalName,
      charityNumber,
      address,
      signatory,
      logoUrl: trimOrEmpty(input.logoUrl) || null,
      signatureUrl: trimOrEmpty(input.signatureUrl) || null,
      receiptTemplate,
    },
  };
}
