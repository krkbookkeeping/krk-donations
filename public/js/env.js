// Firebase web config — SAFE TO COMMIT. These values are public identifiers,
// not secrets. Firebase security is enforced by Firestore rules + Auth, not by
// hiding these strings. Populated 2026-04-23 from Firebase console (project: krk-donations).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDdIrV58DbpgPprLmJqFJA4wG9LHmlPniw",
  authDomain: "krk-donations.firebaseapp.com",
  projectId: "krk-donations",
  storageBucket: "krk-donations.firebasestorage.app",
  messagingSenderId: "281074580085",
  appId: "1:281074580085:web:56c7d4dc96da1af3c8563c"
};

export const app = initializeApp(firebaseConfig);
