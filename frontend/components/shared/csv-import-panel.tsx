'use client';

import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { bulkImportUsers } from '@/lib/api/users';
import { useMutation } from '@/hooks/use-api';
import { downloadCsvTemplate } from './csv-template';

interface CsvRow {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  specialization?: string;
  [key: string]: string | undefined;
}

interface ImportResult {
  imported: number;
  skipped: number;
  enrolled: number;
  errors: { row: number; error: string }[];
}

interface BatchOption {
  id: string;
  name: string;
}

interface CsvImportPanelProps {
  onSuccess?: () => void;
  onClose?: () => void;
  batches?: BatchOption[];
  preSelectedBatchIds?: string[];
}

export default function CsvImportPanel({ onSuccess, onClose, batches = [], preSelectedBatchIds = [] }: CsvImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>(preSelectedBatchIds);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { execute: doImport, loading: importing } = useMutation(
    (f: File) => bulkImportUsers(f, selectedBatchIds.length > 0 ? selectedBatchIds : undefined)
  );

  const parseFile = useCallback((f: File) => {
    // Client-side file size limit (2MB)
    if (f.size > 2 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 2MB.');
      return;
    }
    setFile(f);
    setResult(null);
    Papa.parse<CsvRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        if (rows.length > 500) {
          toast.warning(`CSV has ${rows.length} rows. Only the first 500 will be imported.`);
        }
        setAllRows(rows.slice(0, 500));
        setPreview(rows.slice(0, 10));
      },
      error: () => {
        toast.error('Failed to parse CSV file');
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith('.csv')) {
      parseFile(f);
    } else {
      toast.error('Please drop a .csv file');
    }
  }, [parseFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) parseFile(f);
  }, [parseFile]);

  const handleUpload = async () => {
    if (!file) return;
    try {
      const res = await doImport(file);
      setResult(res);
      if (res.imported > 0) {
        toast.success(`${res.imported} students imported successfully`);
        onSuccess?.();
      }
      if (res.skipped > 0) {
        toast.info(`${res.skipped} duplicates skipped`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    }
  };

  const validRows = allRows.filter((r) => r.name?.trim() && r.email?.trim());
  const invalidRows = allRows.filter((r) => !r.name?.trim() || !r.email?.trim());

  const reset = () => {
    setFile(null);
    setPreview([]);
    setAllRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">Import Students (CSV)</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCsvTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            Download Template
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Batch selection */}
      {batches.length > 0 && !result && (
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Auto-enroll in batches (optional)</label>
          <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2">
            {batches.map(batch => (
              <label key={batch.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedBatchIds.includes(batch.id)}
                  onChange={() => setSelectedBatchIds(prev => prev.includes(batch.id) ? prev.filter(b => b !== batch.id) : [...prev, batch.id])}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700">{batch.name}</span>
              </label>
            ))}
          </div>
          {selectedBatchIds.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">{selectedBatchIds.length} batch{selectedBatchIds.length > 1 ? 'es' : ''} selected — imported students will be enrolled</p>
          )}
        </div>
      )}

      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Upload size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            Drop your CSV file here, or click to browse
          </p>
          <p className="text-xs text-gray-500">
            CSV with columns: name, email, phone, role, specialization (max 500 rows)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Preview */}
      {file && !result && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{file.name}</span>
              <span className="text-xs text-gray-500">({allRows.length} rows)</span>
            </div>
            <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-700">
              Change file
            </button>
          </div>

          {/* Validation summary */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 size={14} className="text-green-500" />
              <span className="text-green-700">{validRows.length} valid</span>
            </div>
            {invalidRows.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <AlertCircle size={14} className="text-red-500" />
                <span className="text-red-700">{invalidRows.length} missing name/email</span>
              </div>
            )}
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto mb-4 border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">#</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Email</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Phone</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => {
                  const isInvalid = !row.name?.trim() || !row.email?.trim();
                  return (
                    <tr key={i} className={isInvalid ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className={`px-3 py-2 ${!row.name?.trim() ? 'text-red-500 italic' : 'text-gray-700'}`}>
                        {row.name || 'Missing'}
                      </td>
                      <td className={`px-3 py-2 ${!row.email?.trim() ? 'text-red-500 italic' : 'text-gray-700'}`}>
                        {row.email || 'Missing'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{row.phone || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {allRows.length > 10 && (
              <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
                Showing first 10 of {allRows.length} rows
              </div>
            )}
          </div>

          {/* Upload button */}
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={importing || validRows.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
            >
              {importing && <Loader2 size={16} className="animate-spin" />}
              Import {validRows.length} Students
            </button>
            <button
              onClick={reset}
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          <div className="flex flex-col gap-2 mb-4">
            {result.imported > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg">
                <CheckCircle2 size={16} />
                <span>
                  {result.imported} students imported successfully
                  {result.enrolled > 0 && ` · ${result.enrolled} batch enrollment${result.enrolled > 1 ? 's' : ''} created`}
                </span>
              </div>
            )}
            {result.skipped > 0 && (
              <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 px-4 py-2 rounded-lg">
                <AlertCircle size={16} />
                {result.skipped} duplicates skipped
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="text-sm text-red-700 bg-red-50 px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle size={16} />
                  {result.errors.length} errors
                </div>
                <ul className="ml-6 text-xs space-y-0.5">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>Row {err.row}: {err.error}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-gray-500">...and {result.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <button
            onClick={reset}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
