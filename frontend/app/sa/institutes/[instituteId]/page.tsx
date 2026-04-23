'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Edit2, Check, X, LogIn } from 'lucide-react';
import {
  getInstitute, updateInstitute, suspendInstitute, activateInstitute, archiveInstitute,
  getInstituteUsers, getInstituteCourses, getInstituteBatches,
  impersonateUser, getUsageTrends, getInstituteCertificates,
  InstituteOut, PlanTier, PLAN_TIER_LABELS,
  type UsageTrend,
} from '@/lib/api/super-admin';
import { useApi } from '@/hooks/use-api';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function UsageBar({ label, current, max, unit = '' }: { label: string; current: number; max: number | null; unit?: string }) {
  // max=null signals the Unlimited plan — render a neutral bar and "Unlimited" label.
  if (max === null) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">{label}</span>
          <span className="text-sm font-medium">{current}{unit} / Unlimited</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="h-2 rounded-full bg-gray-300 transition-all" style={{ width: '100%' }} />
        </div>
      </div>
    );
  }
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium">{current}{unit} / {max}{unit}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-red-100 text-red-700',
    trial: 'bg-yellow-100 text-yellow-700',
  };
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>{status}</span>;
}

type TabType = 'overview' | 'users' | 'courses' | 'batches' | 'certificates' | 'resources';

