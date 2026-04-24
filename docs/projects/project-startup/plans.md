# KRK Donations — Project Startup Plan (Zero to MVP)

CRA-aware donor management & charitable receipting system.
Created 2026-04-23.

> **Guiding principle:** correctness > speed, tight MVP scope, CRA compliance is non-negotiable. Do not overbuild. Every phase ships something working before the next one starts.

---

## 1. Executive Summary

We are building a donor CRM + donation ledger + CRA-compliant charitable receipting platform. The defining architectural decision is the **donation → allocation split**: a single donation transaction contains one or more allocations, each assigned to a category, and only the receiptable portion counts toward a donor's yearly tax receipt. Everything else — search, filtering, reporting, receipt totals — must be allocation-aware.

The MVP delivers: donor CRUD with duplicate detection and merge, categories and payment methods, donation entry with balanced allocations, a filterable transactions list with export, a yearly donor summary report, CRA-compliant yearly PDF receipts with sequential numbering and lock-on-issue (downloaded locally; emailing is post-MVP), basic audit log, and CSV import/export.

---

## 2. Scope & Out-of-Scope (MVP)

### In Scope
- **Multi-company support**: one user account can be linked to one or more companies; each company's data is fully isolated (donors, donations, categories, receipts, counters)
- Company switcher in the app shell so the user can flip between companies without signing out
- Donor CRUD + search + duplicate detection + merge
- Categories & payment methods management
- Donation entry with multi-line allocations and balance validation
- Transactions list with multi-criteria AND filtering, CSV export, print
- Yearly donor summary report + detailed transaction report
- CRA-compliant yearly PDF receipts (single + bulk)
- Receipt locking + void-and-reissue workflow
- Simple default receipt template with org name + charity # + merge fields
- Receipts downloaded as PDF locally (no email in MVP)
- Soft delete / archive on all entities
- Basic audit log (create, modify, merge, void)
- CSV import for donors; CSV export for donors / donations / reports

### Out of Scope (Post-MVP)
- Role-based access beyond admin
- WYSIWYG receipt template editor
- Recurring donations / pledges
- Payment processor integrations (Stripe / Square live sync)
- Advanced analytics dashboards
- Native mobile apps
- Email delivery entirely (emailing receipts, SendGrid/Postmark, Firebase Trigger Email extension)
- Monthly / category-trend reports

---

## 3. Tech Stack & Rationale

The app is built as **plain HTML + CSS + JavaScript** — no framework, no build step on the frontend. Firebase is loaded via CDN ES-module imports.

