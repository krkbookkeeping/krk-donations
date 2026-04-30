import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const REGION = "northamerica-northeast2";

interface MergeRequest {
  companyId: string;
  primaryId: string;
  secondaryIds: string[];
  resolvedFields: Record<string, unknown>;
}

// mergeDonors — atomically merges one or more secondary donor records into a
// primary. The caller supplies resolved field values (the result of the UI's
// conflict-resolution step). The function:
//   1. Updates the primary donor with resolved fields.
//   2. Archives each secondary (status="archived", mergedIntoId=primaryId).
//   3. Reassigns all donations whose donorId is in secondaryIds to primaryId.
//   4. Writes an audit entry recording the full merge.
//
// Steps 1-2-4 run in a Firestore transaction (atomic). Step 3 runs in batches
// of up to 499 writes (outside the transaction but idempotent on retry).
export async function runMerge(
  callerUid: string,
  data: MergeRequest
): Promise<{ primaryId: string; donationsReassigned: number }> {
  const { companyId, primaryId, secondaryIds, resolvedFields } = data;

  if (!companyId || !primaryId || !Array.isArray(secondaryIds) || secondaryIds.length === 0) {
    throw new HttpsError("invalid-argument", "companyId, primaryId, and at least one secondaryId are required.");
  }
  if (secondaryIds.includes(primaryId)) {
    throw new HttpsError("invalid-argument", "Primary donor cannot also be a secondary.");
  }
  if (secondaryIds.length > 10) {
    throw new HttpsError("invalid-argument", "Maximum 10 secondaries per merge operation.");
  }

  const fs = getFirestore();
  const base = `companies/${companyId}`;

  // Verify caller is a member of this company.
  const userSnap = await fs.doc(`users/${callerUid}`).get();
  if (!userSnap.exists) throw new HttpsError("not-found", "User doc missing.");
  const userData = userSnap.data() as { companyIds?: string[] };
  if (!userData.companyIds?.includes(companyId)) {
    throw new HttpsError("permission-denied", "Not a member of that company.");
  }

  // --- Step 1 & 2: atomic donor updates + audit ---------------------
  await fs.runTransaction(async (tx) => {
    const primaryRef = fs.doc(`${base}/donors/${primaryId}`);
    const primarySnap = await tx.get(primaryRef);
    if (!primarySnap.exists) throw new HttpsError("not-found", `Primary donor ${primaryId} not found.`);

    const secondarySnaps = await Promise.all(
      secondaryIds.map((id) => tx.get(fs.doc(`${base}/donors/${id}`)))
    );
    for (const snap of secondarySnaps) {
      if (!snap.exists) throw new HttpsError("not-found", `Secondary donor ${snap.id} not found.`);
    }

    // Sanitise resolved fields — only allow known donor fields, never
    // system fields like status, searchTokens, createdAt, etc.
    const ALLOWED = new Set([
      "firstName", "lastName", "orgName", "email", "phone",
      "address", "preferredContact", "notes",
    ]);
    const safeResolved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(resolvedFields ?? {})) {
      if (ALLOWED.has(k)) safeResolved[k] = v;
    }

    // Recompute searchTokens from the merged donor's data.
    const mergedBase = { ...primarySnap.data(), ...safeResolved };
    const tokens = buildSearchTokens(mergedBase);

    tx.update(primaryRef, {
      ...safeResolved,
      searchTokens: tokens,
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (const snap of secondarySnaps) {
      tx.update(snap.ref, {
        status: "archived",
        mergedIntoId: primaryId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const auditRef = fs.collection(`${base}/auditLog`).doc();
    const before: Record<string, unknown> = { primaryId };
    const after: Record<string, unknown> = { primaryId, mergedSecondaries: secondaryIds, resolvedFields: safeResolved };
    for (const snap of secondarySnaps) {
      before[snap.id] = snap.data();
    }
    tx.set(auditRef, {
      at: FieldValue.serverTimestamp(),
      actorUid: callerUid,
      action: "donor.merge",
      entityType: "donor",
      entityId: primaryId,
      before,
      after,
      metadata: { secondaryIds },
    });
  });

  // --- Step 3: reassign donations (batched, outside transaction) ----
  let donationsReassigned = 0;
  for (const secondaryId of secondaryIds) {
    const snap = await fs
      .collection(`${base}/donations`)
      .where("donorId", "==", secondaryId)
      .get();

    let batch = fs.batch();
    let batchCount = 0;
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, { donorId: primaryId });
      batchCount++;
      donationsReassigned++;
      if (batchCount === 499) {
        await batch.commit();
        batch = fs.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) await batch.commit();
  }

  return { primaryId, donationsReassigned };
}

export function buildSearchTokens(donor: Record<string, unknown>): string[] {
  const tokens = new Set<string>();

  function addWords(str: unknown) {
    if (!str) return;
    for (const t of String(str).toLowerCase().split(/\s+/)) {
      if (t.length >= 2) tokens.add(t);
    }
  }

  function addNgrams(str: unknown, minLen: number, maxLen: number) {
    if (!str) return;
    const norm = String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm.length < minLen) return;
    for (let len = minLen; len <= Math.min(maxLen, norm.length); len++) {
      for (let i = 0; i <= norm.length - len; i++) {
        tokens.add(norm.slice(i, i + len));
      }
    }
  }

  addWords(donor.firstName);
  addWords(donor.lastName);
  addWords(donor.orgName);
  addWords(donor.email);

  if (donor.phone) {
    const digits = String(donor.phone).replace(/\D/g, "");
    if (digits.length >= 2) tokens.add(digits);
    addNgrams(digits, 4, 6);
  }

  const addr = donor.address as Record<string, unknown> | null | undefined;
  if (addr) {
    addWords(addr.city);
    addWords(addr.postalCode);
    if (addr.line1) {
      addWords(addr.line1);
      addNgrams(addr.line1, 3, 6);
    }
    if (addr.line2) {
      addWords(addr.line2);
      addNgrams(addr.line2, 3, 6);
    }
  }

  return [...tokens];
}

export const mergeDonors = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required.");
  return runMerge(request.auth.uid, request.data as MergeRequest);
});
