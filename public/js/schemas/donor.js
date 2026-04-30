// Donor validator + search token generator.

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
      line1:      trimOrEmpty(input.address.line1),
      line2:      trimOrEmpty(input.address.line2),
      city:       trimOrEmpty(input.address.city),
      province:   trimOrEmpty(input.address.province),
      postalCode: trimOrEmpty(input.address.postalCode),
      country:    trimOrEmpty(input.address.country) || "Canada",
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

// ─────────────────────────────────────────────────────────────────────────────
// Token helpers

function addWords(tokens, str) {
  if (!str) return;
  for (const t of String(str).toLowerCase().split(/\s+/)) {
    if (t.length >= 2) tokens.add(t);
  }
}

// Generates all substrings of `str` (lowercased, alphanumeric only)
// with length in [minLen, maxLen]. Used for partial phone/address matching.
function addNgrams(tokens, str, minLen, maxLen) {
  if (!str) return;
  const norm = String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.length < minLen) return;
  for (let len = minLen; len <= Math.min(maxLen, norm.length); len++) {
    for (let i = 0; i <= norm.length - len; i++) {
      tokens.add(norm.slice(i, i + len));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// donorSearchTokens — called at write time to populate the searchTokens array.
//
// Generates:
//   • Word tokens (split on whitespace) for name, email, org
//   • The full digit-stripped phone string + 4-6 char sliding windows
//     so partial phone searches ("0100", "416", "55501") work
//   • Word tokens + 3-6 char n-grams for address lines
//     so partial address searches ("99st", "mainst", "456elm") work
export function donorSearchTokens(donor) {
  const tokens = new Set();

  addWords(tokens, donor.firstName);
  addWords(tokens, donor.lastName);
  addWords(tokens, donor.orgName);
  addWords(tokens, donor.email);

  if (donor.phone) {
    const digits = String(donor.phone).replace(/\D/g, "");
    if (digits.length >= 2) tokens.add(digits);   // full stripped
    addNgrams(tokens, digits, 4, 6);               // 4-6 char windows
  }

  const addr = donor.address;
  if (addr) {
    addWords(tokens, addr.city);
    addWords(tokens, addr.postalCode);
    if (addr.line1) {
      addWords(tokens, addr.line1);
      addNgrams(tokens, addr.line1, 3, 6);
    }
    if (addr.line2) {
      addWords(tokens, addr.line2);
      addNgrams(tokens, addr.line2, 3, 6);
    }
  }

  return [...tokens];
}

// ─────────────────────────────────────────────────────────────────────────────
// donorQueryTokens — tokenize a user's raw search string for array-contains-any.
//
// Intentionally simple: split on whitespace, add the original word AND its
// alphanumeric-stripped form (e.g. "416-555" → also "416555"). Does NOT
// generate all n-grams — keeps the result well within Firestore's 30-value limit.
export function donorQueryTokens(rawQuery) {
  const tokens = new Set();
  for (const part of rawQuery.toLowerCase().split(/\s+/)) {
    if (part.length < 2) continue;
    tokens.add(part);
    const norm = part.replace(/[^a-z0-9]/g, "");
    if (norm.length >= 2 && norm !== part) tokens.add(norm);
  }
  return [...tokens].slice(0, 10);
}