| Layer | Choice | Why |
|---|---|---|
| Frontend | Static HTML pages + vanilla JS (ES modules) + CSS | No build step, easy to read/debug, matches user preference for HTML-first. |
| Reactivity helper (optional) | [Alpine.js](https://alpinejs.dev) via single `<script>` tag | Tiny (~15KB) for the allocation grid / duplicate-warning UI. If not wanted, plain JS works — note in decisions doc. |
| Styling | Hand-rolled CSS in one `styles.css`, plus [Pico.css](https://picocss.com/) CDN for sensible defaults | No Tailwind build step. |
| Forms / validation | Native HTML5 constraints + custom JS validators | Money math done with integer cents in JS helpers. |
| Auth | Firebase Authentication (email/password) via CDN modular SDK | Minimal friction. |
| Database | Cloud Firestore via CDN modular SDK | Document model fits entities; realtime listeners. |
| File storage | Firebase Storage | Logo, signature, receipt PDFs. |
| Serverless | Cloud Functions for Firebase (Node.js 20, TypeScript) | Receipt numbering in a transaction, PDF generation, email send, bulk jobs. `functions/` is the only part of the repo with `npm`. |
| PDF generation | `pdfkit` in Cloud Functions | Server-rendered so snapshot is authoritative. |
| Email | **Post-MVP** | MVP receipts are downloaded locally. Email added later. |
| Hosting | **Vercel** (connected to GitHub repo) | Free tier, auto-deploys on push, no build step needed for static HTML. |
| Secrets (server-side) | **Google Cloud Secret Manager** | For any secrets used inside Cloud Functions (not the Firebase web config — that's public). |
| Testing | Vitest in `functions/` for money / receipt / merge logic; one Playwright smoke test for receipt-issuance flow | Financial logic is unit-tested; E2E only on the critical path. |
| CI | GitHub Actions (lint `functions/`, run tests) | Keeps main branch green. Vercel handles preview deploys automatically. |

### Frontend file layout

```
public/
  index.html          ← sign-in page
  app.html            ← shell with sidebar; rendered sections swapped in-place
  donors.html         ← optional: can be embedded in app.html instead
  styles.css
  js/
    firebase.js       ← initializes SDK
    auth.js
    company.js        ← active company context; switcher logic; companyId injected into all Firestore paths
    donors.js
    donations.js
    allocations.js    ← balance math helpers
    categories.js
    paymentMethods.js
    receipts.js
    reports.js
    audit.js
    money.js          ← integer-cent helpers
    ui.js             ← small DOM helpers
functions/            ← only place with package.json, TypeScript
firebase.json
firestore.rules
firestore.indexes.json
storage.rules
```

---

## 4. How to Read This Plan

Each phase lists **[AI]** tasks (for Claude/Codex/any agent to execute) and **[HUMAN]** tasks (things only you can do — create accounts, paste keys, upload logos, approve receipt wording). Each phase ends with a **MILESTONE** that must be demonstrably passing before the next phase starts. Do not skip a milestone.

---

## Phase 0 — Foundations & Human Setup

**Goal:** every external account, key, and decision is in place before a single line of app code is written.

### [HUMAN] Accounts & access
1. Use (or create) a Google account for the charity.
2. Create a **Firebase project** at `console.firebase.google.com` (suggested name: *krk-donations*). Upgrade to the **Blaze (pay-as-you-go) plan** — required for Cloud Functions and outbound email. Set a budget alert (e.g. $10 CAD/month) in Google Cloud Billing.
3. In the Firebase console enable: **Authentication** (email/password provider), **Firestore Database** (production mode, region `northamerica-northeast2` — Toronto), **Storage**.
4. Create a private **GitHub repo** for the codebase (done: `https://github.com/krkbookkeeping/krk-donations`).
5. Install on your dev machine: `Node.js 20 LTS`, `git`, `Firebase CLI` (`npm i -g firebase-tools`), then `firebase login`.
6. Connect the GitHub repo to **Vercel** (free at vercel.com → Import Git Repository → Root Directory: `public/`, no build command, no output directory override).

### [HUMAN] Organization info & assets
- Org info (legal name, CRA charity #, address, signatory, starting receipt number) is entered directly in the app's Settings screen — no file needed.
- Review your Google Sheets prototype and list any fields/behaviors not covered in `app-overview.md`. If any, update `app-overview.md` first (per CLAUDE.md rules).

### [AI] Agent tasks
- Seed `docs/decisions/0001-tech-stack.md` capturing the choices in §3.
- Create `.gitignore` and an `env.example.js` template (empty Firebase config values) — but do NOT create real config until after human finishes Firebase setup.

### MILESTONE 0
Firebase project exists on Blaze plan with Auth/Firestore/Storage enabled; GitHub repo exists and connected to Vercel; dev machine has Node 20 + Firebase CLI logged in; `app-overview.md` confirmed complete.

---

## Phase 1 — Project Scaffolding & Auth Shell

**Goal:** a deployed shell app that a signed-in admin can reach. Nothing functional yet.

### [AI] Agent tasks
1. Create the repo structure shown in §3. `public/` holds all frontend files; `functions/` is a standalone TypeScript Cloud Functions workspace.
2. `public/index.html` — sign-in page with email + password fields. Uses `js/auth.js` which calls `signInWithEmailAndPassword` from the Firebase Auth CDN module.
3. `public/app.html` — authenticated shell: left sidebar (Donors / Donations / Categories / Payment Methods / Reports / Receipts / Settings), top bar with **active company name + dropdown switcher**, user email + sign-out, main content area that swaps in sections by hash route (`#/donors`, `#/donations`, etc.). Uses Alpine.js (or vanilla) for nav state. If a user belongs to multiple companies, the company switcher is always visible; selecting a different company reloads all data in context without a full page refresh. Active company is stored in `users/{uid}.activeCompanyId` so it persists across sessions.
4. `js/firebase.js` — loads the CDN modular SDK from `js/env.js` (committed — Firebase web config is public). Exposes `auth`, `db`, `storage`.
5. `auth.js` — if not signed in, redirects to `index.html`. Otherwise boots the app. Sign-out button clears session.
6. `styles.css` — base typography, sidebar layout, buttons, form inputs. Pico.css included via CDN for table / form defaults.
7. Initialize `functions/` with `firebase init functions` (TypeScript). Add a trivial `ping` callable to prove wiring.
8. Write `firebase.json`, `firestore.rules` (deny-all placeholder), `storage.rules` (deny-all placeholder), `firestore.indexes.json` (empty). Note: `firebase.json` only covers Firestore/Storage/Functions — no Hosting block.
9. Add GitHub Actions: lint + test `functions/` on PR. Vercel handles preview deploys automatically from GitHub.

### [HUMAN] tasks
- `public/js/env.js` is already populated (done in Phase 0). Confirm values match your Firebase console.
- Create your admin user in Firebase Console → Authentication → Users (email + temp password).
- Sign in to the Vercel preview URL once it deploys; change your password.

### MILESTONE 1
You can visit the Vercel preview URL, sign in with your admin email/password, see the sidebar shell, and sign out.

---

## Phase 2 — Data Model, Validators & Security Rules

**Goal:** lock the schema and security boundary before any CRUD is written. Cheap to change now, expensive later.

### [AI] Data model (Firestore)

#### Top-level (global, not company-scoped)

- `users/{uid}` — `{ email, displayName, role: "admin", companyIds: string[], activeCompanyId: string, createdAt }`.
- `companies/{companyId}` — `{ name, createdAt, ownerUid }` — lightweight company registry; membership checked via `users.companyIds`.

#### Company-scoped (all live under `companies/{companyId}/…`)

Every collection below is a subcollection of a company document, giving complete data isolation between companies.

- `companies/{companyId}/settings/main` — legal name, charity #, mailing address, signatory, logo URL, signature URL, defaultReceiptTemplateId, receiptTemplate fields.
- `companies/{companyId}/donors/{donorId}` — `{ firstName, lastName, orgName?, email, phone, address:{line1,line2,city,province,postalCode,country}, preferredContact, notes, status:"active"|"archived", searchTokens:[], createdAt, updatedAt, mergedIntoId? }`.
- `companies/{companyId}/categories/{categoryId}` — `{ name, receiptable: boolean, status:"active"|"archived", createdAt }`.
- `companies/{companyId}/paymentMethods/{paymentMethodId}` — `{ name, status:"active"|"archived", createdAt }`.
- `companies/{companyId}/donations/{donationId}` — `{ donorId, date, totalAmountCents, paymentMethodId, referenceNumber?, notes?, locked: boolean, receiptId?, categoryIds:[], hasReceiptable:boolean, createdAt, updatedAt, createdBy }`.
- `companies/{companyId}/donations/{donationId}/allocations/{allocationId}` — `{ categoryId, amountCents, receiptable: boolean (snapshot at write time), createdAt }`.
- `companies/{companyId}/receipts/{receiptId}` — `{ number, year, donorId, donorSnapshot, orgSnapshot, totalReceiptableCents, issuedAt, issuedBy, pdfStoragePath, emailStatus:{sent, sentAt?, to?, error?}, status:"issued"|"voided", voidedAt?, replacedByReceiptId? }`.
- `companies/{companyId}/receipts/{receiptId}/lineItems/{lineItemId}` — donation + allocation snapshot rows used to generate the receipt.
- `companies/{companyId}/auditLog/{entryId}` — `{ at, actorUid, action, entityType, entityId, before?, after?, metadata? }`.
- `companies/{companyId}/counters/receiptSequence` — `{ year, nextNumber }`, incremented in a transaction when issuing. Sequence is per-company and resets each year.

### [AI] Validators
- Plain JS validator functions in `public/js/schemas/` per entity: `validateCompany(obj)`, `validateDonor(obj)`, `validateDonation(obj)`, etc. Return `{ ok: true } | { ok: false, errors: {...} }`.
- `js/money.js` — store all money as integer cents. Helpers: `toCents("12.34") → 1234`, `formatCents(1234) → "$12.34"`, `sum(arr)`. Never use floats for arithmetic.
- Mirror validators in `functions/` (TypeScript) so they run on both sides. Unit tests for money helpers (rounding, totals, allocation balance) and company validation.

### [AI] createCompany Cloud Function
- The only path that mutates `users.companyIds` and creates `companies/{id}`. Called from onboarding (first company) and from the **+ New Company** button in the top-bar switcher (subsequent companies).
- Validates the name, verifies the caller has a `users/{uid}` doc with `role=admin`, then in a Firestore transaction: creates `companies/{newId}` with `{ name, ownerUid, createdAt }`; `arrayUnion`s the new id into `users/{uid}.companyIds`; sets `activeCompanyId` if it was null; writes a `company.create` audit entry under the new company.
- Pinned to region `northamerica-northeast2` (same as Firestore). All MVP Cloud Functions use this region.

### [AI] Security rules
- `firestore.rules`: only allow read/write on a company's subcollections if `request.auth.uid` exists AND the caller's `users/{uid}.companyIds` includes the `companyId` in the path. Admin role check still applies.
- Deny client writes to `auditLog`, `counters`, and `receipts` subcollections — those flow only through Cloud Functions (which run with Admin SDK and bypass client rules).
- Allow client read-only on `receipts` subcollections for display; deny client updates on `donations` where `locked == true`.
- `storage.rules`: signed-in users can read `/receipts/{companyId}/**` only if their `companyIds` includes that `companyId`; writes only from Admin SDK (Cloud Functions).
- Emulator rule tests (`@firebase/rules-unit-testing`) covering: unauth denied, admin of company A cannot read company B data, locked-donation writes denied.

### [HUMAN] tasks
- Review schema (ASCII / Mermaid diagram in `docs/decisions/0002-data-model.md`). Confirm field names match your Google Sheets vocabulary.
- Decide how many companies you need at launch and what their names are. The system will seed a `companies/{id}` doc for each and link your admin `uid` to all of them.
- Confirm **CAD only**, no multi-currency. Confirm whether any historical donations need importing mid-year (affects receipt sequence starting number — tracked per company).

### MILESTONE 2
Security-rule tests pass in emulator (including cross-company isolation and `users.companyIds` self-modification denials); every entity has a validator (including `validateCompany`); `docs/decisions/0002-data-model.md` is written and signed off; a signed-in user with no companies lands on the onboarding card, and creating a company via `createCompany` transitions them into the main shell with the new company as active.

---

## Phase 3 — Donor Management (CRUD, Search, Merge)

**Goal:** first user-visible feature shipped end to end.

### [AI] Agent tasks
1. **Donor list** section in `app.html`: paginated table, sortable headers, active/archived filter, top search box querying Firestore by `searchTokens` (tokens derived from name, email, phone, address).
2. **Donor detail** view: full profile, recent donations panel, total receiptable YTD, edit / archive / merge buttons.
3. **Create / edit donor** form: HTML5 validation + custom JS; email format, phone format, required name-or-orgName rule.
4. **Duplicate detection**: on save, query for exact-email match (case-insensitive) and phone + last-name similarity (Levenshtein ≤ 2). Show a non-blocking warning card: "Possible duplicate of X — review".
5. **Merge** Cloud Function `mergeDonors({ primaryId, secondaryIds[], fieldResolutions })`. In a transaction: copy resolved fields into primary; reassign all `donations` where `donorId ∈ secondaryIds` to primary; set each secondary `status="archived"`, `mergedIntoId=primaryId`; write `auditLog` entry with before/after.
6. **Merge UI**: side-by-side diff of conflicting fields with radio buttons per field; preview list of donations that will move; confirm modal.
7. **Archive / unarchive** actions with audit entry.
8. Unit tests on merge logic (in `functions/`); Playwright happy-path: create → edit → duplicate warn → merge.

### [HUMAN] tasks
- Acceptance test: create 5 real donors (or anonymized), deliberately create a near-duplicate, walk the merge flow. Confirm all historical donations reassigned.

### MILESTONE 3
Create, edit, archive, search, and merge donors in production. Audit log shows every merge. Zero data loss in merge test.

---

## Phase 4 — Categories & Payment Methods

**Goal:** configurable lookup tables required before donation entry can work.

### [AI] Agent tasks
1. Categories admin page: list, create, edit (name + `receiptable` toggle + active/archived), archive. A category in use (referenced by any allocation) cannot be deleted — only archived; show count of allocations using it.
2. Payment methods admin page: same pattern.
3. "Create on the fly" hooks into the same collections, used later in Phase 5.
4. Seed defaults on first run when collections empty — Categories: *General Donation (receiptable), Event Ticket (non-receiptable), Silent Auction (non-receiptable), Memorial (receiptable)*; Payment Methods: *Cash, Cheque, E-transfer, Debit, Credit Card, Square, Online*.
5. Validation: prevent changing a category's `receiptable` flag if any **locked** allocation (attached to an issued receipt) references it — would invalidate a snapshot.

### [HUMAN] tasks
- Review seeded defaults; rename / archive anything that doesn't match your charity's real vocabulary.

### MILESTONE 4
Both admin screens usable; defaults seeded; attempting to flip receiptable on a locked-in-use category is blocked with a clear error.

---

## Phase 5 — Donations & Allocations (Core Engine)

**Goal:** the feature the app exists for. Must be fast, keyboard-friendly, and arithmetic-correct.

### [AI] Donation entry form
1. Top of form: donor search (type-ahead, debounced) with "Create new donor" inline button opening the Phase 3 donor form in a modal.
2. Date (defaults to today), total amount (entered in dollars, stored as cents), payment method dropdown, reference number, notes.
3. **Allocation grid**: rows with Category (dropdown with "+ New Category" inline), Amount, Receiptable (auto-derived, read-only), Remove. "Add line" button. Alpine.js makes this cleanest; vanilla JS is fine if Alpine is rejected.
4. Sticky footer: `Allocated: $X.XX / Total: $Y.YY — Difference: $Z.ZZ`. Red when unbalanced, green when equal.
5. Save is disabled until `sum(allocations.amountCents) === totalAmountCents` exactly. Enforced again in the Cloud Function write.
6. Allocations written in a Firestore batch with the donation in one transaction. On edit, old allocations replaced atomically.
7. Keyboard: Tab order flows logically; Enter on the last allocation row adds a new row.

### [AI] Batch entry mode
- Toggle: after save, reset only donor (prefilled date + payment method + last category), focus back on donor search. Used for weekly collections.

### [AI] Edit / delete donation
- Edit blocked when `donation.locked === true`. UI shows lock icon + explanation + link to Void & Reissue flow (Phase 7).
- "Delete" is archive (soft); hidden from default lists.

### [HUMAN] tasks
- Acceptance test: enter a $100 split donation ($60 General / $40 Event Ticket). Confirm receiptable total is $60. Attempt an unbalanced save — confirm it blocks.
- Enter a week of church-collection-style donations in batch mode. Target < 20 seconds per donation after the first.

### MILESTONE 5
Donation entry is demonstrably faster than the Google Sheets prototype; unbalanced saves impossible; edit blocked on locked donations with clear UX.

---

## Phase 6 — Transactions List & Reporting

**Goal:** primary working view for reviewing donations, plus two MVP reports.

### [AI] Transactions list
1. Columns: Date, Donor, Total, Payment Method, Categories (comma-joined), Receiptable Total, Locked icon, actions.
2. Filters (top bar, all AND'ed): date range preset + custom, year quick-pick, donor (single-select autocomplete), categories (multi-select), payment methods (multi-select), receiptable status (*any / receiptable portion exists / fully non-receiptable*).
3. **Allocation-aware filtering**: a donation matches when *any* of its allocations match (per spec). Implementation: denormalized `categoryIds: string[]` and `hasReceiptable: boolean` on the donation document at write time.
4. Required Firestore composite indexes added to `firestore.indexes.json`.
5. Reset Filters; results update live. Simple pagination (no virtualization required for MVP given expected volumes).
6. Actions: **Export CSV** of current filtered view (allocation-level CSV + donation-level CSV), **Print** via a dedicated print stylesheet.

### [AI] Reports
- **Yearly Donor Summary**: select year → table of `Donor | Total Donations | Receiptable Total`, sortable, CSV export. Used to preview who will get a receipt.
- **Detailed Transaction Report**: same filter bar as transactions, formatted for print/export with summary row at bottom.

### [HUMAN] tasks
- Reconcile one real historical month against the Google Sheets prototype. Totals must match to the cent.

### MILESTONE 6
Transaction list feels snappy on 1,000+ donations; filters correct on split donations; CSV export opens cleanly in Excel and reconciles with prototype.

---

## Phase 7 — Charitable Receipting (CRA Compliance)

**Goal:** the feature that makes this legally useful. Highest-risk phase — do not rush.

### [AI] Organization settings screen
- Edit legal name, charity # (validated format: 9 digits + `RR` + 4 digits), address, signatory, fiscal-year notes.
- Upload logo + signature to Firebase Storage; store URLs on `organizationSettings/main`.
- Display next receipt number for current year (read-only).

### [AI] Receipt numbering
Cloud Function `issueReceipt(donorId, year)` runs inside a Firestore transaction:
1. Load `counters/receiptSequence`, increment `nextNumber`, derive human number `{year}-{####}`.
2. Pull all donations for donor in that year where `locked === false`. Collect allocations where `receiptable === true`. Sum.
3. If receiptable sum is 0 → abort with clear error.
4. Write `receipts/{receiptId}` + `lineItems` subcollection as a snapshot of donor + org + each contributing allocation.
5. Flip `donations.locked = true` on each contributing donation; set `donations.receiptId`.
6. Write audit entry.

All in one transaction — partial failure = no mutation.

### [AI] PDF generation
- Cloud Function `generateReceiptPdf(receiptId)` using `pdfkit`. Upload PDF to `gs://{bucket}/receipts/{year}/{receiptNumber}.pdf`. Save path on receipt doc.
- Required CRA fields on the PDF: statement *"Official receipt for income tax purposes"*, unique receipt #, year of donation, date issued, donor name + address, total eligible amount in words + figures, organization legal name + BN/RC #, registered address, signatory name + signature image, location of issue. Advantage is $0 in MVP (handled via non-receiptable allocations); surface a note in the UI explaining this.

### [AI] Bulk & single receipt UI
- Receipts page → "Generate receipts for year N" flow: shows the Phase 6 Yearly Donor Summary, lets you select all or a subset, then calls `issueReceipt` per donor in sequence (to preserve numbering order). Progress UI, retry on failure.
- Single-donor "Issue Receipt" button on donor detail page.
- Download PDF / view inline.

### [AI] Void & reissue
- `voidReceipt(receiptId, reason)`: flip status to *voided*, unlock donations, write audit entry. PDF regenerated once with **VOID** watermark.
- "Reissue" = edit donation(s) as needed, then call `issueReceipt` again — gets a new sequential number, linked via `replacedByReceiptId` on the void record.
- Voided receipts must be retained and remain visible (greyed) in the UI forever.

### [AI] Receipt template
- MVP template is hard-coded HTML/pdfkit layout; customizable text fields (header, body paragraph, footer) stored on `organizationSettings/main.receiptTemplate` with merge tokens `{{donorName}}, {{year}}, {{totalReceiptable}}, {{receiptNumber}}`.
- Template edit screen: plain textarea per field with live preview pane rendering a sample receipt.
- **No email in MVP.** Receipts are downloaded directly from the browser as a PDF file. Sharing/emailing is done manually by the user outside the app.

### [HUMAN] tasks
- Review a generated sample PDF side-by-side with a CRA sample receipt (canada.ca → charities → sample receipts). Confirm mandatory fields; adjust wording in Settings.
- Dry-run: issue a receipt to a test donor, void it, confirm the watermark and audit entry.

### MILESTONE 7
You have issued and emailed a real receipt to a real donor; it passes your eye for CRA compliance; receipt numbering is sequential across multiple test runs; locked donations are demonstrably uneditable.

---

## Phase 8 — Audit, Soft Delete, Import/Export

**Goal:** the data-integrity supporting features the spec calls out.

### [AI] Agent tasks
1. **Audit log viewer**: filter by actor, entity type, date. Human-readable diffs (e.g. "Merged donor A into donor B — moved 14 donations"). Read-only.
2. Confirm every mutation Cloud Function writes an audit entry (merge, archive, issue receipt, void receipt, category change). Fill gaps.
3. **Soft delete** audit: no hard-delete in UI; archived records filterable but default-hidden.
4. **CSV import — donors**: Cloud Function accepts a CSV (columns matching donor schema); runs duplicate detection per row; preview UI with *skip / create / merge* decisions per row; commits in a batched transaction. Cap 1,000 rows/import for MVP.
5. **CSV export**: full-data export of donors, donations (allocations flattened), categories, payment methods, receipts, audit log. On Settings → Data.
6. **Nightly Firestore export** to a GCS bucket via scheduled Cloud Function + `firestore:export`. 30-day retention. Restore steps in `docs/ops/restore.md`.

### [HUMAN] tasks
- Prepare a sample CSV from your Google Sheets donor tab. Run the import on a **staging** Firebase project (create one first — strongly recommended before touching prod).
- Verify the nightly backup bucket shows an export the next morning.

### MILESTONE 8
Nightly backups running; donors import cleanly; audit log has an entry for every meaningful action taken during testing.

---

## Phase 9 — Polish, QA, Deploy

**Goal:** production-ready. Stop adding features.

### [AI] Agent tasks
1. Empty states for every list; loading indicators; friendly error messages.
2. Global keyboard shortcuts: `g d` donors, `g t` transactions, `n` new donation, `/` search.
3. Accessibility pass: labels on inputs, visible focus, colour-contrast.
4. Tick every `app-overview.md` requirement against `docs/projects/project-startup/mvp-checklist.md`.
5. Unit-test coverage ≥ 90% on: allocation math, receipt totalling, merge logic, receipt numbering.
6. One Playwright E2E: sign in → create donor → split-allocation donation → issue receipt → download PDF.
7. Performance check with 5,000 donations seeded; no screen > 1s first paint.
8. Production deploy: push to `main` → Vercel auto-deploys frontend; run `firebase deploy --only functions,firestore,storage` for backend. Tag `v1.0.0-mvp` in GitHub.
9. Write `docs/ops/runbook.md`: add a user, restore from backup, void a receipt.
10. Update `summary.md` per CLAUDE.md rules.

### [HUMAN] tasks
- Use the app for one full week of real donation entry alongside the Google Sheets. Log friction in `updates.md`.
- At week's end, decide: switch over as source of truth, or file Phase 9.x fixes.
- Once switched, archive the Google Sheets prototype (don't delete — history).

### MILESTONE 9 — MVP LIVE
The Google Sheets prototype is retired. You are running the charity's donor ledger on the app in production.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cross-company data leak | Privacy / compliance failure | All Firestore paths are company-scoped subcollections; security rules validate `companyIds` membership before any read/write; no top-level shared collections for sensitive data. |
| Receipt number collision or gap | CRA compliance failure | Receipt sequence counter is per-company; single Firestore transaction on `companies/{id}/counters/receiptSequence`; never hand-edit. |
| Floating-point drift in allocations | Unbalanced saves, wrong receipt totals | Store all money as integer cents; enforced by validators + unit tests. |
| Editing a donation after receipt issued | Invalid receipt on file | `donations.locked` + Firestore rule deny + Cloud Function guard; UI offers void/reissue only. |
| Duplicate donor creation | Split history, wrong receipt totals | Warn on create; merge workflow reassigns donations atomically. |
| Email deliverability | Post-MVP concern | MVP uses manual CSV/PDF sharing. Email delivery added post-MVP. |
| Data loss | Charity operational failure | Nightly Firestore export to GCS; restore runbook. |
| Scope creep | Never ships | Anything off the MVP checklist goes into `docs/projects/post-mvp-backlog.md` and waits. |

---

## Definition of Done (MVP)

- Every requirement in `app-overview.md` is ticked off in `mvp-checklist.md`, or explicitly deferred in `post-mvp-backlog.md` with your sign-off.
- A real receipt for a real donor was issued, emailed, and received.
- Nightly backups running with a documented restore path.
- One week of parallel data entry against the Google Sheets reconciled to the cent.
- `summary.md` is written.

---

*This plan is a living document. When direction changes, update the relevant phase **before** the agent executes it, and note the change in `updates.md`.*
