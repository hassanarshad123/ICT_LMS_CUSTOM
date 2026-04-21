'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import RoleGuard from '@/components/shared/role-guard';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useApi, useMutation } from '@/hooks/use-api';
import { useBasePath } from '@/hooks/use-base-path';
import {
  deleteAdmissionsStudent,
  downloadReceipt,
  getAdmissionsStudent,
  listStudentPayments,
  reactivateAdmissionsStudent,
  refreshPaymentErpStatus,
  removeAdmissionsEnrollment,
  suspendAdmissionsStudent,
  updateAdmissionsStudent,
  type FeePlanDetail,
  type FeePaymentRow,
} from '@/lib/api/admissions';
import RecordPaymentDialog from '@/components/admissions/record-payment-dialog';
import { PageLoading, PageError } from '@/components/shared/page-states';
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
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils/format';
import { toast } from 'sonner';
import {
  Wallet,
  Calendar,
  AlertTriangle,
  Check,
  Plus,
  Receipt,
  Download,
  Pencil,
  Trash2,
  Pause,
  Play,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export default function AdmissionsStudentDetailPage() {
  const router = useRouter();
  const basePath = useBasePath();
  const { studentId } = useParams<{ studentId: string }>();
  const [activePlan, setActivePlan] = useState<FeePlanDetail | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeEnrollmentId, setRemoveEnrollmentId] = useState<string | null>(null);

  const { data: student, loading, error, refetch: refetchStudent } = useApi(
    () => getAdmissionsStudent(studentId),
    [studentId],
  );
  const { data: payments, refetch: refetchPayments } = useApi(
    () => listStudentPayments(studentId),
    [studentId],
  );

  const refreshAll = () => {
    refetchStudent();
    refetchPayments();
  };

  const { execute: doSuspend, loading: suspending } = useMutation(suspendAdmissionsStudent);
  const { execute: doReactivate, loading: reactivating } = useMutation(reactivateAdmissionsStudent);
  const { execute: doDelete, loading: deleting } = useMutation(deleteAdmissionsStudent);
  const { execute: doRemoveEnrollment } = useMutation(removeAdmissionsEnrollment);

  const handleToggleStatus = async () => {
    if (!student) return;
    try {
      if (student.status === 'active') {
        await doSuspend(studentId);
        toast.success('Student suspended');
      } else {
        await doReactivate(studentId);
        toast.success('Student reactivated');
      }
      refreshAll();
    } catch (err: any) {
      toast.error(err?.message || 'Action failed');
    }
  };

  const handleDelete = async () => {
    try {
      await doDelete(studentId);
      toast.success('Student deleted');
      router.push(`${basePath}`);
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
      setConfirmDelete(false);
    }
  };

  const handleRemoveEnrollment = async () => {
    if (!removeEnrollmentId) return;
    try {
      await doRemoveEnrollment(studentId, removeEnrollmentId);
      toast.success('Enrollment removed');
      setRemoveEnrollmentId(null);
      refreshAll();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove enrollment');
      setRemoveEnrollmentId(null);
    }
  };

  const isSuspended = student?.status !== 'active';

  return (
    <RoleGuard allowed={['admin', 'admissions-officer']}>
      <DashboardLayout>
        <DashboardHeader
          greeting={student?.name || 'Student'}
          subtitle={student?.email || 'Fee plans and payment history'}
        />

        {loading && <PageLoading variant="detail" />}
        {error && <PageError message={error} onRetry={refreshAll} />}

        {!loading && !error && student && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                  isSuspended ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isSuspended ? 'Suspended' : 'Active'}
              </span>
              <div className="flex-1" />
              <button
                onClick={() => setShowEdit(true)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={suspending || reactivating}
                className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl border text-sm font-medium disabled:opacity-50 ${
                  isSuspended
                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                }`}
              >
                {(suspending || reactivating) && <Loader2 size={14} className="animate-spin" />}
                {isSuspended ? <Play size={14} /> : <Pause size={14} />}
                {isSuspended ? 'Reactivate' : 'Suspend'}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>

            <div className="space-y-6">
              {student.plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  payments={(payments || []).filter((p) => p.feePlanId === plan.id)}
                  onRecord={() => setActivePlan(plan)}
                  onRemoveEnrollment={() => setRemoveEnrollmentId(plan.studentBatchId)}
                  onRefreshPayments={refetchPayments}
                />
              ))}
            </div>
          </>
        )}

        {activePlan && (
          <RecordPaymentDialog
            open={!!activePlan}
            onClose={() => setActivePlan(null)}
            studentId={studentId}
            plan={activePlan}
            onSuccess={refreshAll}
          />
        )}

        {showEdit && student && (
          <EditStudentDialog
            student={student}
            onClose={() => setShowEdit(false)}
            onSaved={() => {
              setShowEdit(false);
              refreshAll();
            }}
          />
        )}

        <AlertDialog open={confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this student?</AlertDialogTitle>
              <AlertDialogDescription>
                This soft-deletes the account, cancels active fee plans, and revokes all sessions.
                Existing payment records and receipts are preserved. Cannot be undone through the UI.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting && <Loader2 size={14} className="animate-spin mr-2" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={!!removeEnrollmentId}
          onOpenChange={(open) => !open && setRemoveEnrollmentId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this batch enrollment?</AlertDialogTitle>
              <AlertDialogDescription>
                The student will lose access to this batch. The associated fee plan is cancelled but
                payment history stays for audit.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveEnrollment}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    </RoleGuard>
  );
}

function EditStudentDialog({
  student,
  onClose,
  onSaved,
}: {
  student: { name: string; email: string; phone?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { studentId } = useParams<{ studentId: string }>();
  const [name, setName] = useState(student.name || '');
  const [email, setEmail] = useState(student.email || '');
  const [phone, setPhone] = useState(student.phone || '');
  const { execute, loading } = useMutation(updateAdmissionsStudent);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await execute(studentId, { name, email, phone });
      toast.success('Student updated');
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || 'Update failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-primary">Edit student</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/80 disabled:opacity-40"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ErpStatusPill({ status }: { status: string | undefined | null }) {
  const cfg = ({
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
    confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
    unknown: { label: 'Unknown', className: 'bg-gray-100 text-gray-700' },
  } as Record<string, { label: string; className: string }>)[status || 'unknown'] || {
    label: status || '—',
    className: 'bg-gray-100 text-gray-700',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function RefreshErpButton({
  paymentId,
  onRefreshed,
}: {
  paymentId: string;
  onRefreshed: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const handler = async () => {
    setRefreshing(true);
    try {
      const r = await refreshPaymentErpStatus(paymentId);
      toast.success(`Status: ${r.erpStatus}`);
      onRefreshed();
    } catch (err: any) {
      toast.error(err?.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handler}
      disabled={refreshing}
      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
      title="Refresh ERP status"
    >
      <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
    </button>
  );
}

function PlanCard({
  plan,
  payments,
  onRecord,
  onRemoveEnrollment,
  onRefreshPayments,
}: {
  plan: FeePlanDetail;
  payments: FeePaymentRow[];
  onRecord: () => void;
  onRemoveEnrollment: () => void;
  onRefreshPayments: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 card-shadow">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h3 className="font-semibold text-primary">{plan.batchName}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {planLabel(plan.planType)} · Created {formatDate(plan.createdAt)}
            {plan.erpSiStatus && (
              <>
                {' · '}ERP: <span className="font-medium text-gray-700">{plan.erpSiStatus}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge plan={plan} />
          {plan.balanceDue > 0 && (
            <button
              onClick={onRecord}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/80"
            >
              <Plus size={14} /> Record Payment
            </button>
          )}
          <button
            onClick={onRemoveEnrollment}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50"
            title="Remove this batch enrollment"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <Metric label="Total" value={formatMoney(plan.finalAmount, plan.currency)} />
        <Metric label="Paid" value={formatMoney(plan.amountPaid, plan.currency)} accent="emerald" />
        <Metric label="Balance" value={formatMoney(plan.balanceDue, plan.currency)} accent="red" />
        <Metric label="Next due" value={formatDate(plan.nextDueDate)} />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Installment schedule</p>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500">
            <tr>
              <th className="text-left py-2">#</th>
              <th className="text-left py-2">Label</th>
              <th className="text-right py-2">Amount</th>
              <th className="text-right py-2">Paid</th>
              <th className="text-left py-2 pl-4">Due</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {plan.installments.map((i) => (
              <tr key={i.id} className="border-t border-gray-100">
                <td className="py-2 font-medium text-gray-500">{i.sequence}</td>
                <td className="py-2 text-gray-700">{i.label || '—'}</td>
                <td className="py-2 text-right">{formatMoney(i.amountDue)}</td>
                <td className="py-2 text-right text-emerald-700">{formatMoney(i.amountPaid)}</td>
                <td className="py-2 pl-4 text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={11} className="text-gray-400" />
                    {formatDate(i.dueDate)}
                  </span>
                </td>
                <td className="py-2">
                  <InstallmentStatusBadge status={i.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payments.length > 0 && (
        <div className="border-t border-gray-100 pt-4 mt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Payment history</p>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="text-left py-2">Receipt</th>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Method</th>
                <th className="text-left py-2">Reference</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-left py-2 pl-4">ERP status</th>
                <th className="text-right py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="py-2 text-gray-700">
                    <span className="inline-flex items-center gap-1">
                      <Receipt size={12} className="text-gray-400" />
                      {p.receiptNumber || '—'}
                    </span>
                  </td>
                  <td className="py-2 text-gray-600">{formatDateTime(p.paymentDate)}</td>
                  <td className="py-2 text-gray-600 capitalize">{p.paymentMethod.replace('_', ' ')}</td>
                  <td className="py-2 text-gray-600">{p.referenceNumber || '—'}</td>
                  <td className="py-2 text-right font-medium text-emerald-700">
                    {formatMoney(p.amount, plan.currency)}
                  </td>
                  <td className="py-2 pl-4">
                    <div className="flex items-center gap-1.5">
                      <ErpStatusPill status={p.erpStatus} />
                      <RefreshErpButton paymentId={p.id} onRefreshed={onRefreshPayments} />
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={async () => {
                        try {
                          await downloadReceipt(p.id, `${p.receiptNumber || p.id}.pdf`);
                        } catch (err: any) {
                          toast.error(err?.message || 'Failed to download receipt');
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
                      title="Download receipt PDF"
                    >
                      <Download size={12} />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plan.notes && (
        <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
          <Wallet size={14} className="inline mr-2 text-gray-400" />
          {plan.notes}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ plan }: { plan: FeePlanDetail }) {
  if (plan.isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertTriangle size={12} /> Overdue
      </span>
    );
  }
  if (plan.balanceDue === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <Check size={12} /> Paid in full
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      On track
    </span>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'red';
}) {
  const color =
    accent === 'emerald' ? 'text-emerald-700' : accent === 'red' ? 'text-red-600' : 'text-primary';
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function InstallmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    partially_paid: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-red-100 text-red-700',
    waived: 'bg-indigo-100 text-indigo-700',
  };
  const label: Record<string, string> = {
    pending: 'Pending',
    partially_paid: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
    waived: 'Waived',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.pending}`}>
      {label[status] || status}
    </span>
  );
}

function planLabel(t: string): string {
  if (t === 'one_time') return 'One-time fee';
  if (t === 'monthly') return 'Monthly recurring';
  if (t === 'installment') return 'Installment plan';
  return t;
}
