// Active-company context for the signed-in user.
//
// Responsibilities:
//   - Subscribe to the signed-in user's Firestore doc to know their companyIds
//     and activeCompanyId.
//   - Expose helpers to build paths under companies/{activeCompanyId}/… so
//     other modules don't have to repeat the scoping themselves.
//   - Switch the active company (by updating users/{uid}.activeCompanyId).
//   - Call the createCompany Cloud Function to make new companies.
//   - Emit a `krk:companyChanged` event whenever the active company changes
//     so that list views can re-subscribe.

import { auth, db, functions } from "./firebase.js";
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

const state = {
  uid: null,
  companyIds: [],
  activeCompanyId: null,
  unsub: null,
};

let resolveReady;
export const companyReady = new Promise((resolve) => {
  resolveReady = resolve;
});
let readyResolved = false;

export function getActiveCompanyId() {
  return state.activeCompanyId;
}

export function getCompanyIds() {
  return [...state.companyIds];
}

// Build a Firestore DocumentReference scoped to the active company.
// Usage: companyDoc("donors", "abc123") → companies/{active}/donors/abc123
export function companyDoc(...segments) {
  if (!state.activeCompanyId) {
    throw new Error("No active company. Onboarding not complete.");
  }
  return doc(db, "companies", state.activeCompanyId, ...segments);
}

// Build a Firestore CollectionReference scoped to the active company.
// Usage: companyCollection("donors") → companies/{active}/donors
export function companyCollection(...segments) {
  if (!state.activeCompanyId) {
    throw new Error("No active company. Onboarding not complete.");
  }
  return collection(db, "companies", state.activeCompanyId, ...segments);
}

export async function switchCompany(companyId) {
  if (!state.uid) throw new Error("Not signed in.");
  if (!state.companyIds.includes(companyId)) {
    throw new Error("You are not a member of that company.");
  }
  if (companyId === state.activeCompanyId) return;
  await updateDoc(doc(db, `users/${state.uid}`), { activeCompanyId: companyId });
  // The onSnapshot listener below will pick up the change and emit the event.
}

export async function createCompany(name) {
  const call = httpsCallable(functions, "createCompany");
  const result = await call({ name });
  return result.data; // { companyId }
}

function startWatching(uid) {
  if (state.unsub) state.unsub();
  state.uid = uid;
  state.unsub = onSnapshot(doc(db, `users/${uid}`), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const prevActive = state.activeCompanyId;
    state.companyIds = Array.isArray(data.companyIds) ? data.companyIds : [];
    state.activeCompanyId = data.activeCompanyId || null;
    if (!readyResolved) {
      readyResolved = true;
      resolveReady({
        companyIds: [...state.companyIds],
        activeCompanyId: state.activeCompanyId,
      });
    }
    if (prevActive !== state.activeCompanyId) {
      window.dispatchEvent(new CustomEvent("krk:companyChanged", {
        detail: { activeCompanyId: state.activeCompanyId, companyIds: [...state.companyIds] },
      }));
    } else {
      // companyIds may have changed even if active didn't (e.g. new company added).
      window.dispatchEvent(new CustomEvent("krk:companiesUpdated", {
        detail: { companyIds: [...state.companyIds], activeCompanyId: state.activeCompanyId },
      }));
    }
  });
}

window.addEventListener("krk:user", (e) => {
  const uid = e.detail?.uid;
  if (uid) startWatching(uid);
});

// If auth already resolved by the time this module loads, start watching now.
if (auth.currentUser) startWatching(auth.currentUser.uid);
