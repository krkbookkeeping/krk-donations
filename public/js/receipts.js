// Receipts Alpine component.
// Pending tab: donors with unlocked receiptable donations → Generate Receipt button.
// Issued tab:  receipts for the selected year → Download PDF / Void.
//
// PDF generation uses jsPDF loaded via CDN (window.jspdf.jsPDF).
// Receipt generation and voiding are handled by Cloud Functions.

import { companyCollection, companyDoc, companyReady, getActiveCompanyId } from "./company.js";
import { functions } from "./firebase.js";
import { formatCents } from "./money.js";
import {
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

// ─────────────────────────────────────────────────────────────────────────────
// PDF builder
// ─────────────────────────────────────────────────────────────────────────────
function buildReceiptPDF(receipt) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const PW     = 215.9;
  const MARGIN = 20;
  const CW     = PW - MARGIN * 2;
  let y = 20;

  const org = receipt.org || {};

  // ── Org header ────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(org.legalName || "", MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const addr = org.address;
  if (addr) {
    if (addr.line1) { doc.text(addr.line1, MARGIN, y); y += 4.5; }
    if (addr.line2) { doc.text(addr.line2, MARGIN, y); y += 4.5; }
    const cityLine = [addr.city, addr.province, addr.postalCode].filter(Boolean).join(", ");
    if (cityLine) { doc.text(cityLine, MARGIN, y); y += 4.5; }
  }
  y += 4;

  // ── Title ────────────────────────────────────────────────────────────────
  doc.setDrawColor(80);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const titleText = org.receiptTemplate?.headerText || "Official Donation Receipt for Income Tax Purposes";
  const splitTitle = doc.splitTextToSize(titleText.toUpperCase(), CW);
  doc.text(splitTitle, PW / 2, y, { align: "center" });
  y += splitTitle.length * 5.5 + 2;

  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 7;

  // ── Receipt metadata (two columns) ───────────────────────────────────────
  doc.setFontSize(9);
  const COL_R = PW / 2 + 5;

  const VAL_L = MARGIN + 52;  // left-column value x — aligned to longest label
  const VAL_R = COL_R + 27;  // right-column value x — aligned to "Date Issued:"

  doc.setFont("helvetica", "bold");   doc.text("Receipt Number:", MARGIN, y);
  doc.setFont("helvetica", "normal"); doc.text(receipt.receiptNumber || "", VAL_L, y);
  doc.setFont("helvetica", "bold");   doc.text("Date Issued:", COL_R, y);
  doc.setFont("helvetica", "normal");
  const issuedDate = receipt.issuedAt
    ? new Date(receipt.issuedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
    : "";
  doc.text(issuedDate, VAL_R, y);
  y += 5.5;

  doc.setFont("helvetica", "bold");   doc.text("Charity Registration #:", MARGIN, y);
  doc.setFont("helvetica", "normal"); doc.text(org.charityNumber || "", VAL_L, y);
  doc.setFont("helvetica", "bold");   doc.text("Year:", COL_R, y);
  doc.setFont("helvetica", "normal"); doc.text(String(receipt.year || ""), VAL_R, y);
  y += 8;

  doc.setDrawColor(180);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 7;

  // ── Donor information ────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.text("DONOR INFORMATION:", MARGIN, y);
  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.text(receipt.donorName || "", MARGIN, y);
  y += 4.5;
  const da = receipt.donorAddress;
  if (da) {
    if (da.line1) { doc.text(da.line1, MARGIN, y); y += 4.5; }
    if (da.line2) { doc.text(da.line2, MARGIN, y); y += 4.5; }
    const dl = [da.city, da.province, da.postalCode].filter(Boolean).join(", ");
    if (dl) { doc.text(dl, MARGIN, y); y += 4.5; }
  }
  y += 4;

  doc.setDrawColor(180);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 7;

  // ── Donation summary ─────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DONATION SUMMARY:", MARGIN, y);
  y += 6;

  const COL_MID = PW / 2 + 5;
  doc.setFont("helvetica", "bold");   doc.text("Tax Year:", MARGIN, y);
  doc.setFont("helvetica", "normal"); doc.text(String(receipt.year || ""), MARGIN + 22, y);
  doc.setFont("helvetica", "bold");   doc.text("Location Issued:", COL_MID, y);
  doc.setFont("helvetica", "normal"); doc.text("Edmonton, Alberta", COL_MID + 38, y);
  y += 4;
  doc.setDrawColor(80);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 7;

  // ── Total ────────────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const totalStr = `$${((receipt.totalReceiptableAmountCents || 0) / 100).toFixed(2)}`;
  doc.text("TOTAL ELIGIBLE DONATION AMOUNT:", MARGIN, y);
  doc.text(totalStr, PW - MARGIN, y, { align: "right" });
  y += 10;

  // ── Body text ────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const bodyText = org.receiptTemplate?.bodyText ||
    "This is an official receipt for the purpose of the Income Tax Act. No goods or services were provided in exchange for this donation.";
  const splitBody = doc.splitTextToSize(bodyText, CW);
  doc.text(splitBody, MARGIN, y);
  y += splitBody.length * 4 + 8;

  // ── Signature ────────────────────────────────────────────────────────────
  if (org.signatureUrl) {
    try {
      const sigProps = doc.getImageProperties(org.signatureUrl);
      const sigH = 12;
      const sigW = Math.min((sigProps.width / sigProps.height) * sigH, 70);
      doc.addImage(org.signatureUrl, MARGIN, y, sigW, sigH);
      y += sigH + 2;
    } catch (_) {
      doc.setDrawColor(80);
      doc.line(MARGIN, y, MARGIN + 65, y);
      y += 5;
    }
  } else {
    doc.setDrawColor(80);
    doc.line(MARGIN, y, MARGIN + 65, y);
    y += 5;
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(org.signatory?.name || "", MARGIN, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.text(org.signatory?.title || "", MARGIN, y);

  // ── Footer — pinned to bottom of page ────────────────────────────────────
  if (org.receiptTemplate?.footerText) {
    const PAGE_H   = 279.4;
    const splitFooter = doc.splitTextToSize(org.receiptTemplate.footerText, CW);
    const footerY  = PAGE_H - MARGIN - (splitFooter.length - 1) * 4;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(splitFooter, MARGIN, footerY);
    doc.setTextColor(0);
  }

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Alpine component
// ─────────────────────────────────────────────────────────────────────────────
function currentYear() { return new Date().getFullYear(); }

document.addEventListener("alpine:init", () => {
  Alpine.data("receipts", () => ({
    // ── Settings readiness ────────────────────────────────────────────────
    settingsReady: false,

    // ── Year selector ─────────────────────────────────────────────────────
    filterYear: currentYear(),

    get yearOptions() {
      const yr = currentYear();
      return Array.from({ length: 7 }, (_, i) => yr - i);
    },

    // ── Tabs ─────────────────────────────────────────────────────────────
    activeTab: "pending",

    // ── Pending tab ───────────────────────────────────────────────────────
    pendingLoading: false,
    pendingDonors:  [],

    // ── Issued tab ────────────────────────────────────────────────────────
    receiptsLoading: false,
    issuedReceipts:  [],

    // ── Per-row generating state ──────────────────────────────────────────
    generating: {},

    // ── Messages ─────────────────────────────────────────────────────────
    successMessage: "",
    errorMessage:   "",

    // ─────────────────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────────────────
    async init() {
      await companyReady;
      await this.checkSettings();
      if (this.settingsReady) await this.loadData();
      window.addEventListener("krk:companyChanged", async () => {
        this.settingsReady = false;
        this.pendingDonors = [];
        this.issuedReceipts = [];
        await this.checkSettings();
        if (this.settingsReady) await this.loadData();
      });
    },

    async checkSettings() {
      try {
        const snap = await getDoc(companyDoc("settings", "org"));
        this.settingsReady = snap.exists() && !!snap.data()?.legalName && !!snap.data()?.charityNumber;
      } catch (_) {
        this.settingsReady = false;
      }
    },

    async loadData() {
      await Promise.all([this.loadPendingDonors(), this.loadIssuedReceipts()]);
    },

    // ─────────────────────────────────────────────────────────────────────
    // Pending donors
    // ─────────────────────────────────────────────────────────────────────
    async loadPendingDonors() {
      this.pendingLoading = true;
      try {
        const from = `${this.filterYear}-01-01`;
        const to   = `${this.filterYear}-12-31`;

        const snap = await getDocs(query(
          companyCollection("donations"),
          where("status", "==", "active"),
          where("date", ">=", from),
          where("date", "<=", to),
          orderBy("date", "desc"),
        ));

        const byDonor = {};
        for (const d of snap.docs) {
          const x = d.data();
          if (!x.hasReceiptable || x.locked) continue;
          const key = x.donorId;
          if (!byDonor[key]) {
            byDonor[key] = {
              donorId:              key,
              donorName:            x.donorName || "(unknown)",
              totalReceiptableCents: 0,
              count:                0,
            };
          }
          byDonor[key].totalReceiptableCents += x.receiptableAmountCents || 0;
          byDonor[key].count++;
        }

        this.pendingDonors = Object.values(byDonor)
          .sort((a, b) => a.donorName.localeCompare(b.donorName));
      } finally {
        this.pendingLoading = false;
      }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Issued receipts
    // ─────────────────────────────────────────────────────────────────────
    async loadIssuedReceipts() {
      this.receiptsLoading = true;
      try {
        const snap = await getDocs(query(
          companyCollection("receipts"),
          where("year", "==", this.filterYear),
        ));
        this.issuedReceipts = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.issuedAt?.seconds ?? 0;
            const tb = b.issuedAt?.seconds ?? 0;
            return tb - ta;  // newest first
          });
      } finally {
        this.receiptsLoading = false;
      }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Generate receipt
    // ─────────────────────────────────────────────────────────────────────
    async generateReceipt(donorId) {
      this.errorMessage   = "";
      this.successMessage = "";
      this.generating = { ...this.generating, [donorId]: true };
      try {
        const fn = httpsCallable(functions, "generateReceipt");
        const res = await fn({
          companyId: getActiveCompanyId(),
          donorId,
          year: this.filterYear,
        });
        const receipt = res.data;
        buildReceiptPDF(receipt).save(`receipt-${receipt.receiptNumber}.pdf`);
        this.successMessage = `Receipt ${receipt.receiptNumber} generated and downloaded.`;
        setTimeout(() => { this.successMessage = ""; }, 5000);
        await this.loadData();
      } catch (err) {
        this.errorMessage = err?.message || "Failed to generate receipt.";
      } finally {
        const { [donorId]: _removed, ...rest } = this.generating;
        this.generating = rest;
      }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Download existing receipt PDF
    // ─────────────────────────────────────────────────────────────────────
    downloadReceipt(receipt) {
      if (!window.jspdf) {
        this.errorMessage = "PDF library not loaded. Please refresh the page.";
        return;
      }
      buildReceiptPDF({
        ...receipt,
        org: receipt.orgSnapshot,
        issuedAt: receipt.issuedAt
          ? new Date(receipt.issuedAt.seconds * 1000).toISOString()
          : new Date().toISOString(),
      }).save(`receipt-${receipt.receiptNumber}.pdf`);
    },

    // ─────────────────────────────────────────────────────────────────────
    // Void receipt
    // ─────────────────────────────────────────────────────────────────────
    async voidReceipt(receipt) {
      if (!confirm(`Void receipt ${receipt.receiptNumber}? This will unlock the associated donations so they can be re-receipted.`)) return;
      this.errorMessage = "";
      try {
        const fn = httpsCallable(functions, "voidReceipt");
        await fn({ companyId: getActiveCompanyId(), receiptId: receipt.id });
        this.successMessage = `Receipt ${receipt.receiptNumber} has been voided.`;
        setTimeout(() => { this.successMessage = ""; }, 5000);
        await this.loadData();
      } catch (err) {
        this.errorMessage = err?.message || "Failed to void receipt.";
      }
    },

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────
    formatCents(c) { return formatCents(c); },

    formatDate(ts) {
      if (!ts) return "";
      const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
    },
  }));
});
