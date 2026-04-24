// Mirrors functions/src/shared/schemas/validators.ts :: validateCompany.
// The company registry doc is created server-side only, but the frontend
// uses this validator to pre-check the onboarding form before calling the
// createCompany Cloud Function.

export function validateCompany(input) {
  const errors = {};
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  if (!name) errors.name = "Company name is required.";
  else if (name.length > 200) errors.name = "Max 200 characters.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name } };
}
