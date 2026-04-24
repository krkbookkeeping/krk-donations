// Categories Alpine component.
// Handles: list, create/edit form, archive/restore, seed defaults.
// Validates that a category's receiptable flag cannot change if any locked
// donation (one attached to an issued receipt) already references it.

import { companyCollection, companyDoc, companyReady } from "./company.js";
import { db } from "./firebase.js";
import { validateCategory } from "./schemas/index.js";
import {
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const DEFAULTS = [
  { name: "General Donation",  receiptable: true  },
  { name: "Event Ticket",      receiptable: false },
  { name: "Silent Auction",    receiptable: false },
  { name: "Memorial",          receiptable: true  },
];

function emptyForm() {
  return { name: "", receiptable: false };
}

document.addEventListener("alpine:init", () => {
  Alpine.data("categories", () => ({
    // ── View ──────────────────────────────────────────────────────────────
    view: "list",          // "list" | "form"

    // ── List ──────────────────────────────────────────────────────────────
    categories: [],
    loading: false,

    // ── Form ──────────────────────────────────────────────────────────────
    formMode: "create",    // "create" | "edit"
    selected: null,
    form: emptyForm(),
    formErrors: {},
    saving: false,

    // ── In-use check ──────────────────────────────────────────────────────
    inUseCount: 0,
    lockedUseCount: 0,
    checkingUse: false,

    // ─────────────────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────────────────
    async init() {
      await companyReady;
      await this.loadCategories();
      window.addEventListener("krk:companyChanged", async () => {
        this.view = "list";
        await this.loadCategories();
      });
    },

    // ─────────────────────────────────────────────────────────────────────
    // List
    // ─────────────────────────────────────────────────────────────────────
    async loadCategories() {
      this.loading = true;
      try {
        const snap = await getDocs(
          query(companyCollection("categories"), orderBy("name"))
        );
        this.categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (this.categories.length === 0) {
          await this.seedDefaults();
        }
      } finally {
        this.loading = false;
      }
    },

    async seedDefaults() {
      const batch = writeBatch(db);
      const colRef = companyCollection("categories");
      for (const def of DEFAULTS) {
        batch.set(doc(colRef), {
          ...def,
          status: "active",
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
      const snap = await getDocs(
        query(companyCollection("categories"), orderBy("name"))
      );
      this.categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    // ─────────────────────────────────────────────────────────────────────
    // Form
    // ─────────────────────────────────────────────────────────────────────
    startCreate() {
      this.formMode = "create";
      this.selected = null;
      this.form = emptyForm();
      this.formErrors = {};
      this.inUseCount = 0;
      this.lockedUseCount = 0;
      this.view = "form";
    },

    async startEdit(cat) {
      this.formMode = "edit";
      this.selected = cat;
      this.form = { name: cat.name, receiptable: cat.receiptable };
      this.formErrors = {};
      this.inUseCount = 0;
      this.lockedUseCount = 0;
      this.view = "form";
      // Fetch usage counts in background after showing the form.
      this.checkingUse = true;
      try {
        const snap = await getDocs(query(
          companyCollection("donations"),
          where("categoryIds", "array-contains", cat.id)
        ));
        this.inUseCount = snap.size;
        this.lockedUseCount = snap.docs.filter((d) => d.data().locked === true).length;
      } finally {
        this.checkingUse = false;
      }
    },

    cancelForm() {
      this.view = "list";
    },

    async saveCategory() {
      this.formErrors = {};
      const input = {
        name: this.form.name,
        receiptable: this.form.receiptable,
        status: this.formMode === "edit" ? (this.selected.status ?? "active") : "active",
      };
      const result = validateCategory(input);
      if (!result.ok) { this.formErrors = result.errors; return; }

      // Block receiptable-flag change when locked donations reference this category.
      if (
        this.formMode === "edit" &&
        result.value.receiptable !== this.selected.receiptable &&
        this.lockedUseCount > 0
      ) {
        this.formErrors.receiptable =
          `Cannot change: this category is referenced by ${this.lockedUseCount} issued receipt(s).`;
        return;
      }

      this.saving = true;
      try {
        if (this.formMode === "create") {
          await addDoc(companyCollection("categories"), {
            ...result.value,
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(companyDoc("categories", this.selected.id), {
            name: result.value.name,
            receiptable: result.value.receiptable,
            updatedAt: serverTimestamp(),
          });
        }
        await this.loadCategories();
        this.view = "list";
      } finally {
        this.saving = false;
      }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Archive / restore
    // ─────────────────────────────────────────────────────────────────────
    async archiveCategory(cat) {
      await updateDoc(companyDoc("categories", cat.id), {
        status: "archived",
        updatedAt: serverTimestamp(),
      });
      await this.loadCategories();
    },

    async unarchiveCategory(cat) {
      await updateDoc(companyDoc("categories", cat.id), {
        status: "active",
        updatedAt: serverTimestamp(),
      });
      await this.loadCategories();
    },
  }));
});
