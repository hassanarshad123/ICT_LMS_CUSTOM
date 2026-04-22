'use client';

import { useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import { useApi, useMutation } from '@/hooks/use-api';
import { listArchivedInstitutes, purgeInstitute } from '@/lib/api/super-admin';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ArchivedInstitutesPage() {
  const [page, setPage] = useState(1);
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const { data, refetch } = useApi(
    () => listArchivedInstitutes({ page, per_page: 20 }),
    [page],
  );

  const { execute: doPurge, loading: purging } = useMutation(
    (id: string) => purgeInstitute(id),
  );

  const handlePurge = async () => {
    if (!purgeTarget || confirmName !== purgeTarget.name) return;
    try {
      const report = await doPurge(purgeTarget.id);
      toast.success(`${purgeTarget.name} permanently deleted. ${report.users} users, ${report.courses} courses removed.`);
      setPurgeTarget(null);
      setConfirmName('');
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Purge failed');
    }
  };

  const institutes = data?.data || [];
  const totalPages = data?.totalPages || 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Archived Institutes</h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          {data?.total ?? 0} archived institute(s). Purge permanently deletes all data.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {institutes.length === 0 ? (
          <div className="text-center py-12">
            <Archive size={40} className="mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500">No archived institutes</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-5 py-3 font-medium text-zinc-500">Institute</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Plan</th>
                    <th className="px-5 py-3 font-medium text-zinc-500">Archived</th>
                    <th className="px-5 py-3 font-medium text-zinc-500 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {institutes.map((inst) => (
                    <tr key={inst.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-5 py-3">
                        <div className="text-zinc-900 font-medium">{inst.name}</div>
                        <div className="text-xs text-zinc-500">{inst.slug}.zensbot.online</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 capitalize">
                          {inst.planTier}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 whitespace-nowrap">
                        {inst.updatedAt ? new Date(inst.updatedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setPurgeTarget({ id: inst.id, name: inst.name })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 size={12} />
                          Purge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-100">
                <span className="text-xs text-zinc-500">Page {data?.page} of {totalPages}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Prev</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Double-Confirmation Purge Dialog */}
      <AlertDialog open={!!purgeTarget} onOpenChange={(open) => { if (!open) { setPurgeTarget(null); setConfirmName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Permanently Delete Institute?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will permanently delete <strong>{purgeTarget?.name}</strong> and ALL associated data:
                users, courses, batches, lectures, certificates, invoices, payments, and sessions.
              </p>
              <p className="font-medium text-red-600">This action cannot be undone.</p>
              <p>Type the institute name to confirm:</p>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={purgeTarget?.name}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurge}
              disabled={confirmName !== purgeTarget?.name || purging}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
            >
              {purging ? 'Purging...' : 'Permanently Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
