// Organization settings validator. The charity number format is CRA-prescribed
// as 9 digits + "RR" + 4 digits.

const CHARITY_RE = /^\d{9}RR\d{4}$/;

function trimOrEmpty(v) {
  return typeof v === "string" ? v.trim() : "";
}

export function validateOrganizationSettings(input) {
  const errors = {};
  const value = {};

  value.legalName = trimOrEmpty(input.legalName);
  if (!value.legalName) errors.legalName = "Legal name is required.";

  value.charityNumber = trimOrEmpty(input.charityNumber).toUpperCase();
  if (!value.charityNumber) errors.charityNumber = "Charity number is required.";
  else if (!CHARITY_RE.test(value.charityNumber)) {
    errors.charityNumber = "Must be 9 digits, RR, 4 digits (e.g. 123456789RR0001).";
  }

  const addr = input.address || {};
  value.address = {
    line1: trimOrEmpty(addr.line1),
    line2: trimOrEmpty(addr.line2),
    city: trimOrEmpty(addr.city),
    province: trimOrEmpty(addr.province),
    postalCode: trimOrEmpty(addr.postalCode),
    country: trimOrEmpty(addr.country) || "Canada",
  };
  if (!value.address.line1) errors.addressLine1 = "Address line 1 is required.";
  if (!value.address.city) errors.addressCity = "City is required.";
  if (!value.address.province) errors.addressProvince = "Province is required.";
  if (!value.address.postalCode) errors.addressPostalCode = "Postal code is required.";

  const sig = input.signatory || {};
  value.signatory = {
    name: trimOrEmpty(sig.name),
    title: trimOrEmpty(sig.title),
  };
  if (!value.signatory.name) errors.signatoryName = "Signatory name is required.";

  value.logoUrl = trimOrEmpty(input.logoUrl) || null;
  value.signatureUrl = trimOrEmpty(input.signatureUrl) || null;

  const tmpl = input.receiptTemplate || {};
  value.receiptTemplate = {
    headerText: trimOrEmpty(tmpl.headerText),
    bodyText: trimOrEmpty(tmpl.bodyText),
    footerText: trimOrEmpty(tmpl.footerText),
  };

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}
