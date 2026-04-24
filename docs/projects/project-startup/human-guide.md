# Human Setup Guide — Milestone 0

Everything on this list must be done by you. The AI cannot log into consoles, create accounts, or handle your credentials.

**What's already done:** Firebase project created, Blaze plan active, Auth + Firestore (Toronto) + Storage enabled, web app registered, GitHub repo created (`https://github.com/krkbookkeeping/krk-donations`), `public/js/env.js` populated.

---

## Step 1 — Google Account

Use an existing Google account or create one dedicated to the charity. You'll use this for Firebase and GitHub.

---

## Step 2 — Create the Firebase Project

**Already done.** Project: `krk-donations`, region: Toronto (`northamerica-northeast2`), Blaze plan active.

---

## Step 3 — Upgrade to Blaze Plan

**Already done.** Set a budget alert if you haven't:
1. Go to https://console.cloud.google.com/billing
2. Select your billing account → **Budgets & alerts** → **Create budget**
3. Amount: `$10 CAD`, notify at 50% / 90% / 100%

---

## Step 4 — Enable Firebase Services

**Auth and Firestore: already done.**

**Storage: already done** (Toronto region, bucket created manually).

**Hosting: not used** — we are hosting on Vercel instead.

---

## Step 5 — Create Your Admin User

1. Firebase console → **Authentication** → **Users** tab
2. Click **Add user**
3. Enter your email and a temporary password
4. Click **Add user**
5. Save that temp password — you'll change it when you first sign into the app

---

## Step 6 — Firebase Web App Config

**Already done.** The config is in `public/js/env.js`. It is safe to commit — Firebase web config values are public identifiers, not secrets. Security is enforced by Firestore rules and Auth.

---

## Step 7 — GitHub Repo

**Already done.** Repo: `https://github.com/krkbookkeeping/krk-donations`

Make sure the repo is **private** (check Settings → General → Danger Zone).

---

## Step 8 — Set Up Your Dev Machine

Install these if not already present:

**Node.js 20 LTS**
- Download from https://nodejs.org → choose **20.x LTS**
- Run the installer, keep defaults
- Verify: open a terminal, run `node -v` → should show `v20.x.x`

**Git**
- Download from https://git-scm.com/download/win
- Run installer, keep defaults
- Verify: `git --version`

**Firebase CLI**
- In a terminal: `npm install -g firebase-tools`
- Then: `firebase login`
- Browser opens — sign in with the Google account tied to your Firebase project
- Verify: `firebase projects:list` → `krk-donations` should appear

---

## Step 9 — Connect GitHub to Vercel (replaces Firebase Hosting)

1. Go to https://vercel.com → sign up with GitHub
2. Click **Add New → Project**
3. Import the `krkbookkeeping/krk-donations` repository
4. Settings:
   - **Framework Preset:** Other
   - **Root Directory:** `public`
   - **Build Command:** *(leave blank)*
   - **Output Directory:** *(leave blank)*
5. Click **Deploy**
6. Vercel gives you a live URL (e.g. `krk-donations.vercel.app`) — save it
7. From now on, every push to `main` auto-deploys. PRs get their own preview URL automatically.

---

## Step 10 — Google Cloud Secret Manager (for Cloud Functions secrets)

The Firebase web config is public and committed directly. But if Cloud Functions ever need sensitive credentials (e.g. third-party API keys in post-MVP), store them here — NOT in code.

1. Go to https://console.cloud.google.com/security/secret-manager
2. Make sure the project is set to `krk-donations`
3. Enable the **Secret Manager API** if prompted
4. You won't need to add any secrets yet — this step just confirms it's ready for Phase 7+

---

## Milestone 0 Checklist

Check each off before telling the AI to continue with Phase 1:

- [x] Firebase project created on Blaze plan (`krk-donations`)
- [ ] Budget alert set at $10 CAD in Google Cloud Billing
- [x] Authentication (email/password) enabled
- [x] Firestore enabled in Toronto (`northamerica-northeast2`)
- [x] Storage enabled and bucket created
- [x] Firebase web app registered and config saved in `public/js/env.js`
- [x] GitHub private repo created (`krkbookkeeping/krk-donations`)
- [ ] Admin user created in Firebase Authentication
- [ ] Node.js 20 LTS installed (`node -v` confirms)
- [ ] Git installed (`git --version` confirms)
- [ ] Firebase CLI installed and logged in (`firebase projects:list` shows `krk-donations`)
- [ ] GitHub repo connected to Vercel; first deploy successful
- [ ] Google Cloud Secret Manager API enabled

Once all boxes are checked, tell the AI to continue with Phase 1.
