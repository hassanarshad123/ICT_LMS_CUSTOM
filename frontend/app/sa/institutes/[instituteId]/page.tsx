'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Edit2, Check, X, LogIn } from 'lucide-react';
import {
  getInstitute, updateInstitute, suspendInstitute, activateInstitute,
  getInstituteUsers, getInstituteCourses, getInstituteBatches,
  impersonateUser, InstituteOut,
} from '@/lib/api/super-admin';
import { toast } from 'sonner';

function UsageBar({ label, current, max, unit = '' }: { label: string; current: number; max: number; unit?: string }) {
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

type TabType = 'overview' | 'users' | 'courses' | 'batches';

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
        maxStorageGb: data.maxStorageGb,
        maxVideoGb: data.maxVideoGb,
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to load institute');
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => { fetchInstitute(); }, [fetchInstitute]);

  const fetchTabData = useCallback(async () => {
    if (tab === 'overview') return;
    setTabLoading(true);
    try {
      let res;
      if (tab === 'users') res = await getInstituteUsers(instituteId);
      else if (tab === 'courses') res = await getInstituteCourses(instituteId);
      else res = await getInstituteBatches(instituteId);
      setTabData(res.data || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load data');
    } finally {
      setTabLoading(false);
    }
  }, [tab, instituteId]);

  useEffect(() => { fetchTabData(); }, [fetchTabData]);

  const handleSave = async () => {
    try {
      const updated = await updateInstitute(instituteId, editForm);
      setInstitute(updated);
      setEditing(false);
      toast.success('Institute updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    }
  };

  const handleSuspend = async () => {
    if (!institute) return;
    if (!confirm(`Suspend "${institute.name}"?`)) return;
    try {
      await suspendInstitute(instituteId);
      toast.success('Suspended');
      fetchInstitute();
    } catch (e: any) {
      toast.error(e.message);
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
            <button onClick={handleSuspend} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-xl hover:bg-red-100">Suspend</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['overview', 'users', 'courses', 'batches'] as TabType[]).map((t) => (
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
            <UsageBar label="Users" current={institute.currentUsers} max={institute.maxUsers} />
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
                { label: 'Plan', key: 'planTier', type: 'select', options: ['free', 'basic', 'pro', 'enterprise'] },
                { label: 'Max Users', key: 'maxUsers', type: 'number' },
                { label: 'Max Storage (GB)', key: 'maxStorageGb', type: 'number' },
                { label: 'Max Video (GB)', key: 'maxVideoGb', type: 'number' },
              ].map(({ label, key, type, options }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-500">{label}</span>
                  {editing && type !== 'readonly' ? (
                    type === 'select' ? (
                      <select
                        value={(editForm as any)[key] ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-sm w-32"
                      >
                        {options!.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={type}
                        value={(editForm as any)[key] ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
                        className="px-2 py-1 border border-gray-200 rounded-lg text-sm w-32 text-right"
                      />
                    )
                  ) : (
                    key === 'status' ? (
                      <StatusBadge status={(institute as any)[key]} />
                    ) : (
                      <span className="font-medium text-gray-900">{(institute as any)[key]}</span>
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

      {tab !== 'overview' && (
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
                                  const url = `https://${host}/impersonate-callback?token=${res.token}`;
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
