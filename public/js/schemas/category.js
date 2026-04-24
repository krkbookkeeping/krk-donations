// Category validator.

const STATUS = new Set(["active", "archived"]);

function trimOrEmpty(v) {
  return typeof v === "string" ? v.trim() : "";
}

export function validateCategory(input) {
  const errors = {};
  const value = {};

  value.name = trimOrEmpty(input.name);
  if (!value.name) errors.name = "Name is required.";
  else if (value.name.length > 100) errors.name = "Max 100 characters.";

  if (typeof input.receiptable !== "boolean") {
    errors.receiptable = "Receiptable flag is required.";
  } else {
    value.receiptable = input.receiptable;
  }

  value.status = input.status || "active";
  if (!STATUS.has(value.status)) errors.status = "Must be active or archived.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}
