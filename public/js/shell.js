// Alpine.js component registration for app.html.
//
// This file must be loaded (via <script type="module">) BEFORE the Alpine CDN
// script tag so that the 'alpine:init' listener is registered before Alpine
// fires it. app.html enforces that order by placing the Alpine <script defer>
// tag after all module scripts.
//
// Two components:
//   - onboarding: first-run "create your first company" card. Visible only
//     when the signed-in user has zero companies.
//   - appShell: normal sidebar + topbar + content shell. Visible only when
//     the user has at least one company AND an activeCompanyId.

import {
  companyReady,
  getActiveCompanyId,
  getCompanyIds,
  switchCompany,
  createCompany,
} from "./company.js";
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const companyNameCache = new Map(); // companyId → name

async function loadCompanyNames(ids) {
  const missing = ids.filter((id) => !companyNameCache.has(id));
  await Promise.all(
    missing.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, `companies/${id}`));
        companyNameCache.set(id, snap.exists() ? snap.data().name || "(unnamed)" : "(missing)");
      } catch {
        companyNameCache.set(id, "(error)");
      }
    })
  );
  return ids.map((id) => ({ id, name: companyNameCache.get(id) }));
}

document.addEventListener("alpine:init", () => {
  Alpine.data("onboarding", () => ({
    show: false,
    name: "",
    submitting: false,
    error: "",

    async init() {
      await companyReady;
      this.updateVisibility();
      window.addEventListener("krk:companiesUpdated", () => this.updateVisibility());
      window.addEventListener("krk:companyChanged", () => this.updateVisibility());
    },

    updateVisibility() {
      this.show = getCompanyIds().length === 0;
    },

    async submit() {
      this.error = "";
      const name = this.name.trim();
      if (!name) return;
      this.submitting = true;
      try {
        await createCompany(name);
        // company.js listener flips companyIds → this card hides automatically.
      } catch (err) {
        this.error = err?.message || "Something went wrong. Try again.";
      } finally {
        this.submitting = false;
      }
    },
  }));

  const routeFromHash = () => window.location.hash.replace(/^#\//, "") || "donors";

  Alpine.data("appShell", () => ({
    show: false,
    route: routeFromHash(),
    userEmail: "",
    activeCompanyId: null,
    companies: [],
    creatingCompany: false,
    newCompanyName: "",
    newCompanyError: "",
    submittingCompany: false,

    get activeCompanyName() {
      const c = this.companies.find((c) => c.id === this.activeCompanyId);
      return c ? c.name : "";
    },

    async init() {
      if (!window.location.hash) window.location.hash = "#/donors";
      window.addEventListener("hashchange", () => { this.route = routeFromHash(); });
      if (window.krkUser) this.userEmail = window.krkUser.email;
      window.addEventListener("krk:user", (e) => { this.userEmail = e.detail.email; });

      await companyReady;
      await this.refresh();
      window.addEventListener("krk:companiesUpdated", () => this.refresh());
      window.addEventListener("krk:companyChanged", () => this.refresh());
    },

    async refresh() {
      const ids = getCompanyIds();
      this.activeCompanyId = getActiveCompanyId();
      this.show = ids.length > 0 && !!this.activeCompanyId;
      this.companies = ids.length > 0 ? await loadCompanyNames(ids) : [];
    },

    async switchTo(companyId) {
      if (!companyId || companyId === this.activeCompanyId) return;
      try {
        await switchCompany(companyId);
      } catch (err) {
        alert(err?.message || "Could not switch company.");
      }
    },

    startNewCompany() {
      this.creatingCompany = true;
      this.newCompanyName = "";
      this.newCompanyError = "";
    },
    cancelNewCompany() {
      this.creatingCompany = false;
    },
    async submitNewCompany() {
      this.newCompanyError = "";
      const name = this.newCompanyName.trim();
      if (!name) return;
      this.submittingCompany = true;
      try {
        await createCompany(name);
        this.creatingCompany = false;
        this.newCompanyName = "";
      } catch (err) {
        this.newCompanyError = err?.message || "Something went wrong. Try again.";
      } finally {
        this.submittingCompany = false;
      }
    },

    signOut() { window.krkSignOut?.(); },
  }));
});