export default function InstituteDetailPage() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const [institute, setInstitute] = useState<InstituteOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('overview');
  const [tabData, setTabData] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InstituteOut>>({});

  const fetchInstitute = useCallback(async () => {
    try {
      const data = await getInstitute(instituteId);
      setInstitute(data);
      setEditForm({
        name: data.name,
        slug: data.slug,
        contactEmail: data.contactEmail,
        planTier: data.planTier,
        maxUsers: data.maxUsers,
        maxStudents: data.maxStudents,
        maxStorageGb: data.maxStorageGb,
        maxVideoGb: data.maxVideoGb,
        expiresAt: data.expiresAt ? data.expiresAt.split('T')[0] : '',
        billingRestriction: data.billingRestriction || '',
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to load institute');
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => { fetchInstitute(); }, [fetchInstitute]);

  const fetchTabData = useCallback(async () => {
    if (tab === 'overview' || tab === 'resources') return;
    setTabLoading(true);
    try {
      let res;
      if (tab === 'users') res = await getInstituteUsers(instituteId);
      else if (tab === 'courses') res = await getInstituteCourses(instituteId);
      else if (tab === 'certificates') res = await getInstituteCertificates(instituteId);
      else res = await getInstituteBatches(instituteId);
      setTabData(res.data || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load data');
    } finally {
      setTabLoading(false);
    }
  }, [tab, instituteId]);

  useEffect(() => { fetchTabData(); }, [fetchTabData]);

  const [showUnlimitedDialog, setShowUnlimitedDialog] = useState(false);
  const [unlimitedReason, setUnlimitedReason] = useState('');

  // Does the pending edit cross the Unlimited boundary (assign or revoke)?
  const tierChangeCrossesUnlimited = (): boolean => {
    if (!institute) return false;
    const nextTier = editForm.planTier as PlanTier | undefined;
    if (!nextTier || nextTier === institute.planTier) return false;
    return nextTier === 'unlimited' || institute.planTier === 'unlimited';
  };

  const commitSave = async (tierChangeReason?: string) => {
    try {
      const payload = tierChangeReason
        ? { ...editForm, tierChangeReason }
        : editForm;
      const updated = await updateInstitute(instituteId, payload);
      setInstitute(updated);
      setEditing(false);
      setShowUnlimitedDialog(false);
      setUnlimitedReason('');
      toast.success('Institute updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    }
  };

  const handleSave = async () => {
    if (tierChangeCrossesUnlimited()) {
      setShowUnlimitedDialog(true);
      return;
    }
    await commitSave();
  };

  const router = useRouter();
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const handleSuspend = async () => {
    if (!institute) return;
    try {
      await suspendInstitute(instituteId);
      toast.success('Suspended');
      setShowSuspendDialog(false);
      fetchInstitute();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleArchive = async () => {
    if (!institute) return;
    try {
      await archiveInstitute(instituteId);
      toast.success(`${institute.name} archived`);
      setShowArchiveDialog(false);
      router.push('/sa/institutes');
    } catch (e: any) {
      toast.error(e.message || 'Archive failed');
    }
  };

  const handleActivate = async () => {
    if (!institute) return;
    try {
      await activateInstitute(instituteId);
      toast.success('Activated');
      fetchInstitute();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  if (!institute) {
    return <div className="p-6 text-red-600">Institute not found</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sa/institutes" className="p-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{institute.name}</h1>
              <StatusBadge status={institute.status} />
            </div>
            <p className="text-sm text-gray-500">{institute.slug}.zensbot.online</p>
          </div>
        </div>
        <div className="flex gap-2">
          {institute.status !== 'active' && (
            <button onClick={handleActivate} className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-xl hover:bg-green-100">Activate</button>
          )}
          {institute.status !== 'suspended' && (
            <button onClick={() => setShowSuspendDialog(true)} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-xl hover:bg-red-100">Suspend</button>
          )}
          <button onClick={() => setShowArchiveDialog(true)} className="px-3 py-1.5 text-sm bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100">Archive</button>
          <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Suspend Institute?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will suspend &quot;{institute.name}&quot;. All active sessions will be terminated and users will lose access until reactivated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSuspend} className="bg-red-600 hover:bg-red-700">Suspend</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive Institute?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will archive &quot;{institute.name}&quot;. All users will be logged out and lose access. Data is preserved and can be permanently deleted from the Archived page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive} className="bg-amber-600 hover:bg-amber-700">Archive</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showUnlimitedDialog} onOpenChange={setShowUnlimitedDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {editForm.planTier === 'unlimited' ? 'Assign Unlimited Plan?' : 'Revoke Unlimited Plan?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {editForm.planTier === 'unlimited'
                    ? `This will comp ${institute.name} to the Unlimited plan — no quotas, no billing, no invoices. Action is logged to the Activity Log.`
                    : `This will revoke ${institute.name}'s Unlimited plan and enforce the quotas from the new tier. Action is logged to the Activity Log.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-1">
                <label className="text-sm text-gray-600 block mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={unlimitedReason}
                  onChange={(e) => setUnlimitedReason(e.target.value)}
                  placeholder="e.g. Founding partner comp — approved by Hassan 2026-04-20"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none h-20"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setUnlimitedReason('')}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => unlimitedReason.trim() && commitSave(unlimitedReason.trim())}
                  disabled={!unlimitedReason.trim()}
                  className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['overview', 'users', 'courses', 'batches', 'certificates', 'resources'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-all ${
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Usage */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-semibold text-gray-900">Usage</h2>
            <UsageBar label="Students" current={institute.currentStudents} max={institute.maxStudents} />
            <UsageBar label="Total Users (inc. staff)" current={institute.currentUsers} max={institute.maxUsers} />
            <UsageBar label="Storage" current={parseFloat(institute.currentStorageGb.toFixed(2))} max={institute.maxStorageGb} unit=" GB" />
            <UsageBar label="Video" current={parseFloat(institute.currentVideoGb.toFixed(2))} max={institute.maxVideoGb} unit=" GB" />
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Details</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-gray-100"><Edit2 size={16} /></button>
              ) : (
                <div className="flex gap-1">
                  <button onClick={handleSave} className="p-1.5 rounded-lg hover:bg-green-100 text-green-600"><Check size={16} /></button>
                  <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600"><X size={16} /></button>
                </div>
              )}
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Name', key: 'name', type: 'text' },
                { label: 'Slug', key: 'slug', type: 'text' },
                { label: 'Status', key: 'status', type: 'readonly' },
                { label: 'Contact Email', key: 'contactEmail', type: 'email' },
                { label: 'Plan', key: 'planTier', type: 'select', options: ['professional', 'custom', 'unlimited', 'free', 'starter', 'basic', 'pro', 'enterprise'] },
                { label: 'Max Students', key: 'maxStudents', type: 'number' },
                { label: 'Max Users (staff+students)', key: 'maxUsers', type: 'number' },
                { label: 'Max Storage (GB)', key: 'maxStorageGb', type: 'number' },
                { label: 'Max Video (GB)', key: 'maxVideoGb', type: 'number' },
                { label: 'Expires', key: 'expiresAt', type: 'date' },
                { label: 'Billing Restriction', key: 'billingRestriction', type: 'select', options: ['', 'add_blocked', 'read_only'] },
              ].map(({ label, key, type, options }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-500">{label}</span>
                  {editing && type !== 'readonly' ? (
                    type === 'select' ? (
                      <select
                        value={(editForm as any)[key] ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value || null }))}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-sm w-36"
                      >
                        {options!.map((o) => (
                          <option key={o} value={o}>
                            {key === 'billingRestriction' ? (o || 'None') : (PLAN_TIER_LABELS[o as PlanTier] ?? o)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={type}
                        value={(editForm as any)[key] ?? ''}
                        onChange={(e) => setEditForm((f) => ({
                          ...f,
                          [key]: type === 'number' ? parseFloat(e.target.value)
                            : type === 'date' ? (e.target.value || null)
                            : e.target.value,
                        }))}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-sm w-36 text-right"
                      />
                    )
                  ) : (
                    key === 'status' ? (
                      <StatusBadge status={(institute as any)[key]} />
                    ) : key === 'planTier' ? (
                      <span className="font-medium text-gray-900">
                        {PLAN_TIER_LABELS[institute.planTier] ?? institute.planTier}
                      </span>
                    ) : key === 'expiresAt' ? (
                      <span className="font-medium text-gray-900">
                        {institute.expiresAt ? new Date(institute.expiresAt).toLocaleDateString() : <span className="text-gray-400">No expiry</span>}
                      </span>
                    ) : key === 'billingRestriction' ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        institute.billingRestriction === 'read_only' ? 'bg-red-100 text-red-700'
                          : institute.billingRestriction === 'add_blocked' ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {institute.billingRestriction || 'None'}
                      </span>
                    ) : (
                      <span className="font-medium text-gray-900">
                        {(institute as any)[key] ?? <span className="text-gray-400">Unlimited</span>}
                      </span>
                    )
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Created</span>
                <span className="font-medium text-gray-900">
                  {institute.createdAt ? new Date(institute.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'resources' && (
        <InstituteResourcesTab instituteId={instituteId} />
      )}

      {tab !== 'overview' && tab !== 'resources' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          {tabLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6" /></div>
          ) : tabData.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No {tab} found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    {tab === 'users' && (
                      <>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Name</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Email</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Role</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Actions</th>
                      </>
                    )}
                    {tab === 'courses' && (
                      <>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Title</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Created</th>
                      </>
                    )}
                    {tab === 'batches' && (
                      <>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Name</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Start Date</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">End Date</th>
                      </>
                    )}
                    {tab === 'certificates' && (
                      <>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Recipient</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Course</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Issued</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tabData.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      {tab === 'users' && (
                        <>
                          <td className="py-2 px-3 font-medium text-gray-900">{item.name}</td>
                          <td className="py-2 px-3 text-gray-500">{item.email}</td>
                          <td className="py-2 px-3"><span className="capitalize">{(item.role || '').replace('_', ' ')}</span></td>
                          <td className="py-2 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={async () => {
                                try {
                                  const res = await impersonateUser(item.id);
                                  const host = `${res.instituteSlug}.zensbot.online`;
                                  // Phase 4 handover: pass the single-use id,
                                  // not the JWT. See /auth/impersonation-handover.
                                  const url = `https://${host}/impersonate-callback?hid=${encodeURIComponent(res.handoverId)}`;
                                  window.open(url, '_blank');
                                  toast.success(`Impersonating ${res.targetUserName}`);
                                } catch (e: any) {
                                  toast.error(e.message || 'Failed to impersonate');
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                              title="Impersonate this user"
                            >
                              <LogIn size={12} />
                              Impersonate
                            </button>
                          </td>
                        </>
                      )}
                      {tab === 'courses' && (
                        <>
                          <td className="py-2 px-3 font-medium text-gray-900">{item.title}</td>
                          <td className="py-2 px-3 capitalize">{item.status}</td>
                          <td className="py-2 px-3 text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}</td>
                        </>
                      )}
                      {tab === 'batches' && (
                        <>
                          <td className="py-2 px-3 font-medium text-gray-900">{item.name}</td>
                          <td className="py-2 px-3 text-gray-500">{item.startDate}</td>
                          <td className="py-2 px-3 text-gray-500">{item.endDate}</td>
                        </>
                      )}
                      {tab === 'certificates' && (
                        <>
                          <td className="py-2 px-3 font-medium text-gray-900">{item.recipientName || item.studentName || '-'}</td>
                          <td className="py-2 px-3 text-gray-500">{item.courseName || item.courseTitle || '-'}</td>
                          <td className="py-2 px-3 text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InstituteResourcesTab({ instituteId }: { instituteId: string }) {
  const [days, setDays] = useState(30);
  const { data: trends, loading: trendsLoading } = useApi<UsageTrend>(
    () => getUsageTrends(instituteId, days), [instituteId, days],
  );

  if (trendsLoading) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6" /></div>
      </div>
    );
  }

  const points = trends?.dataPoints ?? [];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Usage Trends</h2>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {points.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          Snapshots will appear after the daily job runs
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Users</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Students</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Storage (GB)</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Video (GB)</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Courses</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Lectures</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-2 px-3 text-gray-700">{p.date}</td>
                  <td className="py-2 px-3 text-right">{p.users}</td>
                  <td className="py-2 px-3 text-right">{p.students}</td>
                  <td className="py-2 px-3 text-right">{p.storageGb}</td>
                  <td className="py-2 px-3 text-right">{p.videoGb}</td>
                  <td className="py-2 px-3 text-right">{p.courses}</td>
                  <td className="py-2 px-3 text-right">{p.lectures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
