import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { validateCompany } from "./shared/schemas/validators";
import { mergeDonors } from "./mergeDonors";

initializeApp();

export { mergeDonors };

// All callables are pinned to Toronto for data-residency alignment with the
// Firestore (northamerica-northeast2) database.
const REGION = "northamerica-northeast2";

// Trivial wiring test. Kept through Phase 1/2; remove once enough real
// callables exist that this no longer adds value.
export const ping = onCall({ region: REGION }, (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }
  return { ok: true, uid: request.auth.uid, ts: Date.now() };
});

// createCompany — atomic creation of a new company plus membership grant.
//
// Client calls: httpsCallable("createCompany")({ name })
// Server:
//   1. Validate the name.
//   2. Ensure the caller has a users/{uid} doc with role=admin.
//   3. In a transaction:
//        - Create companies/{newId} with { name, ownerUid, createdAt }.
//        - arrayUnion newId into users/{uid}.companyIds.
//        - If users/{uid}.activeCompanyId is null, set it to newId.
//        - Write an audit entry under companies/{newId}/auditLog.
//   4. Return { companyId: newId }.
//
// This is the only path that mutates users.companyIds — the Firestore rules
// deny client writes to that field.
export const createCompany = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }
  const uid = request.auth.uid;
  const input = (request.data || {}) as Record<string, unknown>;

  const parsed = validateCompany({ name: input.name, ownerUid: uid });
  if (!parsed.ok) {
    throw new HttpsError("invalid-argument", "Invalid company", parsed.errors);
  }

  const fs = getFirestore();
  const userRef = fs.doc(`users/${uid}`);
  const newCompanyRef = fs.collection("companies").doc();
  const auditRef = newCompanyRef.collection("auditLog").doc();

  await fs.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "User doc missing — sign out and in again."
      );
    }
    const userData = userSnap.data() as { role?: string; activeCompanyId?: string | null };
    if (userData.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin role required.");
    }

    tx.set(newCompanyRef, {
      name: parsed.value.name,
      ownerUid: uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    const userUpdate: Record<string, unknown> = {
      companyIds: FieldValue.arrayUnion(newCompanyRef.id),
    };
    if (!userData.activeCompanyId) {
      userUpdate.activeCompanyId = newCompanyRef.id;
    }
    tx.update(userRef, userUpdate);

    tx.set(auditRef, {
      at: FieldValue.serverTimestamp(),
      actorUid: uid,
      action: "company.create",
      entityType: "company",
      entityId: newCompanyRef.id,
      after: { name: parsed.value.name, ownerUid: uid },
    });
  });

  return { companyId: newCompanyRef.id };
});
