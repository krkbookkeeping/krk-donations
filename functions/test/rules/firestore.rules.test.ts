// Firestore rules emulator tests — multi-company edition.
// Run with: npm run test:rules (requires Firebase CLI and starts the emulator).

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";

const PROJECT_ID = "krk-donations-test";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(path.resolve(__dirname, "../../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

async function seedUser(uid: string, companyIds: string[] = [], activeCompanyId: string | null = null) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `users/${uid}`), {
      email: `${uid}@test`,
      displayName: null,
      role: "admin",
      companyIds,
      activeCompanyId,
    });
  });
}

async function seedCompany(companyId: string, ownerUid: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `companies/${companyId}`), {
      name: `Company ${companyId}`,
      ownerUid,
    });
  });
}

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe("Firestore rules — global", () => {
  it("denies unauthenticated reads anywhere", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "companies/any/donors/x")));
  });

  it("allows user to self-create own user doc with role=admin and empty companyIds", async () => {
    const db = env.authenticatedContext("newUser").firestore();
    await assertSucceeds(
      setDoc(doc(db, "users/newUser"), {
        email: "newUser@test",
        displayName: null,
        role: "admin",
        companyIds: [],
        activeCompanyId: null,
        createdAt: new Date(),
      })
    );
  });

  it("denies self-create with non-empty companyIds (clients cannot grant themselves access)", async () => {
    const db = env.authenticatedContext("evil").firestore();
    await assertFails(
      setDoc(doc(db, "users/evil"), {
        email: "evil@test",
        displayName: null,
        role: "admin",
        companyIds: ["some-company"],
        activeCompanyId: "some-company",
        createdAt: new Date(),
      })
    );
  });

  it("denies self-create with role != admin", async () => {
    const db = env.authenticatedContext("evil").firestore();
    await assertFails(
      setDoc(doc(db, "users/evil"), {
        email: "evil@test",
        displayName: null,
        role: "superuser",
        companyIds: [],
        activeCompanyId: null,
        createdAt: new Date(),
      })
    );
  });

  it("denies user from creating a user doc with a different uid", async () => {
    const db = env.authenticatedContext("a").firestore();
    await assertFails(
      setDoc(doc(db, "users/b"), {
        email: "b@test",
        displayName: null,
        role: "admin",
        companyIds: [],
        activeCompanyId: null,
        createdAt: new Date(),
      })
    );
  });

  it("allows user to update their own activeCompanyId to a value in their companyIds", async () => {
    await seedUser("u1", ["c1", "c2"], "c1");
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(updateDoc(doc(db, "users/u1"), { activeCompanyId: "c2" }));
  });

  it("denies user from setting activeCompanyId to a company they don't belong to", async () => {
    await seedUser("u1", ["c1"], "c1");
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(updateDoc(doc(db, "users/u1"), { activeCompanyId: "c-other" }));
  });

  it("denies user from self-adding companyIds (server-only field)", async () => {
    await seedUser("u1", ["c1"], "c1");
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(updateDoc(doc(db, "users/u1"), { companyIds: ["c1", "c-stolen"] }));
  });

  it("denies user from reading another user's doc", async () => {
    await seedUser("u1");
    await seedUser("u2");
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(getDoc(doc(db, "users/u2")));
  });

  it("denies client writes to companies/{id}", async () => {
    await seedUser("u1");
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(
      setDoc(doc(db, "companies/newCo"), { name: "New Co", ownerUid: "u1" })
    );
  });

  it("allows member to read their own company doc", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(getDoc(doc(db, "companies/c1")));
  });

  it("denies non-member from reading a company doc", async () => {
    await seedUser("u1", ["c1"]);
    await seedUser("u2", []);
    await seedCompany("c1", "u1");
    const db = env.authenticatedContext("u2").firestore();
    await assertFails(getDoc(doc(db, "companies/c1")));
  });
});

