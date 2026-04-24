# Project Startup — Updates Log

Tracks all meaningful changes to the "zero to MVP" project. Most recent entries at the bottom.

---

## 2026-04-23 — Claude (Opus 4.7)

- Created the `docs/projects/project-startup/` folder per CLAUDE.md project-folder rules.
- Analyzed `docs/app-overview/app-overview.md` (CRA-aware donor management + charitable receipting system).
- Authored `plans.md` — a detailed ten-phase plan from zero to MVP (initially drafted as `plans.html`, then converted to markdown per user direction that docs stay as plain text; the *app itself* is plain HTML + CSS + JS):
  - Phase 0 — Foundations & human setup (Firebase project, accounts, org info)
  - Phase 1 — Project scaffolding & auth shell
  - Phase 2 — Data model, Zod schemas, Firestore security rules
  - Phase 3 — Donor management (CRUD, search, duplicate detection, merge)
  - Phase 4 — Categories & payment methods
  - Phase 5 — Donations & allocations (core engine)
  - Phase 6 — Transactions list & reporting
  - Phase 7 — CRA-compliant receipting (numbering, PDF, lock, void & reissue, email)
  - Phase 8 — Audit, soft delete, import/export, backups
  - Phase 9 — Polish, QA, production deploy
- Each phase tagged with AI-agent tasks vs. HUMAN-only tasks, plus a milestone gate that must pass before the next phase.
- Tech stack decisions captured inside the plan: **plain HTML + CSS + vanilla JS (ES modules)** on the frontend with no build step, Firebase SDK via CDN, optional Alpine.js for reactive bits like the allocation grid, Pico.css for base styles; Firebase (Auth / Firestore / Storage / Hosting) for backend; Cloud Functions in TypeScript for receipt numbering, PDF generation (`pdfkit`), email via the Firebase Trigger Email extension.
- Initialized `summary.md` placeholder (will be populated only when the project completes, per CLAUDE.md).
- No code written yet; repo still empty of app scaffold. Next step is Phase 0 human tasks (Firebase project on Blaze plan, GitHub repo, org info & logo) before any agent scaffolding begins.

---

## 2026-04-23 — Claude (Opus 4.7) — Phase 0 AI tasks

Executed the subset of Phase 0 that doesn't depend on human Firebase-console work:

- Created `docs/decisions/0001-tech-stack.md` — ADR capturing the plain-HTML-frontend + Firebase-backend decision, alternatives considered (React, Tailwind, HTMX, client-side PDF, Supabase), and trade-offs.
- Created root `.gitignore` covering node_modules, build artifacts, Firebase local logs, emulator data, service-account keys, `public/js/env.js` (real Firebase config), org-info text file, logo/signature assets, IDE/OS files, Playwright output, coverage.
- Created `public/js/env.example.js` template — the shape of the Firebase web config file that will be filled in during Phase 1 human task.
- Created `docs/projects/post-mvp-backlog.md` — the scope-creep release valve referenced in the plan's Risks section. Pre-populated with the deferred items already called out as out-of-scope.

**Handoff: Phase 0 now waits on human setup** (Firebase project on Blaze plan, GitHub repo, Node 20 + Firebase CLI installed, org info + logo/signature collected, SMTP sender chosen). Once Milestone 0 is green, Phase 1 scaffolding can start.

---

## 2026-04-23 — Claude (Opus 4.7) — Plan & stack revision

User supplied updated direction:
- **Hosting:** switched from Firebase Hosting to **Vercel** (connected to GitHub repo, auto-deploys `public/` as static site).
- **Email:** removed from MVP entirely — receipts are downloaded as PDF only; emailing moves to post-MVP.
- **Secrets:** server-side secrets (for Cloud Functions) will live in **Google Cloud Secret Manager** rather than GitHub Actions secrets. The Firebase web config is public by design and committed directly at `public/js/env.js`.
- **Region:** corrected from Montréal (`northamerica-northeast1`) to Toronto (`northamerica-northeast2`).
- **Human guide steps 9/10/11 dropped:** org info is entered in the Settings screen at runtime, logo/signature deferred, SMTP not needed.

