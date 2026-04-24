// Shared TypeScript types for all entities. These match the Firestore schema
// documented in docs/decisions/0002-data-model.md.

export interface Address {
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface Signatory {
  name: string;
  title: string;
}

// Global collections --------------------------------------------------------

export interface User {
  email: string;
  displayName: string | null;
  role: "admin";
  companyIds: string[];
  activeCompanyId: string | null;
}

export interface Company {
  name: string;
  ownerUid: string;
}

// Company-scoped collections -----------------------------------------------
// Each of the following lives under companies/{companyId}/… in Firestore.
// The shape at the field level is unchanged from the pre-multi-company
// design — only the path changed.

export interface Donor {
  firstName: string;
  lastName: string;
  orgName: string;
  email: string;
  phone: string;
  address: Address | null;
  preferredContact: "email" | "phone" | "mail" | "any";
  notes: string;
  status: "active" | "archived";
  searchTokens: string[];
  mergedIntoId?: string;
}

export interface Category {
  name: string;
  receiptable: boolean;
  status: "active" | "archived";
}

export interface PaymentMethod {
  name: string;
  status: "active" | "archived";
}

export interface Allocation {
  categoryId: string;
  amountCents: number;
  receiptable: boolean;
}

export interface Donation {
  donorId: string;
  date: string;
  totalAmountCents: number;
  paymentMethodId: string;
  referenceNumber: string;
  notes: string;
  locked: boolean;
  receiptId?: string;
  categoryIds: string[];
  hasReceiptable: boolean;
}

export interface OrganizationSettings {
  legalName: string;
  charityNumber: string;
  address: Address;
  signatory: Signatory;
  logoUrl: string | null;
  signatureUrl: string | null;
  receiptTemplate: {
    headerText: string;
    bodyText: string;
    footerText: string;
  };
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, unknown> };
