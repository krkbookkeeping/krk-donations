import { describe, it, expect, vi } from "vitest";

// Must be hoisted before the mergeDonors import so Vitest replaces the module.
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({
    doc: vi.fn(),
    collection: vi.fn(),
    runTransaction: vi.fn(),
    batch: vi.fn(),
  })),
  FieldValue: { serverTimestamp: vi.fn(() => "SERVER_TS") },
}));

import { buildSearchTokens, runMerge } from "../../src/mergeDonors";

// ── buildSearchTokens ─────────────────────────────────────────────────────

describe("buildSearchTokens", () => {
  it("tokenizes first and last name", () => {
    const tokens = buildSearchTokens({ firstName: "John", lastName: "Smith" });
    expect(tokens).toContain("john");
    expect(tokens).toContain("smith");
  });

  it("tokenizes org name", () => {
    const tokens = buildSearchTokens({ orgName: "Hope Community Church" });
    expect(tokens).toContain("hope");
    expect(tokens).toContain("community");
    expect(tokens).toContain("church");
  });

  it("tokenizes email and phone", () => {
    const tokens = buildSearchTokens({ email: "ada@example.com", phone: "416-555-0100" });
    expect(tokens).toContain("ada@example.com");
    expect(tokens).toContain("416-555-0100");
  });

  it("tokenizes address fields", () => {
    const tokens = buildSearchTokens({
      address: { line1: "123 Main St", city: "Toronto", postalCode: "M5V1A1" },
    });
    expect(tokens).toContain("123");
    expect(tokens).toContain("main");
    expect(tokens).toContain("toronto");
    expect(tokens).toContain("m5v1a1");
  });

  it("deduplicates tokens", () => {
    const tokens = buildSearchTokens({ firstName: "ada", lastName: "ada" });
    const count = tokens.filter((t) => t === "ada").length;
    expect(count).toBe(1);
  });

  it("filters out single-character tokens", () => {
    const tokens = buildSearchTokens({ firstName: "A", lastName: "B" });
    expect(tokens.every((t) => t.length >= 2)).toBe(true);
  });

  it("lowercases everything", () => {
    const tokens = buildSearchTokens({ firstName: "UPPERCASE", lastName: "MixedCase" });
    expect(tokens).toContain("uppercase");
    expect(tokens).toContain("mixedcase");
    expect(tokens.every((t) => t === t.toLowerCase())).toBe(true);
  });

  it("returns an empty array when no data", () => {
    expect(buildSearchTokens({})).toEqual([]);
  });
});

// ── runMerge input validation ─────────────────────────────────────────────
// These assertions throw before getFirestore() is ever called, so no
// emulator or Firestore setup is needed.

describe("runMerge – input validation", () => {
  it("rejects missing companyId", async () => {
    await expect(
      runMerge("uid1", {
        companyId: "",
        primaryId: "p1",
        secondaryIds: ["s1"],
        resolvedFields: {},
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects missing primaryId", async () => {
    await expect(
      runMerge("uid1", {
        companyId: "c1",
        primaryId: "",
        secondaryIds: ["s1"],
        resolvedFields: {},
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects empty secondaryIds array", async () => {
    await expect(
      runMerge("uid1", {
        companyId: "c1",
        primaryId: "p1",
        secondaryIds: [],
        resolvedFields: {},
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects non-array secondaryIds", async () => {
    await expect(
      runMerge("uid1", {
        companyId: "c1",
        primaryId: "p1",
        secondaryIds: "s1" as unknown as string[],
        resolvedFields: {},
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects primaryId appearing in secondaryIds", async () => {
    await expect(
      runMerge("uid1", {
        companyId: "c1",
        primaryId: "p1",
        secondaryIds: ["p1"],
        resolvedFields: {},
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects more than 10 secondaries", async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `s${i}`);
    await expect(
      runMerge("uid1", {
        companyId: "c1",
        primaryId: "p1",
        secondaryIds: ids,
        resolvedFields: {},
      })
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("accepts exactly 10 secondaries (passes validation)", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `s${i}`);
    // Passes validation but then hits Firestore (mocked to return nothing useful).
    // We just care that it does NOT throw an "invalid-argument" error.
    await expect(
      runMerge("uid1", {
        companyId: "c1",
        primaryId: "p1",
        secondaryIds: ids,
        resolvedFields: {},
      })
    ).rejects.not.toMatchObject({ code: "invalid-argument" });
  });
});
