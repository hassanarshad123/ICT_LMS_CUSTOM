import { apiClient } from './client';

export type UpgradeTier = 'starter' | 'basic' | 'pro' | 'enterprise';
export type UpgradeBillingCycle = 'monthly' | 'yearly';
export type UpgradePaymentMethod = 'bank_transfer' | 'jazzcash' | 'easypaisa';

export interface MyInstituteResponse {
  id: string;
  name: string;
  slug: string;
  status: string;
  planTier: 'free' | 'starter' | 'basic' | 'pro' | 'enterprise';
  maxStudents: number;
  currentStudents: number;
  maxStorageGb: number;
  maxVideoGb: number;
  expiresAt: string | null;
  isTrial: boolean;
  trialDaysRemaining: number | null;
  tierLabel: string;
  pricingTable: Record<UpgradeTier, { monthly: number; yearly: number }>;
}

export interface UpgradeRequestBody {
  targetTier: UpgradeTier;
  billingCycle: UpgradeBillingCycle;
  paymentMethod: UpgradePaymentMethod;
}

export interface PaymentInstruction {
  type?: string;
  label?: string;
  account_title?: string;
  account_number?: string;
  bank_name?: string;
  iban?: string;
  [key: string]: unknown;
}

export interface UpgradeResponse {
  invoiceId: string;
  invoiceNumber: string;
  referenceCode: string;
  amount: number;
  currency: string;
  targetTier: string;
  billingCycle: string;
  paymentMethod: string;
  paymentInstructions: PaymentInstruction[];
  paymentReferenceNote: string;
  enterprise: boolean;
  contactEmail: string | null;
}

/**
 * Fetch the current user's institute and plan state.
 * Used by the upgrade banner + modal.
 */
export async function getMyInstitute(): Promise<MyInstituteResponse> {
  return apiClient<MyInstituteResponse>('/upgrade/my-institute');
}

/**
 * Request an upgrade. Creates a draft invoice and returns payment details.
 * Admin then sends money externally; SA verifies and approves.
 */
export async function requestUpgrade(
  body: UpgradeRequestBody,
): Promise<UpgradeResponse> {
  return apiClient<UpgradeResponse>('/upgrade/request', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Static display metadata — mirrors backend PRICING_TABLE but enriched with
// descriptions + student counts for the modal UI.
// ---------------------------------------------------------------------------
export const TIER_DISPLAY: Record<
  UpgradeTier,
  {
    name: string;
    students: string;
    description: string;
    highlights: string[];
    monthly: number;
    yearly: number;
  }
> = {
  starter: {
    name: 'Starter',
    students: '50 students',
    description: 'For freelance tutors and small coaching centers.',
    highlights: [
      'Unlimited courses & batches',
      '3 GB storage, 15 GB video',
      'Zoom integration',
      'White-label branding',
    ],
    monthly: 2_500,
    yearly: 25_000,
  },
  basic: {
    name: 'Basic',
    students: '250 students',
    description: 'For growing academies with 100–250 students.',
    highlights: [
      'Everything in Starter',
      '10 GB storage, 75 GB video',
      'Priority email support',
      'Only Rs 20 per student',
    ],
    monthly: 5_000,
    yearly: 50_000,
  },
  pro: {
    name: 'Pro',
    students: '1,000 students',
    description: 'For established institutes that need AI + integrations.',
    highlights: [
      'Everything in Basic',
      '50 GB storage, 300 GB video',
      'AI quiz generation (coming 2026)',
      'API access + webhooks',
      'Only Rs 15 per student',
    ],
    monthly: 15_000,
    yearly: 150_000,
  },
  enterprise: {
    name: 'Enterprise',
    students: 'Unlimited students',
    description: 'For universities and multi-branch institutes.',
    highlights: [
      'Unlimited everything',
      'Custom domain',
      'SLA guarantee',
      'Dedicated support manager',
    ],
    monthly: 0,
    yearly: 0,
  },
};

export function formatPKR(amount: number): string {
  return `Rs ${amount.toLocaleString('en-PK')}`;
}
