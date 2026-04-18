'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Loader2,
  Sparkles,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { PageLoading, PageError } from '@/components/shared/page-states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useApi, useMutation } from '@/hooks/use-api';
import {
  activateAddon,
  cancelAddon,
  downloadInvoicePDF,
  getBillingOverview,
  listAddons,
  listInvoices,
  listPayments,
  type Addon,
  type AddonPack,
  type BillingOverview,
} from '@/lib/api/billing';
import type { InvoiceItem, PaymentItem } from '@/lib/api/super-admin';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format';

// ── Utility ──────────────────────────────────────────────────────

function formatBytesGB(bytes: number): string {
  const gb = bytes / (1024 ** 3);
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  return `${gb.toFixed(2)} GB`;
}

const ADDON_LABELS: Record<string, string> = {
  docs_10gb: '+10 GB Documents',
  video_50gb: '+50 GB Video',
  video_100gb: '+100 GB Video',
  video_500gb: '+500 GB Video',
};

function addonLabel(type: string): string {
  return ADDON_LABELS[type] || type;
}

// ── Main Page ────────────────────────────────────────────────────

export default function AdminBilling() {
  const { data, loading, error, refetch } = useApi<BillingOverview>(
    () => getBillingOverview(),
    [],
  );

  return (
    <DashboardLayout>
      <DashboardHeader
        greeting="Billing"
        subtitle="Your plan, usage, invoices, and storage add-ons"
      />

      {loading && <PageLoading variant="detail" />}

      {/* Tier-gate: 403 from the backend → friendly card for grandfathered/trial. */}
      {error && isTierGate403(error) && <TierNotSupportedCard />}
      {error && !isTierGate403(error) && <PageError message={error} onRetry={refetch} />}

      {!loading && !error && data && (
        <BillingContent data={data} onRefresh={refetch} />
      )}
    </DashboardLayout>
  );
}

/**
 * The backend returns 403 with detail.code = "billing_not_available" for
 * grandfathered / trial tiers. Because useApi surfaces only the message,
 * we match on that literal message substring to decide which card to show.
 */
function isTierGate403(errorMessage: string): boolean {
  return /not available/i.test(errorMessage) || /Professional/i.test(errorMessage);
}

function TierNotSupportedCard() {
  return (
    <Card className="p-8 text-center space-y-4">
      <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-amber-600" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-primary">Billing not available on your plan</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
          Self-serve billing is available on the Professional and Custom plans.
          Reach out to your Zensbot contact to upgrade.
        </p>
      </div>
    </Card>
  );
}

// ── Tabbed content ───────────────────────────────────────────────

