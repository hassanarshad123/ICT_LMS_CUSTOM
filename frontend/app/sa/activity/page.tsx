'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { getSAActivityLog, getImpersonationHistory, type ActivityLogItem } from '@/lib/api/super-admin';

type TabType = 'all' | 'impersonation';

export default function SAActivityPage() {
  const [tab, setTab] = useState<TabType>('all');
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const params: Record<string, any> = { page, per_page: 25 };
  if (actionFilter) params.action = actionFilter;
  if (entityFilter) params.entity_type = entityFilter;

  const { data: allData } = useApi(
    () => tab === 'all' ? getSAActivityLog(params) : getImpersonationHistory({ page, per_page: 25 }),
    [tab, page, actionFilter, entityFilter],
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Activity Log</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Audit trail across all institutes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 rounded-lg p-0.5 w-fit">
        {(['all', 'impersonation'] as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
              tab === t ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {t === 'all' ? 'All Activity' : 'Impersonation History'}
          </button>
        ))}
      </div>

      {/* Filters (only for all tab) */}
      {tab === 'all' && (
        <div className="flex gap-2 flex-wrap">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5"
          >
            <option value="">All Actions</option>
            <option value="user_created">User Created</option>
            <option value="user_updated">User Updated</option>
            <option value="course_created">Course Created</option>
            <option value="batch_created">Batch Created</option>
            <option value="sa_impersonation_start">Impersonation</option>
            <option value="sa_bulk_suspend">Bulk Suspend</option>
            <option value="sa_bulk_activate">Bulk Activate</option>
            <option value="sa_password_reset">Password Reset</option>
            <option value="sa_user_deactivated">User Deactivated</option>
          </select>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5"
          >
            <option value="">All Types</option>
            <option value="user">User</option>
            <option value="institute">Institute</option>
            <option value="course">Course</option>
            <option value="batch">Batch</option>
            <option value="lecture">Lecture</option>
          </select>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <th className="px-5 py-3 font-medium text-zinc-500">Action</th>
                <th className="px-5 py-3 font-medium text-zinc-500">User</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Type</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Institute</th>
                <th className="px-5 py-3 font-medium text-zinc-500">IP</th>
                <th className="px-5 py-3 font-medium text-zinc-500">Time</th>
              </tr>
            </thead>
            <tbody>
              {(allData?.data || []).map((item: ActivityLogItem) => (
                <tr key={item.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-mono">
                      {item.action}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-zinc-900">{item.userName || '-'}</div>
                    <div className="text-xs text-zinc-500">{item.userEmail || ''}</div>
                  </td>
                  <td className="px-5 py-3 text-zinc-600 capitalize">{item.entityType}</td>
                  <td className="px-5 py-3 text-zinc-600">{item.instituteName || '-'}</td>
                  <td className="px-5 py-3 text-xs text-zinc-500 font-mono">{item.ipAddress || '-'}</td>
                  <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
              {(!allData?.data || allData.data.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-zinc-400">No activity found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {allData && allData.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-100">
            <span className="text-xs text-zinc-500">Page {allData.page} of {allData.totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= allData.totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
