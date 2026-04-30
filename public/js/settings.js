// Organization settings Alpine component.
// Stores legal name, CRA charity number, mailing address, authorized signatory,
// and optional receipt template text under companies/{id}/settings/org.

import { companyDoc, companyReady } from "./company.js";
import { validateOrganizationSettings } from "./schemas/index.js";
import {
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function emptyForm() {
  return {
    legalName:    "",
    charityNumber: "",
    address: {
      line1: "", line2: "", city: "", province: "", postalCode: "", country: "Canada",
    },
    signatory: { name: "", title: "" },
    signatureUrl: "",
    receiptTemplate: {
      headerText: "Official Donation Receipt for Income Tax Purposes",
      bodyText:   "This is an official receipt for the purpose of the Income Tax Act. No goods or services were provided in exchange for this donation.",
      footerText: "",
    },
  };
}

document.addEventListener("alpine:init", () => {
  Alpine.data("settings", () => ({
    loading: true,
    saving:  false,
    saved:   false,
    saveError: "",
    formErrors: {},
    form: emptyForm(),

    async init() {
      await companyReady;
      await this.loadSettings();
      window.addEventListener("krk:companyChanged", async () => {
        this.loading = true;
        this.form = emptyForm();
        this.formErrors = {};
        this.saved = false;
        this.saveError = "";
        await this.loadSettings();
      });
    },

    async loadSettings() {
      this.loading = true;
      try {
        const snap = await getDoc(companyDoc("settings", "org"));
        if (snap.exists()) {
          const d = snap.data();
          this.form = {
            legalName:     d.legalName     || "",
            charityNumber: d.charityNumber || "",
            address: {
              line1:      d.address?.line1      || "",
              line2:      d.address?.line2      || "",
              city:       d.address?.city       || "",
              province:   d.address?.province   || "",
              postalCode: d.address?.postalCode || "",
              country:    d.address?.country    || "Canada",
            },
            signatory: {
              name:  d.signatory?.name  || "",
              title: d.signatory?.title || "",
            },
            signatureUrl: d.signatureUrl || "",
            receiptTemplate: {
              headerText: d.receiptTemplate?.headerText ?? "Official Donation Receipt for Income Tax Purposes",
              bodyText:   d.receiptTemplate?.bodyText   ?? "This is an official receipt for the purpose of the Income Tax Act. No goods or services were provided in exchange for this donation.",
              footerText: d.receiptTemplate?.footerText || "",
            },
          };
        }
      } finally {
        this.loading = false;
      }
    },

    async saveSettings() {
      this.formErrors = {};
      this.saveError  = "";
      this.saved      = false;

      const result = validateOrganizationSettings(this.form);
      if (!result.ok) {
        this.formErrors = result.errors;
        this.saveError  = "Please fix the errors above before saving.";
        return;
      }

      this.saving = true;
      try {
        await setDoc(
          companyDoc("settings", "org"),
          { ...result.value, updatedAt: serverTimestamp() },
          { merge: true }
        );
        this.saved = true;
        setTimeout(() => { this.saved = false; }, 3000);
      } catch (err) {
        this.saveError = `Save failed: ${err?.message || String(err)}`;
      } finally {
        this.saving = false;
      }
    },
    readSignatureFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const MAX_W = 600;
            const MAX_H = 200;
            let { width, height } = img;
            if (width > MAX_W || height > MAX_H) {
              const ratio = Math.min(MAX_W / width, MAX_H / height);
              width  = Math.round(width  * ratio);
              height = Math.round(height * ratio);
            }
            const canvas = document.createElement("canvas");
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    async onSignatureFileChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      this.saveError = "";
      try {
        this.form.signatureUrl = await this.readSignatureFile(file);
      } catch (_) {
        this.saveError = "Could not read the image. Please try a different file.";
      }
    },

    clearSignature() {
      this.form.signatureUrl = "";
    },
  }));
});