describe("Firestore rules — company-scoped", () => {
  it("allows member to read donors in their company", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    await seed("companies/c1/donors/d1", { firstName: "Ada", lastName: "Lovelace", status: "active" });
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(getDoc(doc(db, "companies/c1/donors/d1")));
  });

  it("allows member to create a donor in their company", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(
      setDoc(doc(db, "companies/c1/donors/d2"), {
        firstName: "Grace",
        lastName: "Hopper",
        status: "active",
      })
    );
  });

  it("denies non-member from reading donors in another company", async () => {
    await seedUser("u1", ["c1"]);
    await seedUser("u2", ["c-other"]);
    await seedCompany("c1", "u1");
    await seed("companies/c1/donors/d1", { firstName: "Ada", lastName: "Lovelace", status: "active" });
    const db = env.authenticatedContext("u2").firestore();
    await assertFails(getDoc(doc(db, "companies/c1/donors/d1")));
  });

  it("denies non-member from writing donors into another company", async () => {
    await seedUser("u1", ["c1"]);
    await seedUser("u2", []);
    await seedCompany("c1", "u1");
    const db = env.authenticatedContext("u2").firestore();
    await assertFails(
      setDoc(doc(db, "companies/c1/donors/d-injected"), {
        firstName: "X",
        lastName: "Y",
        status: "active",
      })
    );
  });

  it("denies hard delete of donors", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    await seed("companies/c1/donors/d1", { firstName: "X", lastName: "Y", status: "active" });
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(deleteDoc(doc(db, "companies/c1/donors/d1")));
  });

  it("denies creating a donation with locked=true from the client", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(
      setDoc(doc(db, "companies/c1/donations/new1"), {
        donorId: "d1",
        date: "2026-04-23",
        totalAmountCents: 10000,
        paymentMethodId: "pm1",
        locked: true,
      })
    );
  });

  it("denies updating a locked donation", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    await seed("companies/c1/donations/dx", {
      donorId: "d1",
      date: "2026-04-23",
      totalAmountCents: 10000,
      paymentMethodId: "pm1",
      locked: true,
    });
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(updateDoc(doc(db, "companies/c1/donations/dx"), { notes: "hi" }));
  });

  it("allows updating an unlocked donation", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    await seed("companies/c1/donations/dy", {
      donorId: "d1",
      date: "2026-04-23",
      totalAmountCents: 10000,
      paymentMethodId: "pm1",
      locked: false,
    });
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(updateDoc(doc(db, "companies/c1/donations/dy"), { notes: "updated" }));
  });

  it("denies client writes to receipts", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(
      setDoc(doc(db, "companies/c1/receipts/r1"), { number: "2026-0001", year: 2026 })
    );
  });

  it("allows member to read receipts", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    await seed("companies/c1/receipts/r1", { number: "2026-0001", year: 2026, status: "issued" });
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(getDoc(doc(db, "companies/c1/receipts/r1")));
  });

  it("denies client writes to auditLog", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(
      setDoc(doc(db, "companies/c1/auditLog/a1"), { action: "anything" })
    );
  });

  it("denies all access to counters", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    await seed("companies/c1/counters/receiptSequence", { year: 2026, nextNumber: 1 });
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(getDoc(doc(db, "companies/c1/counters/receiptSequence")));
  });

  it("denies allocation writes when parent donation is locked", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    await seed("companies/c1/donations/dz", {
      donorId: "d1",
      date: "2026-04-23",
      totalAmountCents: 10000,
      paymentMethodId: "pm1",
      locked: true,
    });
    const db = env.authenticatedContext("u1").firestore();
    await assertFails(
      setDoc(doc(db, "companies/c1/donations/dz/allocations/a1"), {
        categoryId: "c1",
        amountCents: 10000,
        receiptable: true,
      })
    );
  });

  it("allows member to read/write their own company settings", async () => {
    await seedUser("u1", ["c1"]);
    await seedCompany("c1", "u1");
    const db = env.authenticatedContext("u1").firestore();
    await assertSucceeds(
      setDoc(doc(db, "companies/c1/settings/main"), {
        legalName: "Example Charity",
        charityNumber: "123456789RR0001",
      })
    );
  });

  it("denies non-member from reading another company's settings", async () => {
    await seedUser("u1", ["c1"]);
    await seedUser("u2", []);
    await seedCompany("c1", "u1");
    await seed("companies/c1/settings/main", { legalName: "Example Charity" });
    const db = env.authenticatedContext("u2").firestore();
    await assertFails(getDoc(doc(db, "companies/c1/settings/main")));
  });
});
