// Auth guard for app.html. Redirects to the sign-in page if the user is not
// authenticated, and populates the top-bar email once they are. Also exposes
// a global signOut handler used by the top-bar button.
//
// On first successful sign-in, ensures a users/{uid} doc exists so the
// Firestore rules (which gate everything behind membership in a company) let
// this user through. Safe because there is no public sign-up path — Firebase
// Auth accounts are created by an existing admin via the Firebase console.
//
// The user doc is created with role="admin", companyIds=[], and
// activeCompanyId=null. The shell (app.html) detects the empty companyIds
// and shows the onboarding screen to create the first company.

import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let resolveReady;
export const authReady = new Promise((resolve) => {
  resolveReady = resolve;
});

window.krkUser = null;

async function ensureUserDoc(user) {
  const ref = doc(db, `users/${user.uid}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      displayName: user.displayName || null,
      role: "admin",
      companyIds: [],
      activeCompanyId: null,
      createdAt: serverTimestamp(),
    });
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("index.html");
    return;
  }
  try {
    await ensureUserDoc(user);
  } catch (err) {
    console.error("ensureUserDoc failed:", err);
  }
  window.krkUser = { email: user.email, uid: user.uid };
  resolveReady(user);
  window.dispatchEvent(new CustomEvent("krk:user", { detail: window.krkUser }));
});

window.krkSignOut = async function krkSignOut() {
  await signOut(auth);
  window.location.replace("index.html");
};
