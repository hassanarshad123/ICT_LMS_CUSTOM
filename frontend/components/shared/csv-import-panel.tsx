'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, X, AlertTriangle } from 'lucide-react';
import { bulkImportUsers, BulkImportResult } from '@/lib/api/users';
import { useMutation } from '@/hooks/use-api';
import { downloadCsvTemplate } from './csv-template';

interface CsvRow {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  specialization?: string;
  password?: string;
  [key: string]: string | undefined;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function isNonStudentRole(role?: string): boolean {
  const r = role?.trim().toLowerCase();
  return r === 'teacher' || r === 'course-creator' || r === 'course_creator' || r === 'admin';
}

function getRowValidation(row: CsvRow, duplicateEmailSet: ReadonlySet<string>) {
  const missingName = !row.name?.trim();
  const missingEmail = !row.email?.trim();
  const invalidEmail = !missingEmail && !EMAIL_REGEX.test(row.email!.trim());
  const isDuplicate = !missingEmail && duplicateEmailSet.has(row.email!.trim().toLowerCase());
  const missingPassword = isNonStudentRole(row.role) && !row.password?.trim();
  return { missingName, missingEmail, invalidEmail, isDuplicate, missingPassword };
}

function downloadCredentialsCsv(
  users: ReadonlyArray<{ name: string; email: string; temporaryPassword: string }>
) {
  const header = 'Name,Email,Temporary Password';
  const rows = users.map(
    (u) => `${u.name},${u.email},${u.temporaryPassword}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'imported_credentials.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function CsvImportPanel({ onSuccess, onClose, batches = [], preSelectedBatchIds = [] }: CsvImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>(preSelectedBatchIds);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { execute: doImport, loading: importing } = useMutation(
    (f: File) => bulkImportUsers(f, selectedBatchIds.length > 0 ? selectedBatchIds : undefined)
  );

  // Detect duplicate emails within the CSV
  const duplicateEmailSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) {
      const email = row.email?.trim().toLowerCase();
      if (email) {
        counts.set(email, (counts.get(email) ?? 0) + 1);
      }
    }
    const dupes = new Set<string>();
    counts.forEach((count, email) => {
      if (count > 1) dupes.add(email);
    });
    return dupes;
  }, [allRows]);

  // Validation counts
  const validationStats = useMemo(() => {
    let missingCount = 0;
    let invalidEmailCount = 0;
    let missingPasswordCount = 0;
    let validCount = 0;
    for (const row of allRows) {
      const v = getRowValidation(row, duplicateEmailSet);
      if (v.missingName || v.missingEmail) {
        missingCount++;
      } else if (v.invalidEmail) {
        invalidEmailCount++;
      } else if (v.missingPassword) {
        missingPasswordCount++;
      } else {
        validCount++;
      }
    }
    return { missingCount, invalidEmailCount, duplicateCount: duplicateEmailSet.size, missingPasswordCount, validCount };
  }, [allRows, duplicateEmailSet]);

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
        toast.success(`${res.imported} users imported successfully`);
        onSuccess?.();
      }
      if (res.skipped > 0) {
        toast.info(`${res.skipped} duplicates skipped`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    }
  };

  const reset = () => {
    setFile(null);
    setAllRows([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">Import Users (CSV)</h3>
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
            <p className="text-xs text-gray-400 mt-1">{selectedBatchIds.length} batch{selectedBatchIds.length > 1 ? 'es' : ''} selected — imported users will be enrolled</p>
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
            CSV with columns: name, email, phone, role, specialization, password (max 500 rows)
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
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 size={14} className="text-green-500" />
              <span className="text-green-700">{validationStats.validCount} valid</span>
            </div>
            {validationStats.missingCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <AlertCircle size={14} className="text-red-500" />
                <span className="text-red-700">{validationStats.missingCount} missing name/email</span>
              </div>
            )}
            {validationStats.invalidEmailCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <AlertCircle size={14} className="text-amber-500" />
                <span className="text-amber-700">{validationStats.invalidEmailCount} invalid emails</span>
              </div>
            )}
            {validationStats.missingPasswordCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <AlertCircle size={14} className="text-amber-500" />
                <span className="text-amber-700">{validationStats.missingPasswordCount} missing password (non-student)</span>
              </div>
            )}
            {validationStats.duplicateCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <AlertTriangle size={14} className="text-yellow-500" />
                <span className="text-yellow-700">{validationStats.duplicateCount} duplicate emails</span>
              </div>
            )}
          </div>

          {/* Preview table — all rows, scrollable */}
          <div className="overflow-x-auto mb-4 border border-gray-100 rounded-xl">
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">#</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Email</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Phone</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((row, i) => {
                    const v = getRowValidation(row, duplicateEmailSet);
                    const hasMissing = v.missingName || v.missingEmail;
                    const rowBg = hasMissing
                      ? 'bg-red-50'
                      : v.invalidEmail
                        ? 'bg-amber-50'
                        : v.isDuplicate
                          ? 'bg-yellow-50'
                          : v.missingPassword
                            ? 'bg-amber-50'
                            : 'hover:bg-gray-50';
                    const emailCellClass = v.missingEmail
                      ? 'text-red-500 italic'
                      : v.invalidEmail
                        ? 'text-amber-600 italic'
                        : v.isDuplicate
                          ? 'text-yellow-700'
                          : 'text-gray-700';
                    const isStudent = !isNonStudentRole(row.role);
                    return (
                      <tr key={i} className={rowBg}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className={`px-3 py-2 ${v.missingName ? 'text-red-500 italic' : 'text-gray-700'}`}>
                          {row.name || 'Missing'}
                        </td>
                        <td className={`px-3 py-2 ${emailCellClass}`}>
                          {row.email || 'Missing'}
                          {v.isDuplicate && <span className="ml-1 text-xs text-yellow-600">(dup)</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row.phone || '\u2014'}</td>
                        <td className={`px-3 py-2 ${v.missingPassword ? 'text-amber-600 italic' : 'text-gray-600'}`}>
                          {isStudent
                            ? <span className="text-gray-400 italic">(default)</span>
                            : row.password?.trim()
                              ? <span className="text-gray-700">{row.password}</span>
                              : <span className="text-amber-600 italic">Password required</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upload button */}
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={importing || validationStats.validCount === 0}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60"
            >
              {importing && <Loader2 size={16} className="animate-spin" />}
              Import {validationStats.validCount} Users
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
          {/* Truncation warning */}
          {result.truncated && (
            <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 px-4 py-3 rounded-lg mb-4">
              <AlertTriangle size={16} className="shrink-0" />
              <span>Your file had {result.totalRows} rows. Only the first 500 were processed.</span>
            </div>
          )}

          <div className="flex flex-col gap-2 mb-4">
            {result.imported > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg">
                <CheckCircle2 size={16} />
                <span>
                  {result.imported} users imported successfully
                  {result.enrolled > 0 && ` \u00B7 ${result.enrolled} batch enrollment${result.enrolled > 1 ? 's' : ''} created`}
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
                <div className="max-h-[200px] overflow-y-auto">
                  <ul className="ml-6 text-xs space-y-0.5">
                    {result.errors.map((err, i) => (
                      <li key={i}>Row {err.row}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Credentials display */}
          {result.createdUsers.length > 0 && (
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-blue-900">
                  Created User Credentials ({result.createdUsers.length})
                </h4>
                <button
                  onClick={() => downloadCredentialsCsv(result.createdUsers)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Download size={14} />
                  Download Credentials CSV
                </button>
              </div>
              <div className="overflow-x-auto border border-blue-100 rounded-lg bg-white">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-blue-50">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-blue-700">Name</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-blue-700">Email</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-blue-700">Temporary Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.createdUsers.map((user, i) => (
                        <tr key={i} className="hover:bg-blue-50/50">
                          <td className="px-3 py-2 text-gray-700">{user.name}</td>
                          <td className="px-3 py-2 text-gray-700">{user.email}</td>
                          <td className="px-3 py-2 font-mono text-gray-900">{user.temporaryPassword}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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
