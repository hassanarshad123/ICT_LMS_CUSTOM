'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Building2 } from 'lucide-react';
import { listInstitutes, suspendInstitute, activateInstitute, InstituteOut } from '@/lib/api/super-admin';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-red-100 text-red-700',
    trial: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    basic: 'bg-blue-100 text-blue-700',
    pro: 'bg-purple-100 text-purple-700',
    enterprise: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${colors[plan] ?? 'bg-gray-100 text-gray-700'}`}>
      {plan}
    </span>
  );
}

function UsageBar({ current, max, label }: { current: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="min-w-0">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">{current}/{max}</span>
      </div>
    </div>
  );
}

export default function InstitutesPage() {
  const [institutes, setInstitutes] = useState<InstituteOut[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInstitutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listInstitutes({
        page,
        per_page: 20,
        status: statusFilter || undefined,
        plan_tier: planFilter || undefined,
      });
      setInstitutes(res.data || []);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load institutes');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, planFilter]);

  useEffect(() => { fetchInstitutes(); }, [fetchInstitutes]);

  const handleSuspend = async (id: string, name: string) => {
    try {
      await suspendInstitute(id);
      toast.success(`${name} suspended`);
      setSuspendTarget(null);
      fetchInstitutes();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleActivate = async (id: string, name: string) => {
    try {
      await activateInstitute(id);
      toast.success(`${name} activated`);
      fetchInstitutes();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filteredInstitutes = searchQuery
    ? institutes.filter((inst) =>
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : institutes;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Institutes</h1>
          <p className="text-sm text-gray-500 mt-1">{total} institutes total</p>
        </div>
        <Link
          href="/sa/institutes/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#2A2A2A] transition-colors"
        >
          <Plus size={16} />
          New Institute
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or slug..."
          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#C5D86D]/50 focus:border-[#C5D86D]"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="trial">Trial</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm"
        >
          <option value="">All Plans</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : institutes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No institutes found</p>
          <Link href="/sa/institutes/new" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Create your first institute
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {/* Mobile card view */}
          <div className="md:hidden space-y-3 p-4">
            {filteredInstitutes.map((inst) => (
              <div key={inst.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/sa/institutes/${inst.id}`} className="hover:underline">
                    <span className="text-sm font-medium text-gray-900">{inst.name}</span>
                  </Link>
                  <StatusBadge status={inst.status} />
                </div>
                <div className="text-xs text-gray-500 mb-3 space-y-1">
                  <p>{inst.slug}.zensbot.online</p>
                  <div className="flex items-center gap-2">
                    <PlanBadge plan={inst.planTier} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <UsageBar current={inst.currentUsers} max={inst.maxUsers} label="Users" />
                  <UsageBar
                    current={parseFloat(inst.currentStorageGb.toFixed(1))}
                    max={inst.maxStorageGb}
                    label={`${inst.currentStorageGb.toFixed(1)}/${inst.maxStorageGb} GB`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/sa/institutes/${inst.id}`}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    View
                  </Link>
                  {inst.status !== 'suspended' ? (
                    <button
                      onClick={() => setSuspendTarget({ id: inst.id, name: inst.name })}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivate(inst.id, inst.name)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Institute</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Storage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredInstitutes.map((inst) => (
                  <tr key={inst.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/sa/institutes/${inst.id}`} className="hover:underline">
                        <div className="font-medium text-gray-900">{inst.name}</div>
                        <div className="text-xs text-gray-500">{inst.slug}.zensbot.online</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inst.status} /></td>
                    <td className="px-4 py-3"><PlanBadge plan={inst.planTier} /></td>
                    <td className="px-4 py-3 w-36">
                      <UsageBar current={inst.currentUsers} max={inst.maxUsers} label="Users" />
                    </td>
                    <td className="px-4 py-3 w-36">
                      <UsageBar
                        current={parseFloat(inst.currentStorageGb.toFixed(1))}
                        max={inst.maxStorageGb}
                        label={`${inst.currentStorageGb.toFixed(1)}/${inst.maxStorageGb} GB`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/sa/institutes/${inst.id}`}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          View
                        </Link>
                        {inst.status !== 'suspended' ? (
                          <button
                            onClick={() => setSuspendTarget({ id: inst.id, name: inst.name })}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(inst.id, inst.name)}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                <span className="hidden sm:inline">Page {page} of {totalPages}</span>
                <span className="sm:hidden">{page}/{totalPages}</span>
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Suspend Confirmation Dialog */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Institute?</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend &quot;{suspendTarget?.name}&quot;. All active user sessions will be terminated and users will not be able to log in until the institute is reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendTarget && handleSuspend(suspendTarget.id, suspendTarget.name)}
              className="bg-red-600 hover:bg-red-700"
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
