// Template for public/js/env.js — copy this file to `env.js` and fill in real values.
// `env.js` is gitignored; `env.example.js` is checked in so future agents know the shape.
//
// Get these values from Firebase Console -> Project Settings -> Your apps -> Web app config.
//
// Note: these values are public by design (they identify the project to the Firebase SDK).
// Security is enforced by Firestore rules + Auth, NOT by hiding these strings.
// They live in a gitignored file only to keep the repo clean of per-project state.

export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};