function BillingContent({
  data,
  onRefresh,
}: {
  data: BillingOverview;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      {data.billingRestriction && (
        <RestrictionBanner restriction={data.billingRestriction} />
      )}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="addons">Storage Add-ons</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab data={data} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>

        <TabsContent value="addons">
          <AddonsTab data={data} onRefresh={onRefresh} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RestrictionBanner({ restriction }: { restriction: 'add_blocked' | 'read_only' }) {
  const messages: Record<string, string> = {
    add_blocked:
      'Your account is partially restricted: adding students and uploading files is paused because an invoice is 15+ days overdue. Other work continues as normal.',
    read_only:
      'Your account is in read-only mode because an invoice is 30+ days overdue. Please clear the outstanding balance to restore writes.',
  };
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-red-900">
        <p className="font-semibold">Account restricted — action required</p>
        <p className="mt-1">{messages[restriction]}</p>
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────

function OverviewTab({ data }: { data: BillingOverview }) {
  const tierLabel = data.planTier === 'professional' ? 'Professional' : 'Custom';
  const preview = data.nextInvoicePreview;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Sparkles size={20} />}
          label="Current Plan"
          value={tierLabel}
          sub={`Billed ${data.billingCycle} · ${data.currency}`}
        />
        <StatCard
          icon={<Users size={20} />}
          label="Students"
          value={`${preview.snapshotStudentCount}`}
          sub={
            preview.overageStudentCount > 0
              ? `${data.freeUsersIncluded} free · ${preview.overageStudentCount} billable`
              : `${data.freeUsersIncluded} free included`
          }
        />
        <StatCard
          icon={<Database size={20} />}
          label="Documents"
          value={formatBytesGB(data.currentStorageBytes)}
          sub={`of ${data.storageLimitGb} GB`}
        />
        <StatCard
          icon={<Video size={20} />}
          label="Videos"
          value={formatBytesGB(data.currentVideoBytes)}
          sub={`of ${data.videoLimitGb} GB`}
        />
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-primary">Next invoice estimate</h3>
            <p className="text-sm text-gray-500">
              Preview of what you&apos;ll be charged at the end of the current cycle
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase">Total</div>
            <div className="text-2xl font-bold text-primary">
              {formatMoney(preview.totalPkr, data.currency)}
            </div>
          </div>
        </div>

        {preview.lineItems.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-md px-3 py-2">
            <CheckCircle2 className="w-4 h-4" />
            Nothing billable this cycle — you&apos;re within the free allowance.
          </div>
        ) : (
          <LineItemsTable items={preview.lineItems} currency={data.currency} />
        )}
      </Card>

      {data.activeAddons.length > 0 && (
        <Card className="p-6 space-y-3">
          <h3 className="text-base font-semibold text-primary">Active add-ons</h3>
          <div className="space-y-2">
            {data.activeAddons.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{addonLabel(a.addonType)}</span>
                  {a.quantity > 1 && <span className="text-gray-500"> × {a.quantity}</span>}
                  {a.cancelledEffectiveAt && (
                    <span className="ml-2 text-xs text-amber-700">
                      (cancels on {formatDate(a.cancelledEffectiveAt)})
                    </span>
                  )}
                </div>
                <div className="text-gray-500">
                  {formatMoney(a.monthlyTotalPkr, data.currency)}/mo
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl font-bold text-primary">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </Card>
  );
}

function LineItemsTable({
  items,
  currency,
}: {
  items: Array<{ label: string; qty: number; unitPkr: number; amount: number }>;
  currency: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500 border-b">
            <th className="py-2 font-medium">Line item</th>
            <th className="py-2 font-medium">Qty</th>
            <th className="py-2 font-medium">Unit</th>
            <th className="py-2 font-medium text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx} className="border-b last:border-0">
              <td className="py-2">{it.label}</td>
              <td className="py-2">{it.qty}</td>
              <td className="py-2">{formatMoney(it.unitPkr, currency)}</td>
              <td className="py-2 text-right font-medium">
                {formatMoney(it.amount, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Invoices Tab ─────────────────────────────────────────────────

function InvoicesTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const perPage = 20;

  const { data, loading, error, refetch } = useApi(
    () => listInvoices({ page, per_page: perPage, status: statusFilter || undefined }),
    [page, statusFilter],
  );

  if (loading) return <PageLoading variant="table" />;
  if (error) return <PageError message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-primary">Invoice history</h3>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {data.data.length === 0 ? (
        <EmptyRow
          icon={<FileText size={28} className="text-gray-400" />}
          text="No invoices yet. Your first invoice will appear after the next billing cycle."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b">
                  <th className="py-2 font-medium">Invoice #</th>
                  <th className="py-2 font-medium">Period</th>
                  <th className="py-2 font-medium">Due</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">PDF</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={data.totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          />
        </>
      )}
    </Card>
  );
}

function InvoiceRow({ inv }: { inv: InvoiceItem }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadInvoicePDF(inv.id, `invoice-${inv.invoiceNumber}.pdf`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 font-mono text-xs">{inv.invoiceNumber}</td>
      <td className="py-2">
        {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}
      </td>
      <td className="py-2">{formatDate(inv.dueDate)}</td>
      <td className="py-2 font-medium">{formatMoney(inv.totalAmount, 'PKR')}</td>
      <td className="py-2">
        <InvoiceStatusBadge status={inv.status} />
      </td>
      <td className="py-2 text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </Button>
      </td>
    </tr>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
    sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700' },
    paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-700' },
    overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
  };
  const entry = map[status] || { label: status, className: 'bg-gray-100' };
  return <Badge className={entry.className}>{entry.label}</Badge>;
}

// ── Add-ons Tab ──────────────────────────────────────────────────

function AddonsTab({
  data,
  onRefresh,
}: {
  data: BillingOverview;
  onRefresh: () => void;
}) {
  const { data: addons, loading, error, refetch } = useApi<Addon[]>(
    () => listAddons(),
    [],
  );

  const activate = useMutation(activateAddon);
  const cancel = useMutation(cancelAddon);

  const [pendingPack, setPendingPack] = useState<{ pack: AddonPack; qty: number } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Addon | null>(null);

  async function handleActivate() {
    if (!pendingPack) return;
    try {
      await activate.execute(pendingPack.pack.addonType, pendingPack.qty);
      toast.success(`${addonLabel(pendingPack.pack.addonType)} activated`);
      setPendingPack(null);
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate');
    }
  }

  async function handleCancel() {
    if (!pendingCancel) return;
    try {
      await cancel.execute(pendingCancel.id);
      toast.success('Add-on scheduled for cancellation');
      setPendingCancel(null);
      refetch();
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel');
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-primary">Available packs</h3>
        <p className="text-sm text-gray-500">
          Storage add-ons stack on top of your base plan. Activations take effect
          immediately; cancellations apply at the end of the current billing
          cycle.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.availableAddonPacks.map((p) => (
            <AddonPackCard
              key={p.addonType}
              pack={p}
              currency={data.currency}
              onActivate={(qty) => setPendingPack({ pack: p, qty })}
            />
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-base font-semibold text-primary">Your add-ons</h3>
        {loading && <PageLoading variant="table" />}
        {error && <PageError message={error} onRetry={refetch} />}
        {!loading && !error && addons && (
          addons.length === 0 ? (
            <EmptyRow
              icon={<Database size={28} className="text-gray-400" />}
              text="No add-ons yet. Activate a pack above to extend your storage."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b">
                    <th className="py-2 font-medium">Pack</th>
                    <th className="py-2 font-medium">Qty</th>
                    <th className="py-2 font-medium">Monthly</th>
                    <th className="py-2 font-medium">Activated</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {addons.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2">{addonLabel(a.addonType)}</td>
                      <td className="py-2">× {a.quantity}</td>
                      <td className="py-2">
                        {formatMoney(a.monthlyTotalPkr, data.currency)}
                      </td>
                      <td className="py-2">{formatDate(a.activatedAt)}</td>
                      <td className="py-2">
                        {a.cancelledEffectiveAt ? (
                          <Badge className="bg-amber-100 text-amber-700">
                            Ends {formatDate(a.cancelledEffectiveAt)}
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {!a.cancelledAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingCancel(a)}
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>

      <AlertDialog open={!!pendingPack} onOpenChange={(o) => !o && setPendingPack(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate add-on?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPack && (
                <>
                  <strong>{addonLabel(pendingPack.pack.addonType)}</strong> × {pendingPack.qty}
                  {' '}will be added to your plan immediately and{' '}
                  <strong>
                    {formatMoney(
                      pendingPack.pack.pricePkr * pendingPack.qty,
                      data.currency,
                    )}
                  </strong>
                  {' '}will be included in your next monthly invoice.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate} disabled={activate.loading}>
              {activate.loading ? 'Activating…' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingCancel} onOpenChange={(o) => !o && setPendingCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this add-on?</AlertDialogTitle>
            <AlertDialogDescription>
              The pack will remain active until the end of the current calendar
              month — you&apos;ll keep the storage until then, and billing stops
              on the next invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancel.loading}>
              {cancel.loading ? 'Cancelling…' : 'Cancel add-on'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddonPackCard({
  pack,
  currency,
  onActivate,
}: {
  pack: AddonPack;
  currency: string;
  onActivate: (qty: number) => void;
}) {
  const [qty, setQty] = useState(1);

  return (
    <Card className="p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold text-primary">
          {addonLabel(pack.addonType)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {pack.bonusGb} GB {pack.kind}
        </div>
      </div>
      <div className="text-lg font-bold text-primary">
        {formatMoney(pack.pricePkr, currency)}
        <span className="text-xs font-normal text-gray-500">/mo</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={100}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 h-8 text-sm"
        />
        <Button size="sm" onClick={() => onActivate(qty)} className="flex-1">
          Activate
        </Button>
      </div>
    </Card>
  );
}

// ── Payments Tab ─────────────────────────────────────────────────

function PaymentsTab() {
  const [page, setPage] = useState(1);
  const perPage = 20;
  const { data, loading, error, refetch } = useApi(
    () => listPayments({ page, per_page: perPage }),
    [page],
  );

  if (loading) return <PageLoading variant="table" />;
  if (error) return <PageError message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-base font-semibold text-primary">Payment history</h3>
      {data.data.length === 0 ? (
        <EmptyRow
          icon={<Wallet size={28} className="text-gray-400" />}
          text="No payments recorded yet."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Method</th>
                  <th className="py-2 font-medium">Reference</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p: PaymentItem) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{formatDateTime(p.paymentDate)}</td>
                    <td className="py-2 font-medium">{formatMoney(p.amount, 'PKR')}</td>
                    <td className="py-2 capitalize">{p.paymentMethod.replace('_', ' ')}</td>
                    <td className="py-2 text-gray-500 font-mono text-xs">
                      {p.referenceNumber || '—'}
                    </td>
                    <td className="py-2">
                      <Badge className="bg-emerald-100 text-emerald-700 capitalize">
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={data.totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          />
        </>
      )}
    </Card>
  );
}

// ── Shared pieces ────────────────────────────────────────────────

function EmptyRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      {icon}
      <p className="text-sm text-gray-500 max-w-sm">{text}</p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t">
      <span className="text-xs text-gray-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