Files updated: `plans.md` (scope, tech stack table, Phase 0/1/7/9, risks), `human-guide.md` (rewritten), `post-mvp-backlog.md` (email promoted to explicit deferred item), `.gitignore` (`public/js/env.js` is now committed), `public/js/env.js` (populated with real Firebase web config, comment updated to note it's safe to commit).

---

## 2026-04-23 — Claude (Opus 4.7) — Phase 1 scaffolding

User confirmed admin account created and budget set to 5¢ for early-charge detection. Kicked off Phase 1 with the files needed to stand up a signed-in shell.

**Created (frontend):**
- `public/index.html` — sign-in page. Email + password form, redirects to `app.html` on success; auto-redirects if already signed in.
- `public/app.html` — authenticated shell with left sidebar (Donors / Donations / Categories / Payment Methods / Reports / Receipts / Settings), topbar with user email + sign-out, hash-routed content area. Alpine.js loaded via CDN for nav state. Each section currently shows a "Coming in Phase N" placeholder.
- `public/styles.css` — layout, sidebar styling, topbar, sign-in card, error and muted helpers. Layered on top of Pico.css (CDN).
- `public/js/firebase.js` — imports `app` from `env.js`, exposes `auth`, `db`, `storage`.
- `public/js/auth.js` — onAuthStateChanged guard for `app.html` (redirects to `index.html` if not signed in), publishes `window.krkUser` + `krk:user` event, attaches `window.krkSignOut` for the topbar button.
- `public/js/ui.js` — `$`, `$$`, `showError`, `clearError`, `formatDate` helpers.

**Created (backend / ops):**
- `firebase.json` — Firestore + Storage + Functions configs + emulator ports. **No Hosting block** (Vercel handles frontend).
- `firestore.rules` — deny-all placeholder (replaced in Phase 2).
- `storage.rules` — deny-all placeholder (replaced in Phase 2).
- `firestore.indexes.json` — empty.
- `functions/package.json` — scripts: `build`, `lint`, `test`, `serve`, `deploy`. Deps: `firebase-admin`, `firebase-functions`. DevDeps: TypeScript, ESLint, Vitest.
- `functions/tsconfig.json` — strict, ES2022, CommonJS, outputs to `lib/`.
- `functions/.eslintrc.cjs` — TypeScript ESLint, recommended rules.
- `functions/.gitignore` — node_modules, lib, .env.
- `functions/src/index.ts` — `ping` callable, the trivial wiring test. Requires auth, returns `{ ok, uid, ts }`.
- `.github/workflows/ci.yml` — lint + build + test `functions/` on PR and push to main.

**Human still needs to do before Milestone 1 can be declared green:**
1. `cd functions && npm install` — generates `package-lock.json` so CI caching works.
2. Commit + push everything to `main` on `github.com/krkbookkeeping/krk-donations`.
3. Confirm Vercel picks up the push and deploys from `public/`. Grab the live URL.
4. Visit the Vercel URL; it should land on the sign-in page. Sign in with the admin account and verify:
   - Redirects to `app.html`.
   - Sidebar renders; user email appears in topbar.
   - Clicking nav items updates the URL hash and the content placeholder.
   - Sign-out returns you to the sign-in page.
5. From local machine (optional for Milestone 1): `firebase deploy --only firestore:rules,storage:rules,functions` pushes deny-all rules + the `ping` function to Firebase.

---

## 2026-04-23 — Claude (Opus 4.7) — Phase 2 data model, validators, rules

User confirmed Milestone 1 — sign-in flow works. Proceeded with Phase 2.

**Created (decisions / docs):**
- `docs/decisions/0002-data-model.md` — Mermaid ER diagram, full field specs for every entity, invariants (integer cents, allocation balance, lock immutability, receipt append-only, denormalized category fields), indexing plan, open questions.

**Created (money helpers):**
- `public/js/money.js` — `toCents`, `formatCents`, `sumCents`. Integer-cents only, strict parser that rejects fractional cents (e.g. `"12.345"` → `null`).
- `functions/src/shared/money.ts` — TS mirror, identical behavior.

**Created (validators, frontend):**
- `public/js/schemas/donor.js` — donor validator + `donorSearchTokens` helper.
- `public/js/schemas/donation.js` — donation + allocations validator, enforces sum balance.
- `public/js/schemas/category.js`, `paymentMethod.js`, `organizationSettings.js` — one validator per entity.
- `public/js/schemas/index.js` — barrel.

**Created (validators, backend):**
- `functions/src/shared/schemas/types.ts` — TypeScript interfaces for every entity, plus `ValidationResult<T>`.
- `functions/src/shared/schemas/validators.ts` — TS mirrors of each frontend validator, used by Cloud Functions when they write.

**Updated (security rules):**
- `firestore.rules` — real rules. Admin-only gating via `users/{uid}.role == "admin"`. Self-bootstrap of `users/{uid}` allowed with `role="admin"` and whitelisted keys only (safe because there is no public sign-up). Locked donations are immutable at the rule level. Receipts, auditLog, and counters are server-write-only.
- `storage.rules` — `/org/*` readable/writable by signed-in users (for logo/signature uploads). `/receipts/**` read-only from client; Cloud Functions write via Admin SDK.

**Updated (auth bootstrap):**
- `public/js/auth.js` — on first sign-in, calls `ensureUserDoc()` which creates `users/{uid}` with `role="admin"` if it doesn't exist. Without this, the tightened rules would lock the user out after the first deploy.

**Created (tests):**
- `functions/test/unit/money.test.ts` — toCents parsing, formatCents output, sumCents correctness including "no float drift on 10,000 × 1 cent = $100.00".
- `functions/test/unit/validators.test.ts` — donor require-name-or-org, donation allocation-balance rejection, org settings charity-number format.
- `functions/test/rules/firestore.rules.test.ts` — 13 rule tests using `@firebase/rules-unit-testing`: unauth denied, non-admin denied, admin allowed, hard delete denied, self-user-create allowed with role=admin, cross-uid create denied, non-admin role on self-create denied, locked donation update denied, unlocked donation update allowed, client write to receipts / auditLog denied, client read on counters denied, allocation writes blocked when parent locked.

**Updated (test infra):**
- `functions/vitest.config.ts` — unit tests only (test/unit).
- `functions/vitest.rules.config.ts` — rules tests, longer timeout, invoked via emulator.
- `functions/package.json` — added scripts: `test` (unit, default), `test:rules` (emulator exec). Added devDeps: `@firebase/rules-unit-testing`, `firebase`.

**Created (ops):**
- `.firebaserc` — default project `krk-donations` so CLI commands don't need `--project`.

**Human still needs to do before Milestone 2 can be declared green:**
1. `cd functions && npm install` to pull the new devDeps (`@firebase/rules-unit-testing`, `firebase`).
2. `npm test` from `functions/` — unit tests should pass.
3. `npm run test:rules` from `functions/` — this will boot the Firestore emulator, run the 13 rule tests, and tear down. Needs Firebase CLI logged in (already done in Phase 0).
4. Deploy rules + functions to real Firebase: `firebase deploy --only firestore:rules,storage:rules,functions` from project root.
5. Sign in to the Vercel app. First sign-in after the deploy will auto-create `users/{your-uid}` with `role="admin"`. Reload the page if needed — you should still land on the app shell.
6. Confirm in the Firebase console (Firestore → Data) that `users/{your-uid}` now exists with role `admin`. This is the proof Milestone 2 is green.

Phase 2 writes no CRUD yet — that starts in Phase 3. But the data shape, validation, and security boundary are all locked in.

---

## 2026-04-23 — Claude (Sonnet 4.6) — Multi-company support added to plan

User requirement: one account must be linkable to multiple companies, each with completely isolated data and profiles.

Updated `plans.md`:
- Removed "Multi-tenant / multi-organization" from Out-of-Scope. Multi-company support is now **in-scope for MVP**.
- **Scope section**: added multi-company and company switcher to In Scope.
- **Data model (Phase 2)**: split into two tiers. Top-level: `users/{uid}` (with `companyIds[]` and `activeCompanyId`) and `companies/{companyId}` registry doc. Company-scoped: all sensitive collections (donors, donations, categories, paymentMethods, receipts, auditLog, counters) moved to subcollections of `companies/{companyId}/…` for hard data isolation.
- **Security rules (Phase 2)**: rules now validate that `request.auth.uid` has the target `companyId` in their `users.companyIds` array before any read/write. Cross-company access is denied at the rule level.
- **Phase 1 shell**: app.html top bar now includes a company name + dropdown switcher. Switching company reloads in-context data without a full page refresh; active company is persisted in `users/{uid}.activeCompanyId`.
- **Frontend file layout**: added `public/js/company.js` — manages active company context and injects `companyId` into all Firestore paths.
- **Receipt counters**: sequence is now per-company (`companies/{id}/counters/receiptSequence`), not global.
- **Risks table**: added "Cross-company data leak" row.

`app-overview.md` updated to include multi-company support as a foundational architectural feature (new second paragraph describing company isolation, switcher, and per-company receipt sequences).

---

## 2026-04-23 — Claude (Opus 4.7) — Phase 2 retrofit for multi-company

Retrofitted the Phase 2 code to match the revised plan. Nothing had been deployed yet, so this was free to restructure.

**Updated (data model doc):**
- `docs/decisions/0002-data-model.md` — rewritten. Two-tier model: global (`users/{uid}`, `companies/{companyId}`) and company-scoped (everything else under `companies/{companyId}/…`). Added new invariants around `users.companyIds` being server-only, no cross-company refs, per-company receipt sequences. Documented the bootstrap flow (first sign-in → onboarding → `createCompany` Cloud Function).

**Updated (types + validators):**
- `functions/src/shared/schemas/types.ts` — added `User` and `Company` types. Reorganized headers so field-level types for company-scoped entities are clearly grouped.
- `functions/src/shared/schemas/validators.ts` — added `validateCompany`.
- `public/js/schemas/company.js` — frontend mirror validator (name only; ownerUid is server-supplied).
- `public/js/schemas/index.js` — exports `validateCompany`.
- `functions/test/unit/validators.test.ts` — added 5 tests for `validateCompany`.

**Updated (security rules):**
- `firestore.rules` — rewritten. `users/{uid}` strict self-bootstrap shape (role=admin, empty companyIds, null activeCompanyId). Self-update limited to `activeCompanyId` and only to a company already in `companyIds`. `users.companyIds` is server-only (clients cannot self-grant access). `companies/{id}` is client-read-only; writes flow through `createCompany` Cloud Function. All sensitive collections moved under `companies/{companyId}/…` with an `isMemberOf(companyId)` guard.
- `storage.rules` — receipts scoped to `/companies/{companyId}/receipts/**`; org assets to `/companies/{companyId}/org/**`; both gated by the same `companyIds` membership check against Firestore.

**Updated (rules tests):**
- `functions/test/rules/firestore.rules.test.ts` — rewritten. 24 tests covering: unauth denied; self-bootstrap with empty companyIds allowed; self-bootstrap with non-empty companyIds denied (key protection against client self-granting); self-update of `activeCompanyId` to a member company allowed; self-update of `activeCompanyId` to a non-member company denied; self-modification of `companyIds` denied; cross-user reads denied; `companies/{id}` client writes denied; member read of own company allowed; non-member read denied; member read/write of donors / donations / settings allowed; non-member read/write denied; locked-donation update denied; locked-donation allocation write denied; client writes to receipts / auditLog denied; all counters access denied.

**Updated (frontend auth bootstrap):**
- `public/js/auth.js` — `ensureUserDoc` now creates the user doc with `companyIds: []` and `activeCompanyId: null`, matching the new strict create rule.

**Created (frontend company context):**
- `public/js/company.js` — subscribes to `users/{uid}` via `onSnapshot`, exposes `getActiveCompanyId()`, `getCompanyIds()`, `companyDoc(...)`, `companyCollection(...)`, `switchCompany(id)`, `createCompany(name)`. Emits `krk:companyChanged` and `krk:companiesUpdated` events. All subsequent feature modules will use `companyDoc/companyCollection` helpers so Firestore paths are always company-scoped.
- `public/js/firebase.js` — exports `functions` (pinned to `northamerica-northeast2`).

**Created (app shell):**
- `public/js/shell.js` — Alpine components moved out of inline `<script>` into a module so it can import from `company.js`. Exposes `window.onboarding()` (visible when `companyIds.length === 0`) and `window.appShell()` (visible when the user has ≥ 1 company and an `activeCompanyId`). Company switcher: plain label when 1 company, `<select>` when 2+. `+ New Company` button opens an inline form that calls `createCompany`. Loads company display names lazily via per-id `getDoc` (cached in-memory).
- `public/app.html` — reworked markup: two root containers (onboarding / main shell) with `x-show` toggles; topbar gains the switcher; content area renders an inline "new company" form or the existing section placeholders.
- `public/styles.css` — added `.topbar .company-switcher`, `.topbar .link-button`, `.app-shell.onboarding`, `.onboarding-card`, `.inline-company-form`. Topbar layout changed from `justify-content: flex-end` to a three-zone row (switcher | spacer | email + sign-out).

**Created (Cloud Function):**
- `functions/src/index.ts` — added `createCompany` callable. Validates name, verifies caller's `users/{uid}` has `role=admin`, then runs a Firestore transaction: creates `companies/{newId}`, `arrayUnion`s the new id into `users/{uid}.companyIds`, sets `activeCompanyId` if it was null, writes a `company.create` audit entry. All functions consolidated to `northamerica-northeast2` (was `us-central1` for `ping`).

**Known follow-up (Phase 5):**
- The rule `allow write on allocations: if !donationLocked(parent)` works for updates, but a single batched **create** of a donation + its allocations will fail rule evaluation because `get()` on the parent reads the pre-batch state. Options: (a) write donation first, then allocations in a second batch; (b) do the entire write in a Cloud Function so it bypasses client rules. Decision deferred to Phase 5 when donation entry is implemented — flagged in the data-model ADR open questions list (to be added when Phase 5 starts).

**Human still needs to do before Milestone 2 can be declared green:**
1. `cd functions && npm install` (no new deps since last time, but regenerate `package-lock.json` if stale).
2. `npm test` from `functions/` — unit tests (money + validators including new validateCompany cases) should pass.
3. `npm run test:rules` from `functions/` — 24 rule tests.
4. `firebase deploy --only firestore:rules,storage:rules,functions` from project root.
5. Sign in to the Vercel app. First sign-in auto-creates `users/{your-uid}` with empty `companyIds` and `activeCompanyId: null`. You'll be shown the onboarding card — enter a company name (e.g. "KRK Bookkeeping" or whichever charity you're testing with) and submit. The `createCompany` function runs, `users/{uid}` is updated, and the normal shell renders. The top bar shows your company name.
6. Optional: click `+ New Company` to add a second company. Confirm the dropdown appears and that switching between them changes `activeCompanyId` in Firestore.
7. Confirm in the Firebase console (Firestore → Data) that `users/{your-uid}` has `companyIds: [one or two ids]` and that `companies/{id}` + `companies/{id}/auditLog/{id}` docs exist.

Once that's green, Milestone 2 is done and Phase 3 (Donors — scoped to `companies/{activeCompanyId}/donors`) can begin.
