/**
 * Admin-facing billing API (pricing v2).
 *
 * Backend router: backend/app/routers/billing.py — mounted at /api/v1/billing.
 * Tier-gated server-side: grandfathered tiers (pro / free / starter / basic /
 * enterprise) get 403 from every endpoint here, so the billing page must
 * gate its rendering on `planTier ∈ {professional, custom}` too.
 */
import { apiClient } from './client';

// Re-export the existing InvoiceItem + PaymentItem shapes from super-admin.ts
// so the admin billing UI stays in sync with SA billing UI without dupe types.
export type { InvoiceItem, PaymentItem } from './super-admin';
import type { InvoiceItem, PaymentItem } from './super-admin';

export interface InvoiceLineItem {
  code: string;
  label: string;
  qty: number;
  unitPkr: number;
  amount: number;
}

export interface BillingPreview {
  snapshotStudentCount: number;
  overageStudentCount: number;
  studentOveragePkr: number;
  addonTotalPkr: number;
  baseFeePkr: number;
  totalPkr: number;
  lineItems: InvoiceLineItem[];
}

export interface Addon {
  id: string;
  addonType: string;
  quantity: number;
  unitPricePkr: number;
  storageBonusGb: number;
  storageBonusKind: 'docs' | 'video';
  activatedAt: string;
  cancelledAt?: string | null;
  cancelledEffectiveAt?: string | null;
  monthlyTotalPkr: number;
}

export interface AddonPack {
  addonType: string;
  pricePkr: number;
  bonusGb: number;
  kind: 'docs' | 'video';
}

export interface BillingOverview {
  planTier: 'professional' | 'custom';
  status: string;
  currentUsers: number;
  currentStorageBytes: number;
  currentVideoBytes: number;
  storageLimitGb: number;
  videoLimitGb: number;
  freeUsersIncluded: number;
  extraUserRatePkr: number;
  currency: string;
  billingCycle: string;
  billingRestriction: 'add_blocked' | 'read_only' | null;
  activeAddons: Addon[];
  nextInvoicePreview: BillingPreview;
  availableAddonPacks: AddonPack[];
}

export interface PaginatedInvoices {
  data: InvoiceItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface PaginatedPayments {
  data: PaymentItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ── Endpoints ──────────────────────────────────────────────────

export async function getBillingOverview(): Promise<BillingOverview> {
  return apiClient<BillingOverview>('/billing/overview');
}

export async function listInvoices(params?: {
  page?: number;
  per_page?: number;
  status?: string;
}): Promise<PaginatedInvoices> {
  return apiClient<PaginatedInvoices>('/billing/invoices', {
    params: params as Record<string, string | number | undefined>,
  });
}

export async function getInvoice(invoiceId: string): Promise<InvoiceItem> {
  return apiClient<InvoiceItem>(`/billing/invoices/${invoiceId}`);
}

/**
 * Fetch the invoice PDF as a Blob and trigger a browser download.
 *
 * Returns the Blob so tests / alternative callers can handle it as needed.
 * The apiClient case-conversion logic skips binary responses automatically.
 */
export async function downloadInvoicePDF(
  invoiceId: string,
  filenameHint?: string,
): Promise<void> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null;
  if (!token) {
    throw new Error('Not authenticated');
  }

  // Use raw fetch — apiClient expects JSON; PDFs are binary streams.
  const res = await fetch(`/api/v1/billing/invoices/${invoiceId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    // Try to read JSON error detail; if that fails fall through to generic.
    try {
      const body = await res.json();
      throw new Error(body?.detail?.message || body?.detail || 'Failed to download invoice');
    } catch {
      throw new Error('Failed to download invoice');
    }
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameHint || `invoice-${invoiceId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function listPayments(params?: {
  page?: number;
  per_page?: number;
}): Promise<PaginatedPayments> {
  return apiClient<PaginatedPayments>('/billing/payments', {
    params: params as Record<string, string | number | undefined>,
  });
}

export async function listAddons(): Promise<Addon[]> {
  return apiClient<Addon[]>('/billing/addons');
}

export async function activateAddon(
  addonType: string,
  quantity: number = 1,
): Promise<Addon> {
  return apiClient<Addon>('/billing/addons', {
    method: 'POST',
    body: JSON.stringify({ addonType, quantity }),
  });
}

export async function cancelAddon(addonId: string): Promise<Addon> {
  return apiClient<Addon>(`/billing/addons/${addonId}`, {
    method: 'DELETE',
  });
}
