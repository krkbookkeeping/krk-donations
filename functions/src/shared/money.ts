// Mirror of public/js/money.js for server-side use. Must stay behaviourally
// identical — every test in money.test.ts exercises both implementations by
// importing this file; the frontend copy is kept in sync by convention.

const CENT_RE = /^-?\d+(\.\d{0,2})?$/;

export function toCents(input: string | number): number | null {
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

export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-CA");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}$${whole}.${frac}`;
}

export function sumCents(amounts: number[]): number | null {
  let total = 0;
  for (const a of amounts) {
    if (!Number.isInteger(a)) return null;
    total += a;
  }
  return total;
}
