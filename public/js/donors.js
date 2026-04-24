// Donor management Alpine component.
// Registered as Alpine.data("donors") in the alpine:init listener below.
// Handles: list, detail, create/edit form, duplicate detection, and merge.
//
// All Firestore paths go through companyCollection/companyDoc from company.js
// so every query is automatically scoped to the active company.

import {
  companyCollection,
  companyDoc,
  companyReady,
  getActiveCompanyId,
} from "./company.js";
import { functions } from "./firebase.js";
import { validateDonor, donorSearchTokens } from "./schemas/index.js";
import { formatCents } from "./money.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

const PAGE_SIZE = 50;

// Levenshtein distance (used for duplicate name detection).
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function donorName(d) {
  if (!d) return "";
  if (d.orgName) return d.orgName;
  return [d.firstName, d.lastName].filter(Boolean).join(" ");
}

function emptyForm() {
  return {
    firstName: "", lastName: "", orgName: "",
    email: "", phone: "",
    address: { line1: "", line2: "", city: "", province: "", postalCode: "", country: "Canada" },
    preferredContact: "any",
    notes: "",
    isOrg: false,
  };
}

const currentYear = new Date().getFullYear();

document.addEventListener("alpine:init", () => {
  Alpine.data("donors", () => ({
    // ── View ──────────────────────────────────────────────────────────────
    view: "list",       // "list" | "detail" | "form" | "merge"

    // ── List ──────────────────────────────────────────────────────────────
    donors: [],
    loading: false,
    hasMore: false,
    lastVisible: null,
    searchQuery: "",
    statusFilter: "active",
    debounceTimer: null,

    // ── Detail ────────────────────────────────────────────────────────────
    selected: null,
    recentDonations: [],
    loadingDonations: false,
    ytdReceiptable: 0,

    // ── Form ──────────────────────────────────────────────────────────────
    formMode: "create",
    form: emptyForm(),
    formErrors: {},
    saving: false,
    duplicates: [],
    ignoreDuplicates: false,

    // ── Merge ─────────────────────────────────────────────────────────────
    mergeStep: "select",   // "select" | "resolve" | "confirm"
    mergeSecondaries: [],  // donor objects to merge into selected
    mergeConflicts: [],    // [{field, label, primaryValue, options: [{donorId, value}]}]
    mergeResolutions: {},  // field → value
    mergeDonations: 0,
    merging: false,
    mergeError: "",

    // ─────────────────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────────────────
    async init() {
      await companyReady;
      await this.loadDonors();
      window.addEventListener("krk:companyChanged", async () => {
        this.reset();
        await this.loadDonors();
      });
    },

    reset() {
      this.view = "list";
      this.donors = [];
      this.lastVisible = null;
      this.hasMore = false;
      this.searchQuery = "";
      this.statusFilter = "active";
    },

    // ─────────────────────────────────────────────────────────────────────
    // List
    // ─────────────────────────────────────────────────────────────────────
    async loadDonors(append = false) {
      this.loading = true;
      try {
        let q;
        if (this.searchQuery.trim()) {
          const tokens = donorSearchTokens({ firstName: this.searchQuery, lastName: this.searchQuery })
            .slice(0, 10);
          if (!tokens.length) { this.donors = []; return; }
          q = query(companyCollection("donors"),
            where("searchTokens", "array-contains-any", tokens),
            limit(PAGE_SIZE));
        } else {
          const constraints = [orderBy("lastName"), limit(PAGE_SIZE)];
          if (this.statusFilter !== "all") {
            constraints.unshift(where("status", "==", this.statusFilter));
          }
          if (append && this.lastVisible) constraints.push(startAfter(this.lastVisible));
          q = query(companyCollection("donors"), ...constraints);
        }
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.donors = append ? [...this.donors, ...rows] : rows;
        this.lastVisible = snap.docs[snap.docs.length - 1] ?? null;
        this.hasMore = snap.docs.length === PAGE_SIZE;
      } finally {
        this.loading = false;
      }
    },

    onSearchInput() {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.loadDonors(), 300);
    },

    async onFilterChange() {
      this.lastVisible = null;
      await this.loadDonors();
    },

    async loadMore() {
      await this.loadDonors(true);
    },

    donorDisplayName(d) { return donorName(d); },

    // ─────────────────────────────────────────────────────────────────────
    // Detail
    // ─────────────────────────────────────────────────────────────────────
    async showDetail(donor) {
      this.selected = donor;
      this.view = "detail";
      this.recentDonations = [];
      this.ytdReceiptable = 0;
      this.loadingDonations = true;
      try {
        const snap = await getDocs(query(
          companyCollection("donations"),
          where("donorId", "==", donor.id),
          orderBy("date", "desc"),
          limit(5)
        ));
        this.recentDonations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // YTD receiptable total — query all donations this year.
        const ytdSnap = await getDocs(query(
          companyCollection("donations"),
          where("donorId", "==", donor.id),
          where("hasReceiptable", "==", true)
        ));
        let total = 0;
        for (const doc of ytdSnap.docs) {
          const d = doc.data();
          if (d.date && d.date.startsWith(String(currentYear))) {
            // Sum receiptable allocations for this donation.
            const allocSnap = await getDocs(
              collection(companyDoc("donations", doc.id), "allocations")
            );
            for (const a of allocSnap.docs) {
              const ad = a.data();
              if (ad.receiptable) total += ad.amountCents;
            }
          }
        }
        this.ytdReceiptable = total;
      } finally {
        this.loadingDonations = false;
      }
    },

    formatCents(c) { return formatCents(c); },

    // ─────────────────────────────────────────────────────────────────────
    // Form
    // ─────────────────────────────────────────────────────────────────────
    startCreate() {
      this.formMode = "create";
      this.form = emptyForm();
      this.formErrors = {};
      this.duplicates = [];
      this.ignoreDuplicates = false;
      this.view = "form";
    },

    startEdit() {
      this.formMode = "edit";
      const s = this.selected;
      this.form = {
        firstName: s.firstName || "",
        lastName: s.lastName || "",
        orgName: s.orgName || "",
        email: s.email || "",
        phone: s.phone || "",
        address: s.address
          ? { ...s.address }
          : { line1: "", line2: "", city: "", province: "", postalCode: "", country: "Canada" },
        preferredContact: s.preferredContact || "any",
        notes: s.notes || "",
        isOrg: !!s.orgName && !s.firstName,
      };
      this.formErrors = {};
      this.duplicates = [];
      this.ignoreDuplicates = false;
      this.view = "form";
    },

    cancelForm() {
      this.view = this.formMode === "edit" && this.selected ? "detail" : "list";
    },

    async saveDonor() {
      this.formErrors = {};
      const input = {
        firstName: this.form.isOrg ? "" : this.form.firstName,
        lastName: this.form.isOrg ? "" : this.form.lastName,
        orgName: this.form.isOrg ? this.form.orgName : "",
        email: this.form.email,
        phone: this.form.phone,
        address: this.form.address,
        preferredContact: this.form.preferredContact,
        notes: this.form.notes,
        status: "active",
      };
      const result = validateDonor(input);
      if (!result.ok) { this.formErrors = result.errors; return; }

      // Duplicate detection (skip if user already acknowledged).
      if (!this.ignoreDuplicates) {
        const found = await this.detectDuplicates(result.value);
        if (found.length > 0) {
          this.duplicates = found;
          return;
        }
      }

      this.saving = true;
      try {
        const data = {
          ...result.value,
          searchTokens: donorSearchTokens(result.value),
        };
        if (this.formMode === "create") {
          const ref = await addDoc(companyCollection("donors"), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const newSnap = await getDoc(ref);
          this.selected = { id: ref.id, ...newSnap.data() };
        } else {
          await updateDoc(companyDoc("donors", this.selected.id), {
            ...data,
            updatedAt: serverTimestamp(),
          });
          const updated = await getDoc(companyDoc("donors", this.selected.id));
          this.selected = { id: updated.id, ...updated.data() };
        }
        await this.loadDonors();
        this.view = "detail";
      } finally {
        this.saving = false;
      }
    },

    async detectDuplicates(donor) {
      const dupes = [];
      if (donor.email) {
        const snap = await getDocs(query(
          companyCollection("donors"),
          where("email", "==", donor.email.toLowerCase())
        ));
        for (const d of snap.docs) {
          if (this.formMode === "edit" && d.id === this.selected?.id) continue;
          dupes.push({ id: d.id, ...d.data(), reason: "Same email address" });
        }
      }
      // Name + phone similarity.
      if (donor.lastName && donor.phone) {
        const phoneDigits = donor.phone.replace(/\D/g, "").slice(0, 6);
        const snap = await getDocs(query(
          companyCollection("donors"),
          where("status", "==", "active"),
          limit(200)
        ));
        for (const d of snap.docs) {
          if (dupes.find((x) => x.id === d.id)) continue;
          if (this.formMode === "edit" && d.id === this.selected?.id) continue;
          const dd = d.data();
          const dist = levenshtein(
            (dd.lastName || "").toLowerCase(),
            donor.lastName.toLowerCase()
          );
          if (dist <= 2) {
            const existPhone = (dd.phone || "").replace(/\D/g, "").slice(0, 6);
            if (existPhone && phoneDigits && existPhone === phoneDigits) {
              dupes.push({ id: d.id, ...dd, reason: "Similar name and phone" });
            }
          }
        }
      }
      return dupes;
    },

    proceedDespiteDuplicates() {
      this.ignoreDuplicates = true;
      this.duplicates = [];
      this.saveDonor();
    },

    // ─────────────────────────────────────────────────────────────────────
    // Archive / unarchive
    // ─────────────────────────────────────────────────────────────────────
    async archiveDonor() {
      if (!this.selected) return;
      await updateDoc(companyDoc("donors", this.selected.id), {
        status: "archived",
        updatedAt: serverTimestamp(),
      });
      this.selected = { ...this.selected, status: "archived" };
      await this.loadDonors();
    },

    async unarchiveDonor() {
      if (!this.selected) return;
      await updateDoc(companyDoc("donors", this.selected.id), {
        status: "active",
        updatedAt: serverTimestamp(),
      });
      this.selected = { ...this.selected, status: "active" };
      await this.loadDonors();
    },

    // ─────────────────────────────────────────────────────────────────────
    // Merge
    // ─────────────────────────────────────────────────────────────────────
    startMerge() {
      this.mergeStep = "select";
      this.mergeSecondaries = [];
      this.mergeConflicts = [];
      this.mergeResolutions = {};
      this.mergeDonations = 0;
      this.merging = false;
      this.mergeError = "";
      this.view = "merge";
    },

    toggleSecondary(donor) {
      if (donor.id === this.selected?.id) return;
      const idx = this.mergeSecondaries.findIndex((d) => d.id === donor.id);
      if (idx >= 0) {
        this.mergeSecondaries.splice(idx, 1);
      } else {
        this.mergeSecondaries.push(donor);
      }
    },

    isSecondary(donor) {
      return this.mergeSecondaries.some((d) => d.id === donor.id);
    },

    async proceedToResolve() {
      if (this.mergeSecondaries.length === 0) return;

      // Build conflict list.
      const FIELDS = [
        { key: "firstName", label: "First Name" },
        { key: "lastName", label: "Last Name" },
        { key: "orgName", label: "Organization" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "preferredContact", label: "Preferred Contact" },
        { key: "notes", label: "Notes" },
      ];
      const primary = this.selected;
      const conflicts = [];
      const resolutions = {};
      for (const { key, label } of FIELDS) {
        const primaryVal = primary[key] || "";
        const options = [{ donorId: primary.id, name: donorName(primary), value: primaryVal }];
        let hasConflict = false;
        for (const sec of this.mergeSecondaries) {
          const secVal = sec[key] || "";
          options.push({ donorId: sec.id, name: donorName(sec), value: secVal });
          if (secVal && secVal !== primaryVal) hasConflict = true;
        }
        if (hasConflict) {
          conflicts.push({ key, label, options });
        }
        resolutions[key] = primaryVal; // default: keep primary
      }
      this.mergeConflicts = conflicts;
      this.mergeResolutions = resolutions;

      // Count donations that will move.
      let count = 0;
      for (const sec of this.mergeSecondaries) {
        const snap = await getDocs(query(
          companyCollection("donations"),
          where("donorId", "==", sec.id)
        ));
        count += snap.size;
      }
      this.mergeDonations = count;
      this.mergeStep = "confirm";
    },

    async executeMerge() {
      this.merging = true;
      this.mergeError = "";
      try {
        const fn = httpsCallable(functions, "mergeDonors");
        await fn({
          companyId: getActiveCompanyId(),
          primaryId: this.selected.id,
          secondaryIds: this.mergeSecondaries.map((d) => d.id),
          resolvedFields: this.mergeResolutions,
        });
        // Reload the primary donor and return to detail.
        const updated = await getDoc(companyDoc("donors", this.selected.id));
        this.selected = { id: updated.id, ...updated.data() };
        await this.loadDonors();
        this.view = "detail";
      } catch (err) {
        this.mergeError = err?.message || "Merge failed. Please try again.";
      } finally {
        this.merging = false;
      }
    },

    cancelMerge() {
      this.view = this.selected ? "detail" : "list";
    },
  }));
});
