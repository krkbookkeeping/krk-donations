import { describe, it, expect } from "vitest";
import { toCents, formatCents, sumCents } from "../../src/shared/money";

describe("toCents", () => {
  it("parses whole dollars", () => {
    expect(toCents("12")).toBe(1200);
    expect(toCents("0")).toBe(0);
  });

  it("parses one-decimal dollars", () => {
    expect(toCents("12.3")).toBe(1230);
  });

  it("parses two-decimal dollars", () => {
    expect(toCents("12.34")).toBe(1234);
    expect(toCents("0.01")).toBe(1);
    expect(toCents("0.99")).toBe(99);
  });

  it("strips dollar signs, commas, whitespace", () => {
    expect(toCents("  $1,234.56  ")).toBe(123456);
    expect(toCents("$100")).toBe(10000);
  });

  it("parses numbers", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0)).toBe(0);
    // Float precision edge: 0.1 + 0.2 = 0.30000000000000004
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it("rejects fractional cents beyond two decimals", () => {
    expect(toCents("12.345")).toBeNull();
    expect(toCents("1.005")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(toCents("abc")).toBeNull();
    expect(toCents("")).toBeNull();
    expect(toCents("12.3.4")).toBeNull();
    expect(toCents(NaN)).toBeNull();
    expect(toCents(Infinity)).toBeNull();
    expect(toCents(null as unknown as string)).toBeNull();
  });

  it("handles negatives", () => {
    expect(toCents("-12.34")).toBe(-1234);
    expect(toCents(-0.5)).toBe(-50);
  });
});

describe("formatCents", () => {
  it("formats basic amounts", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(1)).toBe("$0.01");
    expect(formatCents(1234)).toBe("$12.34");
  });

  it("adds thousands separators", () => {
    expect(formatCents(100000)).toBe("$1,000.00");
    expect(formatCents(123456789)).toBe("$1,234,567.89");
  });

  it("formats negatives", () => {
    expect(formatCents(-1234)).toBe("-$12.34");
  });

  it("returns empty for non-integer", () => {
    expect(formatCents(12.5)).toBe("");
    expect(formatCents(NaN)).toBe("");
  });
});

describe("sumCents", () => {
  it("sums integer arrays", () => {
    expect(sumCents([100, 200, 300])).toBe(600);
    expect(sumCents([])).toBe(0);
  });

  it("returns null on non-integer element", () => {
    expect(sumCents([100, 2.5, 300])).toBeNull();
  });

  it("handles large sums without float drift", () => {
    // 10,000 × $0.01 = $100.00, not $99.99999999... as floats would give
    const cents = Array(10000).fill(1);
    expect(sumCents(cents)).toBe(10000);
  });
});
