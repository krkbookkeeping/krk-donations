// Donations Alpine component.
// Handles: paginated list, create/edit form with allocation grid, batch mode,
// inline donor creation, and archive (soft-delete).
//
// All money values in the form are dollar strings (e.g. "12.34").
// They are converted to integer cents via toCents() before validation and storage.
// The balance footer and isBalanced computed property use the same conversion.

import { companyCollection, companyDoc, companyReady } from "./company.js";
import { db, auth } from "./firebase.js";
import { validateDonation, validateDonor, donorSearchTokens } from "./schemas/index.js";
import { toCents, formatCents } from "./money.js";
import {
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
  writeBatch,
  collection,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const PAGE_SIZE = 50;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyAllocation() {
  return { categoryId: "", amountDollars: "", receiptable: false };
}

function emptyForm() {
  return {
    donorId: "",
    donorName: "",
    date: today(),
    amountDollars: "",
    paymentMethodId: "",
    referenceNumber: "",
    notes: "",
    allocations: [emptyAllocation()],
  };
}

document.addEventListener("alpine:init", () => {
  Alpine.data("donations", () => ({
    // ── View ──────────────────────────────────────────────────────────────
    view: "list",          // "list" | "form"

    // ── List ──────────────────────────────────────────────────────────────
    donations: [],
    loading: false,
    hasMore: false,
    lastVisible: null,

    // ── Lookup data ───────────────────────────────────────────────────────
    categories: [],
    paymentMethods: [],

    // ── Form ──────────────────────────────────────────────────────────────
    formMode: "create",    // "create" | "edit"
    editingId: null,
    form: emptyForm(),
    formErrors: {},
    saving: false,
    batchMode: false,

    // ── Donor search ──────────────────────────────────────────────────────
    donorQuery: "",
    donorResults: [],
    showDonorDropdown: false,
    searchingDonors: false,
    donorDebounce: null,

    // ── Inline new-donor panel ────────────────────────────────────────────
    showNewDonorPanel: false,
    newDonorForm: {
      isOrg: false, firstName: "", lastName: "", orgName: "", email: "", phone: "",
    },
    newDonorErrors: {},
    savingNewDonor: false,

    // ─────────────────────────────────────────────────────────────────────
    // Computed helpers
    // ─────────────────────────────────────────────────────────────────────
    get totalCents() {
      return toCents(this.form.amountDollars) ?? 0;
    },

    get allocatedCents() {
      return this.form.allocations.reduce((sum, a) => {
        return sum + (toCents(a.amountDollars) ?? 0);
      }, 0);
    },

    get differenceCents() {
      return this.allocatedCents - this.totalCents;
    },

    get isBalanced() {
      return this.totalCents > 0 && this.differenceCents === 0;
    },

    // ─────────────────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────────────────
    async init() {
      await companyReady;
      await Promise.all([this.loadDonations(), this.loadLookups()]);
      window.addEventListener("krk:companyChanged", async () => {
        this.view = "list";
        this.donations = [];
        this.lastVisible = null;
        this.categories = [];
        this.paymentMethods = [];
        await Promise.all([this.loadDonations(), this.loadLookups()]);
      });
    },

    // ─────────────────────────────────────────────────────────────────────
    // Lookup tables (categories + payment methods)
    // ─────────────────────────────────────────────────────────────────────
    async loadLookups() {
      const [catSnap, pmSnap] = await Promise.all([
        getDocs(query(
          companyCollection("categories"),
          where("status", "==", "active"),
          orderBy("name")
        )),
        getDocs(query(
          companyCollection("paymentMethods"),
          where("status", "==", "active"),
          orderBy("name")
        )),
      ]);
      this.categories   = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      this.paymentMethods = pmSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    categoryById(id) {
      return this.categories.find((c) => c.id === id) ?? null;
    },

    paymentMethodName(id) {
      return this.paymentMethods.find((p) => p.id === id)?.name ?? "—";
    },

    // ─────────────────────────────────────────────────────────────────────
    // List
    // ─────────────────────────────────────────────────────────────────────
    async loadDonations(append = false) {
      this.loading = true;
      try {
        const constraints = [
          where("status", "==", "active"),
          orderBy("date", "desc"),
          limit(PAGE_SIZE),
        ];
        if (append && this.lastVisible) constraints.push(startAfter(this.lastVisible));
        const snap = await getDocs(query(companyCollection("donations"), ...constraints));
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.donations = append ? [...this.donations, ...rows] : rows;
        this.lastVisible = snap.docs[snap.docs.length - 1] ?? null;
        this.hasMore = snap.docs.length === PAGE_SIZE;
      } finally {
        this.loading = false;
      }
    },

    async loadMore() {
      await this.loadDonations(true);
    },

    formatCents(c) { return formatCents(c); },

    // ─────────────────────────────────────────────────────────────────────
    // Donor search
    // ─────────────────────────────────────────────────────────────────────
    onDonorInput() {
      const q = this.donorQuery.trim();
      if (!q) {
        this.form.donorId = "";
        this.form.donorName = "";
        this.donorResults = [];
        this.showDonorDropdown = false;
        return;
      }
      clearTimeout(this.donorDebounce);
      this.donorDebounce = setTimeout(() => this.searchDonors(q), 250);
    },

    async searchDonors(q) {
      this.searchingDonors = true;
      try {
        const tokens = q.toLowerCase().split(/\s+/).filter((t) => t.length >= 2).slice(0, 10);
        if (!tokens.length) { this.donorResults = []; return; }
        const snap = await getDocs(query(
          companyCollection("donors"),
          where("searchTokens", "array-contains-any", tokens),
          where("status", "==", "active"),
          limit(8)
        ));
        this.donorResults = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        this.showDonorDropdown = this.donorResults.length > 0;
      } finally {
        this.searchingDonors = false;
      }
    },

    donorFullName(d) {
      if (!d) return "";
      return d.orgName || [d.firstName, d.lastName].filter(Boolean).join(" ");
    },

    selectDonor(donor) {
      this.form.donorId   = donor.id;
      this.form.donorName = this.donorFullName(donor);
      this.donorQuery     = this.form.donorName;
      this.donorResults   = [];
      this.showDonorDropdown  = false;
      this.showNewDonorPanel  = false;
    },

    closeDonorDropdown() {
      this.showDonorDropdown = false;
    },

    // ─────────────────────────────────────────────────────────────────────
    // Inline new-donor panel
    // ─────────────────────────────────────────────────────────────────────
    openNewDonorPanel() {
      this.showNewDonorPanel = true;
      this.showDonorDropdown = false;
      this.newDonorForm = {
        isOrg: false, firstName: "", lastName: "", orgName: "", email: "", phone: "",
      };
      this.newDonorErrors = {};
    },

    cancelNewDonor() {
      this.showNewDonorPanel = false;
    },

    async saveNewDonor() {
      this.newDonorErrors = {};
      const input = {
        firstName: this.newDonorForm.isOrg ? "" : this.newDonorForm.firstName,
        lastName:  this.newDonorForm.isOrg ? "" : this.newDonorForm.lastName,
        orgName:   this.newDonorForm.isOrg ? this.newDonorForm.orgName : "",
        email:     this.newDonorForm.email,
        phone:     this.newDonorForm.phone,
        status:    "active",
      };
      const result = validateDonor(input);
      if (!result.ok) { this.newDonorErrors = result.errors; return; }

      this.savingNewDonor = true;
      try {
        const ref = await addDoc(companyCollection("donors"), {
          ...result.value,
          searchTokens: donorSearchTokens(result.value),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const snap = await getDoc(ref);
        this.selectDonor({ id: ref.id, ...snap.data() });
        this.showNewDonorPanel = false;
      } finally {
        this.savingNewDonor = false;
      }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Allocation grid
    // ─────────────────────────────────────────────────────────────────────
    addRow() {
      this.form.allocations.push(emptyAllocation());
    },

    removeRow(idx) {
      if (this.form.allocations.length > 1) {
        this.form.allocations.splice(idx, 1);
      }
    },

    onCategoryChange(idx) {
      const cat = this.categoryById(this.form.allocations[idx].categoryId);
      this.form.allocations[idx].receiptable = cat?.receiptable ?? false;
    },

    allocationErrorAt(idx, field) {
      const e = this.formErrors.allocations;
      if (!Array.isArray(e)) return "";
      return e[idx]?.[field] ?? "";
    },

    // ─────────────────────────────────────────────────────────────────────
    // Form open/close
    // ─────────────────────────────────────────────────────────────────────
    startCreate() {
      this.formMode        = "create";
      this.editingId       = null;
      this.form            = emptyForm();
      this.formErrors      = {};
      this.donorQuery      = "";
      this.donorResults    = [];
      this.showDonorDropdown  = false;
      this.showNewDonorPanel  = false;
      this.view            = "form";
    },

    async startEdit(donation) {
      if (donation.locked) return;
      this.formMode  = "edit";
      this.editingId = donation.id;
      this.formErrors = {};
      this.showNewDonorPanel = false;

      // Load allocations subcollection.
      const allocSnap = await getDocs(
        collection(companyDoc("donations", donation.id), "allocations")
      );
      const allocs = allocSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));

      // Resolve donor display name.
      let dname = donation.donorName || "";
      if (!dname && donation.donorId) {
        try {
          const ds = await getDoc(companyDoc("donors", donation.donorId));
          if (ds.exists()) dname = this.donorFullName(ds.data());
        } catch (_) {}
      }

      this.form = {
        donorId:         donation.donorId || "",
        donorName:       dname,
        date:            donation.date || today(),
        amountDollars:   donation.totalAmountCents
                           ? (donation.totalAmountCents / 100).toFixed(2)
                           : "",
        paymentMethodId: donation.paymentMethodId || "",
        referenceNumber: donation.referenceNumber || "",
        notes:           donation.notes || "",
        allocations:     allocs.length > 0
          ? allocs.map((a) => ({
              _id:          a._id,
              categoryId:   a.categoryId || "",
              amountDollars: a.amountCents
                              ? (a.amountCents / 100).toFixed(2)
                              : "",
              receiptable:  a.receiptable ?? false,
            }))
          : [emptyAllocation()],
      };
      this.donorQuery = dname;
      this.donorResults = [];
      this.showDonorDropdown = false;
      this.view = "form";
    },

    cancelForm() {
      this.view = "list";
    },

    // ─────────────────────────────────────────────────────────────────────
    // Save
    // ─────────────────────────────────────────────────────────────────────
    async saveDonation() {
      this.formErrors = {};

      if (!this.form.donorId) {
        this.formErrors.donorId = "Select a donor.";
        return;
      }

      // Convert allocation dollar strings → cents for the validator.
      const allocInputs = this.form.allocations.map((a) => ({
        categoryId:  a.categoryId,
        amountCents: toCents(a.amountDollars) ?? 0,
        receiptable: a.receiptable,
      }));

      const result = validateDonation(
        {
          donorId:         this.form.donorId,
          date:            this.form.date,
          totalAmountCents: this.totalCents,
          paymentMethodId: this.form.paymentMethodId,
          referenceNumber: this.form.referenceNumber,
          notes:           this.form.notes,
        },
        allocInputs
      );
      if (!result.ok) { this.formErrors = result.errors; return; }

      this.saving = true;
      try {
        const uid = auth.currentUser?.uid ?? "";
        const donationData = {
          ...result.value,
          donorName:  this.form.donorName,   // display snapshot
          status:     "active",
          createdBy:  uid,
        };

        const batch = writeBatch(db);

        if (this.formMode === "create") {
          const donationRef = doc(companyCollection("donations"));
          batch.set(donationRef, {
            ...donationData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          for (const alloc of result.allocations) {
            batch.set(doc(collection(donationRef, "allocations")), {
              ...alloc,
              createdAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } else {
          // Edit: replace allocations atomically.
          const donationRef  = companyDoc("donations", this.editingId);
          const oldAllocSnap = await getDocs(
            collection(donationRef, "allocations")
          );
          const { createdBy: _cb, ...updateFields } = donationData;
          batch.update(donationRef, {
            ...updateFields,
            updatedAt: serverTimestamp(),
          });
          for (const old of oldAllocSnap.docs) {
            batch.delete(old.ref);
          }
          for (const alloc of result.allocations) {
            batch.set(doc(collection(donationRef, "allocations")), {
              ...alloc,
              createdAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }

        await this.loadDonations();

        if (this.batchMode && this.formMode === "create") {
          // Keep date + payment method; reset everything else.
          const savedDate = this.form.date;
          const savedPm   = this.form.paymentMethodId;
          this.form       = emptyForm();
          this.form.date            = savedDate;
          this.form.paymentMethodId = savedPm;
          this.donorQuery    = "";
          this.donorResults  = [];
          this.showDonorDropdown = false;
        } else {
          this.view = "list";
        }
      } finally {
        this.saving = false;
      }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Archive
    // ─────────────────────────────────────────────────────────────────────
    async archiveDonation(donation) {
      await updateDoc(companyDoc("donations", donation.id), {
        status:    "archived",
        updatedAt: serverTimestamp(),
      });
      this.donations = this.donations.filter((d) => d.id !== donation.id);
    },
  }));
});
