import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const REGION = "northamerica-northeast2";

interface GenerateReceiptRequest {
  companyId: string;
  donorId: string;
  year: number;
}

interface VoidReceiptRequest {
  companyId: string;
  receiptId: string;
}

// Verify the caller belongs to the company. Returns user data.
async function assertMember(fs: FirebaseFirestore.Firestore, uid: string, companyId: string) {
  const snap = await fs.doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "User doc missing.");
  const data = snap.data() as { companyIds?: string[] };
  if (!data.companyIds?.includes(companyId)) {
    throw new HttpsError("permission-denied", "Not a member of that company.");
  }
}

export async function runGenerateReceipt(
  callerUid: string,
  data: GenerateReceiptRequest
): Promise<Record<string, unknown>> {
  const { companyId, donorId, year } = data;

  if (!companyId || !donorId || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpsError("invalid-argument", "companyId, donorId, and a valid year (2000–2100) are required.");
  }

  const fs = getFirestore();
  const base = `companies/${companyId}`;

  await assertMember(fs, callerUid, companyId);

  // Fetch org settings — must be complete before any receipt can be issued.
  const settingsSnap = await fs.doc(`${base}/settings/org`).get();
  if (!settingsSnap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Organization settings are not configured. Complete Settings before generating receipts."
    );
  }
  const org = settingsSnap.data() as {
    legalName?: string;
    charityNumber?: string;
    address?: Record<string, unknown>;
    signatory?: { name?: string; title?: string };
    receiptTemplate?: { headerText?: string; bodyText?: string; footerText?: string };
    signatureUrl?: string;
  };
  if (!org.legalName || !org.charityNumber) {
    throw new HttpsError(
      "failed-precondition",
      "Organization settings are incomplete (legal name and charity number are required)."
    );
  }

  // Fetch donor — snapshot name + address onto the receipt.
  const donorSnap = await fs.doc(`${base}/donors/${donorId}`).get();
  if (!donorSnap.exists) throw new HttpsError("not-found", "Donor not found.");
  const donor = donorSnap.data() as {
    firstName?: string; lastName?: string; orgName?: string;
    address?: Record<string, unknown>;
  };
  const donorName = donor.orgName ||
    [donor.firstName, donor.lastName].filter(Boolean).join(" ") ||
    "Unknown";

  // Fetch all donations for this donor (single-field query — no composite index needed).
  // Filter date, status, hasReceiptable, locked in code.
  const startDate = `${year}-01-01`;
  const endDate   = `${year}-12-31`;

  const allDonations = await fs.collection(`${base}/donations`)
    .where("donorId", "==", donorId)
    .get();

  const eligible = allDonations.docs
    .filter((d) => {
      const x = d.data();
      return x.status === "active"
        && x.hasReceiptable === true
        && x.locked !== true
        && x.date >= startDate
        && x.date <= endDate;
    })
    .map((d) => ({
      donationId:              d.id,
      date:                    d.data().date as string,
      totalAmountCents:        (d.data().totalAmountCents as number) || 0,
      receiptableAmountCents:  (d.data().receiptableAmountCents as number) || 0,
      notes:                   (d.data().notes as string) || "",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));  // chronological for the PDF

  if (eligible.length === 0) {
    throw new HttpsError(
      "not-found",
      "No unlocked receiptable donations found for this donor and year."
    );
  }

  const totalReceiptableAmountCents = eligible.reduce((s, d) => s + d.receiptableAmountCents, 0);
  if (totalReceiptableAmountCents === 0) {
    throw new HttpsError("failed-precondition", "Total receiptable amount is $0.");
  }

  // Atomic: assign receipt number + create receipt + lock donations.
  const counterRef = fs.doc(`${base}/counters/receipts`);
  const receiptRef = fs.collection(`${base}/receipts`).doc();
  const donationRefs = eligible.map((d) => fs.doc(`${base}/donations/${d.donationId}`));
  const now = new Date();
  let receiptNumber = "";

  await fs.runTransaction(async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const nextNum: number = counterSnap.exists
      ? ((counterSnap.data()!.nextNumber as number) || 1)
      : 1;
    receiptNumber = `${year}-${String(nextNum).padStart(4, "0")}`;

    if (counterSnap.exists) {
      tx.update(counterRef, { nextNumber: nextNum + 1 });
    } else {
      tx.set(counterRef, { nextNumber: nextNum + 1 });
    }

    tx.set(receiptRef, {
      receiptNumber,
      donorId,
      donorName,
      donorAddress:               donor.address ?? null,
      year,
      totalReceiptableAmountCents,
      donations:                  eligible,
      status:                     "issued",
      issuedAt:                   FieldValue.serverTimestamp(),
      issuedBy:                   callerUid,
      orgSnapshot: {
        legalName:       org.legalName,
        charityNumber:   org.charityNumber,
        address:         org.address ?? null,
        signatory:       org.signatory ?? { name: "", title: "" },
        receiptTemplate: org.receiptTemplate ?? { headerText: "", bodyText: "", footerText: "" },
        signatureUrl:    org.signatureUrl ?? null,
      },
    });

    for (const ref of donationRefs) {
      tx.update(ref, { locked: true, updatedAt: FieldValue.serverTimestamp() });
    }
  });

  return {
    receiptId:                   receiptRef.id,
    receiptNumber,
    donorId,
    donorName,
    donorAddress:                donor.address ?? null,
    year,
    totalReceiptableAmountCents,
    donations:                   eligible,
    issuedAt:                    now.toISOString(),
    org: {
      legalName:       org.legalName,
      charityNumber:   org.charityNumber,
      address:         org.address ?? null,
      signatory:       org.signatory ?? { name: "", title: "" },
      receiptTemplate: org.receiptTemplate ?? { headerText: "", bodyText: "", footerText: "" },
      signatureUrl:    org.signatureUrl ?? null,
    },
  };
}

export async function runVoidReceipt(
  callerUid: string,
  data: VoidReceiptRequest
): Promise<{ voided: boolean }> {
  const { companyId, receiptId } = data;

  if (!companyId || !receiptId) {
    throw new HttpsError("invalid-argument", "companyId and receiptId are required.");
  }

  const fs = getFirestore();
  const base = `companies/${companyId}`;

  await assertMember(fs, callerUid, companyId);

  const receiptRef  = fs.doc(`${base}/receipts/${receiptId}`);
  const receiptSnap = await receiptRef.get();
  if (!receiptSnap.exists) throw new HttpsError("not-found", "Receipt not found.");
  const receiptData = receiptSnap.data()!;
  if (receiptData.status === "void") {
    throw new HttpsError("already-exists", "Receipt is already void.");
  }

  const donationIds: string[] = (receiptData.donations || []).map(
    (d: { donationId: string }) => d.donationId
  );

  await fs.runTransaction(async (tx) => {
    tx.update(receiptRef, {
      status:    "void",
      voidedAt:  FieldValue.serverTimestamp(),
      voidedBy:  callerUid,
    });
    for (const id of donationIds) {
      tx.update(fs.doc(`${base}/donations/${id}`), {
        locked:    false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return { voided: true };
}

export const generateReceipt = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required.");
  return runGenerateReceipt(request.auth.uid, request.data as GenerateReceiptRequest);
});

export const voidReceipt = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required.");
  return runVoidReceipt(request.auth.uid, request.data as VoidReceiptRequest);
});
