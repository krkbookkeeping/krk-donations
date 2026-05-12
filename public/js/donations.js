// Donations Alpine component.
// Handles: paginated list, create/edit form with allocation grid, batch mode,
// inline donor creation, and archive (soft-delete).
//
// All money values in the form are dollar strings (e.g. "12.34").
// They are converted to integer cents via toCents() before validation and storage.
// The balance footer and isBalanced computed property use the same conversion.

import { companyCollection, companyDoc, companyReady, getActiveCompanyId } from "./company.js";
import { db, auth, storage } from "./firebase.js";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  listAll,
  deleteObject,
  getMetadata,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { validateDonation, validateDonor, donorSearchTokens, donorQueryTokens } from "./schemas/index.js";
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
    sortBy: "date",       // "date" | "donor" | "total" | "payment" | "receiptable"
    sortDir: "desc",      // "asc" | "desc"

    // ── Filters (client-side over loaded rows) ────────────────────────────
    filter: {
      dateFrom: "",
      dateTo: "",
      donor: "",
      totalMin: "",
      totalMax: "",
      paymentMethodId: "",
      receiptable: "all", // "all" | "yes" | "no"
    },

    // ── Print ─────────────────────────────────────────────────────────────
    showPrintModal: false,
    printColumns: {
      date: true,
      donor: true,
      total: true,
      payment: true,
      receiptable: true,
    },

    // ── Lookup data ───────────────────────────────────────────────────────
    categories: [],
    paymentMethods: [],

    // ── Form ──────────────────────────────────────────────────────────────
    formMode: "create",    // "create" | "edit"
    editingId: null,
    form: emptyForm(),
    formErrors: {},
    saveError: "",
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

    // ── Attachments ───────────────────────────────────────────────────────
    attachments: [],
    attachmentsLoading: false,
    uploading: false,
    uploadProgress: 0,
    dragOver: false,

    // ── Dirty tracking + close confirmation ───────────────────────────────
    formSnapshot: "",
    confirmCloseOpen: false,

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
      // Avoid composite-index requirement: fetch all, sort/filter client-side.
      const [catSnap, pmSnap] = await Promise.all([
        getDocs(query(companyCollection("categories"),   orderBy("name"))),
        getDocs(query(companyCollection("paymentMethods"), orderBy("name"))),
      ]);
      this.categories = catSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.status === "active");
      this.paymentMethods = pmSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.status === "active");
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

    setSort(column) {
      if (this.sortBy === column) {
        this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
      } else {
        this.sortBy = column;
        // Sensible default direction per column.
        this.sortDir = (column === "donor" || column === "payment") ? "asc" : "desc";
      }
    },

    clearFilters() {
      this.filter.dateFrom = "";
      this.filter.dateTo = "";
      this.filter.donor = "";
      this.filter.totalMin = "";
      this.filter.totalMax = "";
      this.filter.paymentMethodId = "";
      this.filter.receiptable = "all";
    },

    openPrintModal()  { this.showPrintModal = true; },
    closePrintModal() { this.showPrintModal = false; },
    triggerPrint() {
      this.showPrintModal = false;
      this.$nextTick(() => window.print());
    },

    get filteredTotalCents() {
      return this.sortedDonations.reduce((s, d) => s + (d.totalAmountCents || 0), 0);
    },

    // ── Print-header labels ───────────────────────────────────────────────
    get printDateLabel() {
      const f = this.filter;
      if (!f.dateFrom && !f.dateTo) return "All dates";
      return `${f.dateFrom || "—"} to ${f.dateTo || "—"}`;
    },
    get printDonorLabel() {
      return this.filter.donor ? `Matches "${this.filter.donor}"` : "All donors";
    },
    get printTotalRangeLabel() {
      const f = this.filter;
      if (f.totalMin === "" && f.totalMax === "") return "Any amount";
      const min = f.totalMin === "" ? "—" : `$${f.totalMin}`;
      const max = f.totalMax === "" ? "—" : `$${f.totalMax}`;
      return `${min} to ${max}`;
    },
    get printPaymentLabel() {
      if (!this.filter.paymentMethodId) return "All payment methods";
      return this.paymentMethodName(this.filter.paymentMethodId);
    },
    get printReceiptableLabel() {
      if (this.filter.receiptable === "yes") return "Receiptable only";
      if (this.filter.receiptable === "no")  return "Non-receiptable only";
      return "All";
    },
    get printSortLabel() {
      const col = { date: "Date", donor: "Donor", total: "Total", payment: "Payment", receiptable: "Receiptable" }[this.sortBy] || "Date";
      const dir = this.sortDir === "asc" ? "ascending" : "descending";
      return `${col}, ${dir}`;
    },

    get hasActiveFilters() {
      const f = this.filter;
      return Boolean(
        f.dateFrom || f.dateTo || f.donor || f.totalMin || f.totalMax ||
        f.paymentMethodId || f.receiptable !== "all"
      );
    },

    get sortedDonations() {
      const f = this.filter;
      const donorQ = f.donor.trim().toLowerCase();
      const minCents = f.totalMin === "" ? null : Math.round(parseFloat(f.totalMin) * 100);
      const maxCents = f.totalMax === "" ? null : Math.round(parseFloat(f.totalMax) * 100);

      const filtered = this.donations.filter((d) => {
        if (f.dateFrom && (d.date || "") < f.dateFrom) return false;
        if (f.dateTo   && (d.date || "") > f.dateTo)   return false;
        if (donorQ && !(d.donorName || "").toLowerCase().includes(donorQ)) return false;
        const cents = d.totalAmountCents || 0;
        if (minCents !== null && !Number.isNaN(minCents) && cents < minCents) return false;
        if (maxCents !== null && !Number.isNaN(maxCents) && cents > maxCents) return false;
        if (f.paymentMethodId && d.paymentMethodId !== f.paymentMethodId) return false;
        if (f.receiptable === "yes" && !d.hasReceiptable) return false;
        if (f.receiptable === "no"  &&  d.hasReceiptable) return false;
        return true;
      });

      const dir = this.sortDir === "asc" ? 1 : -1;
      const arr = [...filtered];
      arr.sort((a, b) => {
        let av, bv;
        switch (this.sortBy) {
          case "donor":
            av = (a.donorName || "").toLowerCase();
            bv = (b.donorName || "").toLowerCase();
            return av.localeCompare(bv) * dir;
          case "total":
            return ((a.totalAmountCents || 0) - (b.totalAmountCents || 0)) * dir;
          case "payment":
            av = this.paymentMethodName(a.paymentMethodId).toLowerCase();
            bv = this.paymentMethodName(b.paymentMethodId).toLowerCase();
            return av.localeCompare(bv) * dir;
          case "receiptable":
            return ((a.hasReceiptable ? 1 : 0) - (b.hasReceiptable ? 1 : 0)) * dir;
          case "date":
          default:
            av = a.date || "";
            bv = b.date || "";
            return av.localeCompare(bv) * dir;
        }
      });
      return arr;
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
        const tokens = donorQueryTokens(q);
        if (!tokens.length) { this.donorResults = []; return; }
        // No status filter here — combining array-contains-any with ==
        // requires a composite index. Filter active donors client-side instead.
        const snap = await getDocs(query(
          companyCollection("donors"),
          where("searchTokens", "array-contains-any", tokens),
          limit(10)
        ));
        this.donorResults = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((d) => d.status !== "archived")
          .slice(0, 8);
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

    onTotalAmountInput() {
      if (this.form.allocations.length === 1) {
        this.form.allocations[0].amountDollars = this.form.amountDollars;
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
      this.formMode = "create";
      this.editingId = null;
      this.form = emptyForm();
      this.formErrors = {};
      this.saveError = "";
      this.donorQuery = "";
      this.donorResults = [];
      this.showDonorDropdown = false;
      this.showNewDonorPanel = false;
      this.attachments = [];
      this.view = "form";

      // Apply defaults after the next render tick so that x-model bindings
      // and x-for option elements are fully established before we write to them.
      this.$nextTick(() => {
        const norm = (s) => s.toLowerCase().replace(/[\s\-]/g, "");
        const defPm = this.paymentMethods.find((p) => norm(p.name) === "etransfer");
        if (defPm) this.form.paymentMethodId = defPm.id;

        const defCat = this.categories.find((c) => c.name.toLowerCase() === "general donation");
        if (defCat) {
          this.form.allocations[0].categoryId  = defCat.id;
          this.form.allocations[0].receiptable = defCat.receiptable ?? false;
        }

        this.takeFormSnapshot();
      });
    },

    async startEdit(donation) {
      if (donation.locked) return;
      this.formMode  = "edit";
      this.editingId = donation.id;
      this.formErrors = {};
      this.saveError = "";
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

      // Reset to a clean reactive form, then show the view. The form
      // template renders with empty values so x-model bindings (and the
      // x-for option lists inside each <select>) are fully wired up
      // before any non-empty values are written. We then populate via
      // $nextTick — this fixes a timing issue where assigning a
      // pre-populated form object in the same tick as switching view
      // would leave selects in a broken binding state and silently
      // discard subsequent user edits.
      this.form = emptyForm();
      this.donorQuery = "";
      this.donorResults = [];
      this.showDonorDropdown = false;
      this.attachments = [];
      this.view = "form";

      this.$nextTick(() => {
        this.form.donorId         = donation.donorId || "";
        this.form.donorName       = dname;
        this.form.date            = donation.date || today();
        this.form.amountDollars   = donation.totalAmountCents
                                      ? (donation.totalAmountCents / 100).toFixed(2)
                                      : "";
        this.form.paymentMethodId = donation.paymentMethodId || "";
        this.form.referenceNumber = donation.referenceNumber || "";
        this.form.notes           = donation.notes || "";
        this.donorQuery           = dname;

        if (allocs.length > 0) {
          // Build allocations with empty categoryIds first; setting a
          // non-empty categoryId on a select before its <option> list
          // has rendered silently fails (same timing trap as above).
          this.form.allocations = allocs.map((a) => ({
            _id:           a._id,
            categoryId:    "",
            amountDollars: a.amountCents
                             ? (a.amountCents / 100).toFixed(2)
                             : "",
            receiptable:   a.receiptable ?? false,
          }));

          // Once the rows (and their inner x-for option lists) are
          // mounted, write categoryIds. Alpine's reactive x-model
          // effects then set each <select> to the correct option.
          this.$nextTick(() => {
            for (let i = 0; i < allocs.length; i++) {
              this.form.allocations[i].categoryId = allocs[i].categoryId || "";
            }
            this.takeFormSnapshot();
          });
        } else {
          this.takeFormSnapshot();
        }
      });

      await this.loadAttachments();
    },

    cancelForm() {
      this.attachments = [];
      this.view = "list";
    },

    // ─────────────────────────────────────────────────────────────────────
    // Save
    // ─────────────────────────────────────────────────────────────────────
    async saveDonation() {
      this.formErrors = {};
      this.saveError = "";

      if (!this.form.donorId) {
        this.formErrors.donorId = "Select a donor.";
        this.saveError = "Please fix the errors above before saving.";
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
      if (!result.ok) {
        this.formErrors = result.errors;
        this.saveError = "Please fix the errors above before saving.";
        return;
      }

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
          this.$nextTick(() => this.takeFormSnapshot());
        } else {
          this.view = "list";
        }
      } catch (err) {
        const msg = err?.message || String(err);
        this.saveError = `Save failed: ${msg}`;
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

    // ─────────────────────────────────────────────────────────────────────
    // Attachments
    // ─────────────────────────────────────────────────────────────────────
    async loadAttachments() {
      if (!this.editingId) return;
      this.attachmentsLoading = true;
      try {
        const folder = storageRef(storage, `companies/${getActiveCompanyId()}/donations/${this.editingId}`);
        const list = await listAll(folder);
        const items = await Promise.all(list.items.map(async (item) => {
          const [url, meta] = await Promise.all([getDownloadURL(item), getMetadata(item)]);
          return { name: item.name, url, path: item.fullPath, size: meta.size, contentType: meta.contentType };
        }));
        this.attachments = items;
      } catch (_) {
        this.attachments = [];
      } finally {
        this.attachmentsLoading = false;
      }
    },

    handleFiles(fileList) {
      for (const file of fileList) this.uploadFile(file);
    },

    async uploadFile(file) {
      if (!file || !this.editingId) return;
      this.uploading = true;
      try {
        const fileRef = storageRef(storage, `companies/${getActiveCompanyId()}/donations/${this.editingId}/${file.name}`);
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(fileRef, file, { contentType: file.type });
          task.on("state_changed",
            (snap) => { this.uploadProgress = Math.round((snap.bytesTransferred / snap.totalBytes) * 100); },
            reject,
            resolve,
          );
        });
        await this.loadAttachments();
      } catch (err) {
        this.saveError = `Upload failed: ${err?.message || "unknown error"}`;
      } finally {
        this.uploading = false;
        this.uploadProgress = 0;
      }
    },

    onFileInput(event) {
      const files = Array.from(event.target.files || []);
      if (files.length) this.handleFiles(files);
      event.target.value = "";
    },

    onPaste(event) {
      if (this.formMode !== "edit") return;
      const items = Array.from(event.clipboardData?.items || []);
      const files = items.filter((i) => i.kind === "file").map((i) => i.getAsFile()).filter(Boolean);
      if (files.length) { event.preventDefault(); this.handleFiles(files); }
    },

    async deleteAttachment(item) {
      if (!confirm(`Delete "${item.name}"?`)) return;
      try {
        await deleteObject(storageRef(storage, item.path));
        this.attachments = this.attachments.filter((a) => a.path !== item.path);
      } catch (err) {
        this.saveError = `Delete failed: ${err?.message || "unknown error"}`;
      }
    },

    formatFileSize(bytes) {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    },

    isImage(contentType) {
      return contentType?.startsWith("image/") ?? false;
    },

    // ─────────────────────────────────────────────────────────────────────
    // Dirty tracking + ESC-to-close with save/discard prompt
    // ─────────────────────────────────────────────────────────────────────
    takeFormSnapshot() {
      this.formSnapshot = JSON.stringify(this.form);
    },

    isFormDirty() {
      return JSON.stringify(this.form) !== this.formSnapshot;
    },

    onEscape() {
      if (this.view !== "form") return;
      // Close any open subordinate UI first.
      if (this.confirmCloseOpen) { this.confirmCloseOpen = false; return; }
      if (this.showDonorDropdown) { this.showDonorDropdown = false; return; }
      if (this.showNewDonorPanel) { this.showNewDonorPanel = false; return; }
      if (this.isFormDirty()) {
        this.confirmCloseOpen = true;
      } else {
        this.cancelForm();
      }
    },

    async confirmCloseAction(action) {
      this.confirmCloseOpen = false;
      if (action === "save") {
        await this.saveDonation();
      } else if (action === "discard") {
        this.cancelForm();
      }
    },
  }));
});
