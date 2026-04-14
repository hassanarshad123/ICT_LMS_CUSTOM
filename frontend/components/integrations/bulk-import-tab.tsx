'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { useApi, useMutation } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Download, FileText, Loader2, CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';
import {
  uploadBulkImport, listBulkImportJobs, bulkImportTemplateUrl,
  type BulkImportEntity, type BulkImportResult, type BulkImportJobStatus,
} from '@/lib/api/integrations';

const ENTITIES: Array<{ value: BulkImportEntity; label: string; description: string }> = [
  {
    value: 'students',
    label: 'Students',
    description: 'Name, email, phone (+ optional batch to enroll).',
  },
  {
    value: 'fee_plans',
    label: 'Fee plans',
    description: 'Total amount + plan type per existing student/batch.',
  },
  {
    value: 'payments',
    label: 'Payments',
    description: 'Past payments — creates receipt + allocates to installment.',
  },
];

export default function BulkImportTab() {
  const [entity, setEntity] = useState<BulkImportEntity>('students');
  const [fileName, setFileName] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BulkImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: jobs, loading: jobsLoading, refetch: refetchJobs,
  } = useApi(() => listBulkImportJobs(1, 10), []);

  const uploadMut = useMutation(
    useCallback((e: BulkImportEntity, file: File) => uploadBulkImport(e, file), []),
  );

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
  }

  async function onUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error('Pick a CSV file first');
      return;
    }
    try {
      const result = await uploadMut.execute(entity, file);
      setLastResult(result);
      if (result.failedRows === 0) {
        toast.success(`Imported ${result.successRows} rows`);
      } else {
        toast.warning(`${result.successRows} imported, ${result.failedRows} failed — see details below`);
      }
      refetchJobs();
      if (inputRef.current) inputRef.current.value = '';
      setFileName(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Upload failed');
    }
  }

  return (
    <div className="space-y-5">
      {/* Intro card */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Upload size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-primary">Bulk CSV import</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Load existing institute data in one upload — students, fee plans, or historical payments.
              Each row is validated independently; errors don&apos;t abort the job.
              Max 5,000 rows per upload. Expect one webhook event per row if Frappe sync is enabled.
            </p>
          </div>
        </div>
      </div>

      {/* Entity selector + template links */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <h3 className="font-semibold text-primary text-sm mb-3">1. Choose what to import</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ENTITIES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setEntity(opt.value); setLastResult(null); }}
              className={`text-left border rounded-xl p-4 transition ${
                entity === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-primary text-sm">{opt.label}</div>
              <div className="text-xs text-gray-500 mt-1">{opt.description}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
          <a
            href={bulkImportTemplateUrl(entity)}
            download
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Download size={12} /> Download CSV template for &ldquo;{entity}&rdquo;
          </a>
        </div>
      </div>

      {/* Upload form */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
        <h3 className="font-semibold text-primary text-sm mb-3">2. Upload your CSV</h3>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-600 hover:border-primary hover:bg-primary/5 cursor-pointer flex-1">
            <FileText size={16} className="text-gray-400" />
            <span className="truncate">{fileName || 'Select a .csv file (max 10 MB)'}</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFilePick}
              className="hidden"
            />
          </label>
          <button
            onClick={onUpload}
            disabled={uploadMut.loading || !fileName}
            className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {uploadMut.loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Start import
          </button>
        </div>
      </div>

      {/* Result */}
      {lastResult && (
        <div className="bg-white rounded-2xl border border-gray-100 card-shadow p-5">
          <h3 className="font-semibold text-primary text-sm mb-3">Last import result</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Total" value={lastResult.totalRows} tone="neutral" />
            <Stat label="Succeeded" value={lastResult.successRows} tone={lastResult.failedRows === 0 ? 'good' : 'neutral'} icon={<CheckCircle size={14} className="text-green-600" />} />
            <Stat label="Failed" value={lastResult.failedRows} tone={lastResult.failedRows > 0 ? 'bad' : 'neutral'} icon={<XCircle size={14} className="text-red-600" />} />
            <Stat label="Status" value={lastResult.status} tone="neutral" />
          </div>

          {lastResult.errors && lastResult.errors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                <AlertTriangle size={12} className="text-amber-600" />
                First {Math.min(lastResult.errors.length, 500)} failed rows (fix and re-upload):
              </div>
              <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium w-24">Row #</th>
                      <th className="text-left px-3 py-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lastResult.errors.map((err, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono">{err.row}</td>
                        <td className="px-3 py-2 text-red-600">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-primary text-sm">Recent imports</h3>
        </div>
        {jobsLoading && <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>}
        {!jobsLoading && (!jobs || jobs.data.length === 0) && (
          <div className="p-6 text-center text-gray-500 text-sm">
            No imports yet. Your upload history will appear here.
          </div>
        )}
        {!jobsLoading && jobs && jobs.data.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">When</th>
                <th className="text-left px-4 py-3 font-medium">Entity</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Rows</th>
                <th className="text-right px-4 py-3 font-medium">Success</th>
                <th className="text-right px-4 py-3 font-medium">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.data.map((job) => (
                <tr key={job.jobId} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-medium">{job.entityType}</td>
                  <td className="px-4 py-3">
                    {job.status === 'completed' && job.failedRows === 0 && (
                      <Badge className="bg-green-50 text-green-700 border border-green-200">Completed</Badge>
                    )}
                    {job.status === 'completed' && job.failedRows > 0 && (
                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Partial</Badge>
                    )}
                    {job.status === 'failed' && (
                      <Badge className="bg-red-50 text-red-700 border border-red-200">Failed</Badge>
                    )}
                    {(job.status === 'running' || job.status === 'pending') && (
                      <Badge className="bg-blue-50 text-blue-700 border border-blue-200">{job.status}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-700">{job.totalRows}</td>
                  <td className="px-4 py-3 text-right text-xs text-green-700">{job.successRows}</td>
                  <td className="px-4 py-3 text-right text-xs text-red-700">{job.failedRows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  label, value, tone, icon,
}: {
  label: string;
  value: string | number;
  tone: 'good' | 'bad' | 'neutral';
  icon?: React.ReactNode;
}) {
  const color =
    tone === 'good' ? 'text-green-600'
      : tone === 'bad' ? 'text-red-600'
      : 'text-primary';
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon} {label}
      </div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
