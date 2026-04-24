// Firebase SDK wiring. Imports the initialized `app` from env.js and exposes
// the service handles used across the frontend.

import { app } from "./env.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Cloud Functions region must match the region used when deploying functions.
// We pin northamerica-northeast2 (Toronto) per Phase 0 decision.
export const functions = getFunctions(app, "northamerica-northeast2");
