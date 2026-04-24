// Money helpers. All monetary values in the system are integer cents.
// Floats are banned. Every dollar string / amount input must round-trip
// through these helpers.

const CENT_RE = /^-?\d+(\.\d{0,2})?$/;

/**
 * Parse a dollar string or number into integer cents.
 * Accepts "12", "12.3", "12.34", "$12.34", "1,234.56".
 * Rejects anything with fractional cents.
 * Returns an integer, or null if invalid.
 */
export function toCents(input) {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  if (typeof input !== "string") return null;
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (cleaned === "" || !CENT_RE.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const wholeInt = parseInt(whole, 10);
  const fracInt = parseInt((frac + "00").slice(0, 2), 10);
  const sign = whole.startsWith("-") ? -1 : 1;
  return sign * (Math.abs(wholeInt) * 100 + fracInt);
}

/**
 * Format integer cents as a CAD dollar string with thousands separators.
 * 1234 -> "$12.34", 0 -> "$0.00", 100000 -> "$1,000.00".
 */
export function formatCents(cents) {
  if (!Number.isInteger(cents)) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-CA");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}$${whole}.${frac}`;
}

/**
 * Sum an array of integer cents. Returns 0 for empty, null if any element
 * is not an integer (caller must validate upstream).
 */
export function sumCents(amounts) {
  let total = 0;
  for (const a of amounts) {
    if (!Number.isInteger(a)) return null;
    total += a;
  }
  return total;
}
