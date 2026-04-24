# ADR 0001 — Tech Stack

**Date:** 2026-04-23
**Status:** Accepted
**Context:** KRK Donations MVP (zero to MVP plan in `docs/projects/project-startup/plans.md`).

---

## Decision

The app is built as **plain HTML + CSS + vanilla JavaScript (ES modules)** on the frontend with **no build step**, backed by **Firebase** (Auth, Firestore, Storage, Cloud Functions, Hosting). Cloud Functions is the only part of the repo that uses `npm` and TypeScript.

## Stack summary

| Layer | Choice |
|---|---|
| Frontend markup | Plain HTML files in `public/` |
| Frontend logic | Vanilla JS (ES modules), loaded as `<script type="module">` |
| Frontend reactivity (optional) | Alpine.js via one CDN `<script>` tag, used only for allocation grid & duplicate-warning card |
| Frontend styling | Hand-rolled `public/styles.css` + Pico.css via CDN for sensible defaults |
| Frontend forms/validation | Native HTML5 constraints + custom JS validators in `public/js/schemas/` |
| Money handling | Integer cents only, via `public/js/money.js` helpers (mirrored in `functions/`) |
| Auth | Firebase Authentication (email/password) via CDN modular SDK |
| Database | Cloud Firestore via CDN modular SDK, realtime listeners where useful |
| File storage | Firebase Storage |
| Serverless | Cloud Functions for Firebase, Node.js 20, TypeScript |
| PDF generation | `pdfkit` inside a Cloud Function |
| Email delivery | Firebase Trigger Email extension (`firestore-send-email`), SMTP |
| Hosting | Firebase Hosting |
| Testing | Vitest for `functions/` (money, allocation, merge, receipt numbering) + one Playwright E2E for receipt issuance flow |
| CI | GitHub Actions: lint/test `functions/`, preview-deploy Hosting on PR |

## Repository layout

```
public/                     ← deployed as-is by Firebase Hosting
  index.html                ← sign-in page
  app.html                  ← authenticated shell; sections swap by hash route
  styles.css
  js/
    env.js                  ← gitignored, real Firebase web config
    env.example.js          ← template checked in
    firebase.js             ← initializes CDN SDK, exports auth/db/storage
    auth.js
    donors.js
    donations.js
    allocations.js          ← balance math helpers
    categories.js
    paymentMethods.js
    receipts.js
    reports.js
    audit.js
    money.js                ← integer-cent helpers
    ui.js                   ← small DOM helpers
    schemas/                ← per-entity validators
functions/                  ← only place with package.json + TypeScript
firebase.json
firestore.rules
firestore.indexes.json
storage.rules
.gitignore
```

## Rationale

- **No frontend build step.** Fewer moving parts, faster iteration, easier to debug in the browser, matches the user's "the app should be in HTML" preference.
- **Firebase for everything backend.** Single billing account, single deploy pipeline, no infrastructure to manage. Blaze plan required for Cloud Functions and outbound email.
- **Integer cents, not floats.** Allocation balance validation is exact; rules out rounding bugs in receipts.
- **Server-rendered PDFs.** Receipts are generated in a Cloud Function using `pdfkit` so the stored PDF is authoritative and tamper-evident — critical for CRA compliance.
- **Firestore transactions for receipt numbering.** Guarantees sequential, collision-free receipt numbers.
- **Alpine.js reserved for two places only.** Allocation grid (rows added/removed with live balance) and duplicate-warning card. Everywhere else is fine with direct DOM manipulation. If we hit three+ reactive surfaces, revisit the choice.

## Trade-offs & alternatives considered

- **React + Vite** — rejected for MVP. User preference is HTML-first; the app's interactivity surface is small (one grid, one filter bar, a few forms). Vanilla JS is sufficient and avoids a build pipeline entirely.
- **Tailwind CSS** — rejected because it requires a build step. Pico.css gives us 80% of the visual polish for one `<link>` tag.
- **HTMX** — considered; rejected because Firestore is a client-side API, not a server endpoint, so HTMX's swap model doesn't fit cleanly.
- **Client-side PDF (e.g. jsPDF)** — rejected. Generating receipts server-side protects the integrity of the stored PDF snapshot and avoids having to trust the browser environment for a legally binding document.
- **Supabase / Postgres** — rejected. Firestore's document model with subcollections maps naturally to donation → allocations; no migration planning needed; realtime out of the box.

## Consequences

- Frontend is easy to inspect and hand-edit in any text editor.
- No TypeScript type safety on the frontend — compensated by validator functions and integer-cents discipline.
- Any future feature that needs heavy client-side state (e.g. a WYSIWYG template editor) may justify revisiting the "no build step" rule. That would be an explicit ADR, not a drift.
- Firebase costs are usage-based; a $10 CAD/month budget alert is set in Google Cloud Billing as an early-warning signal.
