// Reports Alpine component.
// Two report modes:
//   "transaction" — filterable donation list with per-row totals and CSV export.
//   "summary"     — yearly per-donor aggregation with CSV export.
//
// receiptableAmountCents is stored on donation docs from Phase 6 onward.
// Donations saved earlier will show $0 receiptable in reports.

import { companyCollection, companyReady } from "./company.js";
import { donorQueryTokens } from "./schemas/index.js";
import { formatCents } from "./money.js";
import {
  query,
  where,
  orderBy,
  limit,
  getDocs,
  documentId,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function currentYear() {
  return new Date().getFullYear();
}

function csvDownload(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Fetch address data for a list of donorIds. Returns a map of donorId → address
// object (or null). Chunks into groups of 30 to stay within Firestore's `in` limit.
async function fetchDonorAddresses(collectionFn, donorIds) {
  const unique = [...new Set(donorIds.filter(Boolean))];
  const map = {};
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await getDocs(query(
      collectionFn("donors"),
      where(documentId(), "in", chunk),
    ));
    for (const d of snap.docs) {
      const data = d.data();
      map[d.id] = { address: data.address ?? null, email: data.email || "" };
    }
  }
  return map;
}

document.addEventListener("alpine:init", () => {
  Alpine.data("reports", () => ({
    // ── Report type ───────────────────────────────────────────────────────
    reportType: "transaction",   // "transaction" | "summary"

    // ── Lookup data ───────────────────────────────────────────────────────
    categories: [],
    paymentMethods: [],

    // ── Filters (shared) ──────────────────────────────────────────────────
    filterDateMode: "year",      // "year" | "custom"
    filterYear: currentYear(),
    filterDateFrom: "",
    filterDateTo: "",
    filterCategories: [],        // selected categoryIds; empty = "All"
    filterPaymentMethods: [],    // selected paymentMethodIds
    filterReceiptable: "yes",    // "all" | "yes" | "no" — defaults to receiptable-only
    filterDonorId: "",
    filterDonorName: "",
    filterDonorQuery: "",

    // ── Run state ─────────────────────────────────────────────────────────
    reportLoading: false,
    reportRun: false,
    transactionRows: [],
    summaryRows: [],

    // ── Sorting ───────────────────────────────────────────────────────────
    transactionSortBy: "date",   // "date" | "donor" | "total"
    transactionSortDir: "desc",  // "asc" | "desc"
    summarySortBy: "donor",      // "donor" | "total"
    summarySortDir: "asc",       // "asc" | "desc"

    // ── Print ─────────────────────────────────────────────────────────────
    showPrintModal: false,
    printColumns: {
      transaction: {
        date: true, donor: true, email: false, address: false,
        city: false, province: false, postalCode: false,
        total: true, categories: true, receiptable: true,
        payment: false, notes: false,
      },
      summary: {
        donor: true, email: false, address: false,
        city: false, province: false, postalCode: false,
        count: true, total: true, receiptable: true,
      },
    },

    // ── Donor search ──────────────────────────────────────────────────────
    donorResults: [],
    showDonorDropdown: false,
    donorDebounce: null,

    // ─────────────────────────────────────────────────────────────────────
    // Computed
    // ─────────────────────────────────────────────────────────────────────
    get yearOptions() {
      const yr = currentYear();
      return Array.from({ length: 7 }, (_, i) => yr - i);
    },

    get dateFrom() {
      return this.filterDateMode === "custom"
        ? this.filterDateFrom
        : `${this.filterYear}-01-01`;
    },

    get dateTo() {
      return this.filterDateMode === "custom"
        ? this.filterDateTo
        : `${this.filterYear}-12-31`;
    },

    get transactionTotal() {
      return this.transactionRows.reduce((s, r) => s + (r.totalAmountCents || 0), 0);
    },

    get transactionReceiptableTotal() {
      return this.transactionRows.reduce((s, r) => s + (r.receiptableAmountCents || 0), 0);
    },

    get summaryTotal() {
      return this.summaryRows.reduce((s, r) => s + r.totalCents, 0);
    },

    get summaryReceiptableTotal() {
      return this.summaryRows.reduce((s, r) => s + r.receiptableCents, 0);
    },

    get summaryDonationCount() {
      return this.summaryRows.reduce((s, r) => s + r.count, 0);
    },

    // ── Print-header labels ───────────────────────────────────────────────
    get printDateLabel() {
      if (this.filterDateMode === "year") return `Calendar year ${this.filterYear}`;
      const f = this.filterDateFrom || "—";
      const t = this.filterDateTo || "—";
      return `From ${f} to ${t}`;
    },

    get printCategoriesLabel() {
      if (this.filterCategories.length === 0) return "All categories";
      const names = this.filterCategories
        .map((id) => this.categories.find((c) => c.id === id)?.name)
        .filter(Boolean);
      return names.length ? names.join(", ") : "All categories";
    },

    get printPaymentMethodsLabel() {
      if (this.filterPaymentMethods.length === 0) return "All payment methods";
      const names = this.filterPaymentMethods
        .map((id) => this.paymentMethods.find((p) => p.id === id)?.name)
        .filter(Boolean);
      return names.length ? names.join(", ") : "All payment methods";
    },

    get printReceiptableLabel() {
      if (this.filterReceiptable === "yes") return "Receiptable only";
      if (this.filterReceiptable === "no") return "Non-receiptable only";
      return "All";
    },

    get printDonorLabel() {
      return this.filterDonorId ? this.filterDonorName : "All donors";
    },

    get printTransactionSortLabel() {
      const col = { date: "Date", donor: "Donor", total: "Total" }[this.transactionSortBy] || "Date";
      const dir = this.transactionSortDir === "asc" ? "ascending" : "descending";
      return `${col}, ${dir}`;
    },

    get printSummarySortLabel() {
      const col = { donor: "Donor", total: "Total" }[this.summarySortBy] || "Donor";
      const dir = this.summarySortDir === "asc" ? "ascending" : "descending";
      return `${col}, ${dir}`;
    },

    setTransactionSort(column) {
      if (this.transactionSortBy === column) {
        this.transactionSortDir = this.transactionSortDir === "asc" ? "desc" : "asc";
      } else {
        this.transactionSortBy = column;
        this.transactionSortDir = (column === "donor") ? "asc" : "desc";
      }
    },

    get sortedTransactionRows() {
      const dir = this.transactionSortDir === "asc" ? 1 : -1;
      const arr = [...this.transactionRows];
      arr.sort((a, b) => {
        let av, bv;
        switch (this.transactionSortBy) {
          case "donor":
            av = (a.donorName || "").toLowerCase();
            bv = (b.donorName || "").toLowerCase();
            return av.localeCompare(bv) * dir;
          case "total":
            return ((a.totalAmountCents || 0) - (b.totalAmountCents || 0)) * dir;
          case "date":
          default:
            av = a.date || "";
            bv = b.date || "";
            return av.localeCompare(bv) * dir;
        }
      });
      return arr;
    },

    setSummarySort(column) {
      if (this.summarySortBy === column) {
        this.summarySortDir = this.summarySortDir === "asc" ? "desc" : "asc";
      } else {
        this.summarySortBy = column;
        this.summarySortDir = (column === "donor") ? "asc" : "desc";
      }
    },

    get sortedSummaryRows() {
      const dir = this.summarySortDir === "asc" ? 1 : -1;
      const arr = [...this.summaryRows];
      arr.sort((a, b) => {
        if (this.summarySortBy === "total") {
          return ((a.totalCents || 0) - (b.totalCents || 0)) * dir;
        }
        const av = (a.donorName || "").toLowerCase();
        const bv = (b.donorName || "").toLowerCase();
        return av.localeCompare(bv) * dir;
      });
      return arr;
    },

    // ─────────────────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────────────────
    async init() {
      await companyReady;
      await this.loadLookups();
      window.addEventListener("krk:companyChanged", async () => {
        this.resetResults();
        await this.loadLookups();
      });
    },

    async loadLookups() {
      const [catSnap, pmSnap] = await Promise.all([
        getDocs(query(companyCollection("categories"), orderBy("name"))),
        getDocs(query(companyCollection("paymentMethods"), orderBy("name"))),
      ]);
      this.categories = catSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.status === "active");
      this.paymentMethods = pmSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.status === "active");
    },

    // ─────────────────────────────────────────────────────────────────────
    // Filter helpers
    // ─────────────────────────────────────────────────────────────────────
    switchReport(type) {
      this.reportType = type;
      this.resetResults();
    },

    resetResults() {
      this.reportRun = false;
      this.transactionRows = [];
      this.summaryRows = [];
    },

    reset() {
      this.resetResults();
      this.filterDateMode = "year";
      this.filterYear = currentYear();
      this.filterDateFrom = "";
      this.filterDateTo = "";
      this.filterCategories = [];
      this.filterPaymentMethods = [];
      this.filterReceiptable = "yes";
      this.filterDonorId = "";
      this.filterDonorName = "";
      this.filterDonorQuery = "";
    },

    selectAllCategories() {
      this.filterCategories = [];
    },

    categoryNamesForRow(categoryIds) {
      // No specific category filter → label the row "All".
      if (this.filterCategories.length === 0) return "All";
      if (!categoryIds || categoryIds.length === 0) return "—";
      return categoryIds
        .map((cid) => this.categories.find((c) => c.id === cid)?.name)
        .filter(Boolean)
        .join(", ");
    },

    // ─────────────────────────────────────────────────────────────────────
    // Run report
    // ─────────────────────────────────────────────────────────────────────
    async runReport() {
      if (this.reportType === "transaction") {
        await this.runTransactionReport();
      } else {
        await this.runSummaryReport();
      }
    },

    async runTransactionReport() {
      const from = this.dateFrom;
      const to   = this.dateTo;
      if (!from || !to) return;

      this.reportLoading = true;
      this.reportRun = false;
      try {
        const snap = await getDocs(query(
          companyCollection("donations"),
          where("status", "==", "active"),
          where("date", ">=", from),
          where("date", "<=", to),
          orderBy("date", "desc"),
        ));

        let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (this.filterCategories.length > 0) {
          rows = rows.filter((r) =>
            r.categoryIds?.some((cid) => this.filterCategories.includes(cid))
          );
        }
        if (this.filterPaymentMethods.length > 0) {
          rows = rows.filter((r) => this.filterPaymentMethods.includes(r.paymentMethodId));
        }
        if (this.filterReceiptable === "yes") {
          rows = rows.filter((r) => r.hasReceiptable === true);
        } else if (this.filterReceiptable === "no") {
          rows = rows.filter((r) => !r.hasReceiptable);
        }
        if (this.filterDonorId) {
          rows = rows.filter((r) => r.donorId === this.filterDonorId);
        }

        // Fetch donor addresses and attach to each row.
        const addrMap = await fetchDonorAddresses(
          companyCollection,
          rows.map((r) => r.donorId),
        );
        this.transactionRows = rows.map((r) => ({
          ...r,
          address: addrMap[r.donorId]?.address ?? null,
          donorEmail: addrMap[r.donorId]?.email ?? "",
        }));
        this.reportRun = true;
      } finally {
        this.reportLoading = false;
      }
    },

    async runSummaryReport() {
      const from = `${this.filterYear}-01-01`;
      const to   = `${this.filterYear}-12-31`;

      this.reportLoading = true;
      this.reportRun = false;
      try {
        const snap = await getDocs(query(
          companyCollection("donations"),
          where("status", "==", "active"),
          where("date", ">=", from),
          where("date", "<=", to),
          orderBy("date", "desc"),
        ));

        const byDonor = {};
        for (const d of snap.docs) {
          const data = d.data();
          const key  = data.donorId || "__unknown__";
          if (!byDonor[key]) {
            byDonor[key] = {
              donorId:         data.donorId || "",
              donorName:       data.donorName || "(unknown)",
              totalCents:      0,
              receiptableCents: 0,
              count:           0,
            };
          }
          byDonor[key].totalCents      += data.totalAmountCents || 0;
          byDonor[key].receiptableCents += data.receiptableAmountCents || 0;
          byDonor[key].count++;
        }

        // Fetch donor addresses and attach to each summary row.
        const addrMap = await fetchDonorAddresses(
          companyCollection,
          Object.keys(byDonor),
        );
        this.summaryRows = Object.values(byDonor)
          .map((r) => ({
            ...r,
            address: addrMap[r.donorId]?.address ?? null,
            donorEmail: addrMap[r.donorId]?.email ?? "",
          }));
        this.reportRun = true;
      } finally {
        this.reportLoading = false;
      }
    },

    // ─────────────────────────────────────────────────────────────────────
    // CSV export
    // ─────────────────────────────────────────────────────────────────────
    exportTransactionCSV() {
      const pmName = (id) => this.paymentMethods.find((p) => p.id === id)?.name ?? id;
      const label  = this.filterDateMode === "year"
        ? String(this.filterYear)
        : `${this.filterDateFrom}_${this.filterDateTo}`;

      const headers = ["Date", "Donor", "Email", "Address Line 1", "Address Line 2", "City", "Province", "Postal Code", "Total ($)", "Categories", "Receiptable ($)", "Payment Method", "Reference #", "Notes"];
      const rows = this.transactionRows.map((r) => [
        r.date,
        r.donorName || "",
        r.donorEmail || "",
        r.address?.line1 || "",
        r.address?.line2 || "",
        r.address?.city || "",
        r.address?.province || "",
        r.address?.postalCode || "",
        (r.totalAmountCents / 100).toFixed(2),
        this.categoryNamesForRow(r.categoryIds),
        ((r.receiptableAmountCents || 0) / 100).toFixed(2),
        pmName(r.paymentMethodId),
        r.referenceNumber || "",
        r.notes || "",
      ]);
      csvDownload(`transactions-${label}.csv`, headers, rows);
    },

    exportSummaryCSV() {
      const headers = ["Donor", "Email", "Address Line 1", "Address Line 2", "City", "Province", "Postal Code", "# Donations", "Total ($)", "Receiptable ($)"];
      const rows = this.summaryRows.map((r) => [
        r.donorName,
        r.donorEmail || "",
        r.address?.line1 || "",
        r.address?.line2 || "",
        r.address?.city || "",
        r.address?.province || "",
        r.address?.postalCode || "",
        r.count,
        (r.totalCents / 100).toFixed(2),
        (r.receiptableCents / 100).toFixed(2),
      ]);
      csvDownload(`yearly-summary-${this.filterYear}.csv`, headers, rows);
    },

    // ─────────────────────────────────────────────────────────────────────
    // Print
    // ─────────────────────────────────────────────────────────────────────
    openPrintModal() {
      this.showPrintModal = true;
    },

    closePrintModal() {
      this.showPrintModal = false;
    },

    triggerPrint() {
      this.showPrintModal = false;
      // Let Alpine apply the column-visibility classes before invoking print().
      this.$nextTick(() => window.print());
    },

    // ─────────────────────────────────────────────────────────────────────
    // Donor search (filter)
    // ─────────────────────────────────────────────────────────────────────
    onDonorInput() {
      const q = this.filterDonorQuery.trim();
      if (!q) {
        this.filterDonorId = "";
        this.filterDonorName = "";
        this.donorResults = [];
        this.showDonorDropdown = false;
        return;
      }
      clearTimeout(this.donorDebounce);
      this.donorDebounce = setTimeout(() => this.searchDonors(q), 250);
    },

    async searchDonors(q) {
      const tokens = donorQueryTokens(q);
      if (!tokens.length) { this.donorResults = []; return; }
      const snap = await getDocs(query(
        companyCollection("donors"),
        where("searchTokens", "array-contains-any", tokens),
        limit(10),
      ));
      this.donorResults = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.status !== "archived")
        .slice(0, 8);
      this.showDonorDropdown = this.donorResults.length > 0;
    },

    donorFullName(d) {
      return d.orgName || [d.firstName, d.lastName].filter(Boolean).join(" ");
    },

    selectDonor(d) {
      this.filterDonorId   = d.id;
      this.filterDonorName = this.donorFullName(d);
      this.filterDonorQuery = this.donorFullName(d);
      this.donorResults    = [];
      this.showDonorDropdown = false;
    },

    clearDonor() {
      this.filterDonorId    = "";
      this.filterDonorName  = "";
      this.filterDonorQuery = "";
    },

    // ─────────────────────────────────────────────────────────────────────
    // Display helpers
    // ─────────────────────────────────────────────────────────────────────
    paymentMethodName(id) {
      return this.paymentMethods.find((p) => p.id === id)?.name ?? "—";
    },

    formatCents(c) { return formatCents(c); },
  }));
});
