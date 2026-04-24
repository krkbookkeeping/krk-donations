// Payment Methods Alpine component.
// Handles: list, create/edit form, archive/restore, seed defaults.

import { companyCollection, companyDoc, companyReady } from "./company.js";
import { db } from "./firebase.js";
import { validatePaymentMethod } from "./schemas/index.js";
import {
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const DEFAULTS = [
  "Cash",
  "Cheque",
  "E-transfer",
  "Debit",
  "Credit Card",
  "Square",
  "Online",
];

function emptyForm() {
  return { name: "" };
}

document.addEventListener("alpine:init", () => {
  Alpine.data("paymentMethods", () => ({
    // ── View ──────────────────────────────────────────────────────────────
    view: "list",

    // ── List ──────────────────────────────────────────────────────────────
    items: [],
    loading: false,

    // ── Form ──────────────────────────────────────────────────────────────
    formMode: "create",
    selected: null,
    form: emptyForm(),
    formErrors: {},
    saving: false,

    // ─────────────────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────────────────
    async init() {
      await companyReady;
      await this.loadItems();
      window.addEventListener("krk:companyChanged", async () => {
        this.view = "list";
        await this.loadItems();
      });
    },

    // ─────────────────────────────────────────────────────────────────────
    // List
    // ─────────────────────────────────────────────────────────────────────
    async loadItems() {
      this.loading = true;
      try {
        const snap = await getDocs(
          query(companyCollection("paymentMethods"), orderBy("name"))
        );
        this.items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (this.items.length === 0) {
          await this.seedDefaults();
        }
      } finally {
        this.loading = false;
      }
    },

    async seedDefaults() {
      const batch = writeBatch(db);
      const colRef = companyCollection("paymentMethods");
      for (const name of DEFAULTS) {
        batch.set(doc(colRef), {
          name,
          status: "active",
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
      const snap = await getDocs(
        query(companyCollection("paymentMethods"), orderBy("name"))
      );
      this.items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },

    // ─────────────────────────────────────────────────────────────────────
    // Form
    // ─────────────────────────────────────────────────────────────────────
    startCreate() {
      this.formMode = "create";
      this.selected = null;
      this.form = emptyForm();
      this.formErrors = {};
      this.view = "form";
    },

    startEdit(item) {
      this.formMode = "edit";
      this.selected = item;
      this.form = { name: item.name };
      this.formErrors = {};
      this.view = "form";
    },

    cancelForm() {
      this.view = "list";
    },

    async saveItem() {
      this.formErrors = {};
      const input = {
        name: this.form.name,
        status: this.formMode === "edit" ? (this.selected.status ?? "active") : "active",
      };
      const result = validatePaymentMethod(input);
      if (!result.ok) { this.formErrors = result.errors; return; }

      this.saving = true;
      try {
        if (this.formMode === "create") {
          await addDoc(companyCollection("paymentMethods"), {
            ...result.value,
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(companyDoc("paymentMethods", this.selected.id), {
            name: result.value.name,
            updatedAt: serverTimestamp(),
          });
        }
        await this.loadItems();
        this.view = "list";
      } finally {
        this.saving = false;
      }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Archive / restore
    // ─────────────────────────────────────────────────────────────────────
    async archiveItem(item) {
      await updateDoc(companyDoc("paymentMethods", item.id), {
        status: "archived",
        updatedAt: serverTimestamp(),
      });
      await this.loadItems();
    },

    async unarchiveItem(item) {
      await updateDoc(companyDoc("paymentMethods", item.id), {
        status: "active",
        updatedAt: serverTimestamp(),
      });
      await this.loadItems();
    },
  }));
});
