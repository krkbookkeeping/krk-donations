import { describe, it, expect } from "vitest";
import {
  validateCompany,
  validateDonor,
  validateCategory,
  validatePaymentMethod,
  validateDonation,
  validateOrganizationSettings,
} from "../../src/shared/schemas/validators";

describe("validateCompany", () => {
  it("requires a name", () => {
    expect(validateCompany({ ownerUid: "u1" }).ok).toBe(false);
  });
  it("requires an ownerUid", () => {
    expect(validateCompany({ name: "Acme" }).ok).toBe(false);
  });
  it("accepts a valid company", () => {
    const r = validateCompany({ name: "Acme Charity", ownerUid: "u1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ name: "Acme Charity", ownerUid: "u1" });
  });
  it("trims whitespace on name", () => {
    const r = validateCompany({ name: "  Acme  ", ownerUid: "u1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe("Acme");
  });
  it("rejects over-length names", () => {
    expect(validateCompany({ name: "x".repeat(201), ownerUid: "u1" }).ok).toBe(false);
  });
});

describe("validateDonor", () => {
  it("requires name or org", () => {
    const r = validateDonor({});
    expect(r.ok).toBe(false);
  });

  it("accepts person", () => {
    const r = validateDonor({ firstName: "Ada", lastName: "Lovelace" });
    expect(r.ok).toBe(true);
  });

  it("accepts org", () => {
    const r = validateDonor({ orgName: "Acme Foundation" });
    expect(r.ok).toBe(true);
  });

  it("rejects bad email", () => {
    const r = validateDonor({ orgName: "Acme", email: "not-an-email" });
    expect(r.ok).toBe(false);
  });
});

describe("validateCategory", () => {
  it("requires receiptable flag", () => {
    expect(validateCategory({ name: "General" }).ok).toBe(false);
  });
  it("passes with name + flag", () => {
    expect(validateCategory({ name: "General", receiptable: true }).ok).toBe(true);
  });
});

describe("validatePaymentMethod", () => {
  it("requires a name", () => {
    expect(validatePaymentMethod({}).ok).toBe(false);
  });
  it("passes with a name", () => {
    expect(validatePaymentMethod({ name: "Cash" }).ok).toBe(true);
  });
});

describe("validateDonation (balance)", () => {
  const base = {
    donorId: "d1",
    date: "2026-04-23",
    totalAmountCents: 10000,
    paymentMethodId: "pm1",
  };

  it("rejects when allocations don't balance", () => {
    const r = validateDonation(base, [
      { categoryId: "c1", amountCents: 5000, receiptable: true },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.balance).toBeDefined();
  });

  it("accepts a single balanced allocation", () => {
    const r = validateDonation(base, [
      { categoryId: "c1", amountCents: 10000, receiptable: true },
    ]);
    expect(r.ok).toBe(true);
  });

  it("accepts a split that sums to the total", () => {
    const r = validateDonation(base, [
      { categoryId: "c1", amountCents: 6000, receiptable: true },
      { categoryId: "c2", amountCents: 4000, receiptable: false },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.donation.hasReceiptable).toBe(true);
      expect(r.value.donation.categoryIds).toEqual(["c1", "c2"]);
    }
  });

  it("rejects missing allocations", () => {
    expect(validateDonation(base, []).ok).toBe(false);
  });

  it("rejects non-integer cents", () => {
    const r = validateDonation(base, [
      { categoryId: "c1", amountCents: 10000.5, receiptable: true },
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("validateOrganizationSettings", () => {
  const base = {
    legalName: "Test Charity",
    charityNumber: "123456789RR0001",
    address: {
      line1: "123 Main St",
      city: "Toronto",
      province: "ON",
      postalCode: "M5V 1A1",
      country: "Canada",
    },
    signatory: { name: "Ken", title: "Treasurer" },
  };

  it("accepts a valid org", () => {
    expect(validateOrganizationSettings(base).ok).toBe(true);
  });

  it("rejects invalid charity number format", () => {
    expect(
      validateOrganizationSettings({ ...base, charityNumber: "12345-nope" }).ok
    ).toBe(false);
  });

  it("lowercases charity number to uppercase RR", () => {
    const r = validateOrganizationSettings({ ...base, charityNumber: "123456789rr0001" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.charityNumber).toBe("123456789RR0001");
  });
});
