// Donor validator. Returns { ok: true, value } on success,
// { ok: false, errors: { field: msg, ... } } on failure.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+()-]{7,}$/;
const PREFERRED = new Set(["email", "phone", "mail", "any"]);
const STATUS = new Set(["active", "archived"]);

function trimOrEmpty(v) {
  return typeof v === "string" ? v.trim() : "";
}

export function validateDonor(input) {
  const errors = {};
  const value = {};

  value.firstName = trimOrEmpty(input.firstName);
  value.lastName = trimOrEmpty(input.lastName);
  value.orgName = trimOrEmpty(input.orgName);

  if (!value.orgName && !(value.firstName && value.lastName)) {
    errors.firstName = "Either a first + last name or an organization name is required.";
  }
  if (value.firstName.length > 100) errors.firstName = "Max 100 characters.";
  if (value.lastName.length > 100) errors.lastName = "Max 100 characters.";
  if (value.orgName.length > 200) errors.orgName = "Max 200 characters.";

  value.email = trimOrEmpty(input.email);
  if (value.email && !EMAIL_RE.test(value.email)) {
    errors.email = "Invalid email address.";
  }

  value.phone = trimOrEmpty(input.phone);
  if (value.phone && !PHONE_RE.test(value.phone)) {
    errors.phone = "Phone must be 7+ digits (spaces, +, (), - allowed).";
  }

  if (input.address && typeof input.address === "object") {
    value.address = {
      line1: trimOrEmpty(input.address.line1),
      line2: trimOrEmpty(input.address.line2),
      city: trimOrEmpty(input.address.city),
      province: trimOrEmpty(input.address.province),
      postalCode: trimOrEmpty(input.address.postalCode),
      country: trimOrEmpty(input.address.country) || "Canada",
    };
  } else {
    value.address = null;
  }

  value.preferredContact = input.preferredContact || "any";
  if (!PREFERRED.has(value.preferredContact)) {
    errors.preferredContact = "Must be one of: email, phone, mail, any.";
  }

  value.notes = trimOrEmpty(input.notes);
  if (value.notes.length > 2000) errors.notes = "Max 2000 characters.";

  value.status = input.status || "active";
  if (!STATUS.has(value.status)) errors.status = "Must be active or archived.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}

/**
 * Generate lowercase search tokens from a donor's fields. Called before write.
 */
export function donorSearchTokens(donor) {
  const parts = [
    donor.firstName,
    donor.lastName,
    donor.orgName,
    donor.email,
    donor.phone,
    donor.address?.line1,
    donor.address?.city,
    donor.address?.postalCode,
  ].filter(Boolean);
  const tokens = new Set();
  for (const p of parts) {
    for (const t of String(p).toLowerCase().split(/\s+/)) {
      if (t.length >= 2) tokens.add(t);
    }
  }
  return [...tokens];
}
