'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/shared/page-states';
import CsvImportPanel from '@/components/shared/csv-import-panel';
import { AdjustAccessModal } from '@/components/shared/adjust-access-modal';
import { BulkAdjustAccessModal } from '@/components/shared/bulk-adjust-access-modal';
import { AccessEndsBadge } from '@/components/shared/access-ends-badge';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import {
  Users,
  UserPlus,
  Upload,
  Loader2,
  CalendarPlus,
  Search,
} from 'lucide-react';

export interface BatchStudentSectionProps {
  /** Currently selected student ID in the dropdown */
  selectedStudentId: string;
  onSelectedStudentIdChange: (id: string) => void;
  /** Filtered list of students not yet enrolled */
  availableStudents: { id: string; name: string; email: string }[];
  /** Whether the enroll mutation is in flight */
  enrolling: boolean;
  onEnrollStudent: () => void;
  /** Enrolled students for the table */
  students: any[] | null | undefined;
  studentsLoading: boolean;
  /** Called when user toggles the active state of a student enrollment */
  onToggleActive: (studentId: string, isActive: boolean) => void;
  /** Batch info for import */
  batchId?: string;
  batchName?: string;
  batchEndDate?: string;
  onImportComplete?: () => void;
  /** Pagination */
  studentsTotal?: number;
  studentsPage?: number;
  studentsTotalPages?: number;
  onSetStudentsPage?: (page: number) => void;
  studentSearch?: string;
  onStudentSearchChange?: (search: string) => void;
  /** Enroll-dropdown server-side search — parent owns the fetch */
  enrollSearch?: string;
  onEnrollSearchChange?: (search: string) => void;
  enrollSearchDebounced?: string;
  searchingEnrollStudents?: boolean;
}

export function BatchStudentSection({
  selectedStudentId,
  onSelectedStudentIdChange,
  availableStudents,
  enrolling,
  onEnrollStudent,
  students,
  studentsLoading,
  onToggleActive,
  batchId,
  batchName,
  batchEndDate,
  onImportComplete,
  studentsTotal,
  studentsPage,
  studentsTotalPages,
  onSetStudentsPage,
  studentSearch,
  onStudentSearchChange,
  enrollSearch,
  onEnrollSearchChange,
  enrollSearchDebounced,
  searchingEnrollStudents,
}: BatchStudentSectionProps) {
  const [showImport, setShowImport] = useState(false);
  const [extendingStudent, setExtendingStudent] = useState<{ id: string; name: string; effectiveEndDate?: string } | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showBulkAdjust, setShowBulkAdjust] = useState(false);

  const getAccessStatus = (student: any) => {
    const effectiveEnd = student.extendedEndDate || batchEndDate;
    if (!effectiveEnd) return { label: '—', color: 'text-gray-400' };
    const end = new Date(effectiveEnd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    if (daysLeft < 0) return { label: `Expired`, color: 'text-red-600' };
    if (daysLeft <= 7) return { label: `${daysLeft}d left`, color: 'text-yellow-600' };
    return { label: end.toLocaleDateString(), color: student.extendedEndDate ? 'text-blue-600' : 'text-gray-600' };
  };

  return (
    <>
      {/* Extension Modal */}
      {extendingStudent && batchId && batchEndDate && (
        <AdjustAccessModal
          batchId={batchId}
          batchEndDate={batchEndDate}
          studentId={extendingStudent.id}
          studentName={extendingStudent.name}
          currentEffectiveEndDate={extendingStudent.effectiveEndDate}
          onClose={() => setExtendingStudent(null)}
          onSuccess={() => onImportComplete?.()}
        />
      )}

      {showBulkAdjust && batchId && (
        <BulkAdjustAccessModal
          batchId={batchId}
          selectedStudents={
            (Array.isArray(students) ? students : [])
              .filter((s: any) => selectedStudents.has(s.studentId))
              .map((s: any) => ({
                id: s.studentId,
                name: s.name,
                currentEffectiveEnd: s.extendedEndDate || batchEndDate || null,
              }))
          }
          open={showBulkAdjust}
          onClose={() => setShowBulkAdjust(false)}
          onSuccess={() => { setSelectedStudents(new Set()); onImportComplete?.(); }}
        />
      )}

      {/* Bulk Import Panel */}
      {showImport && batchId && (
        <CsvImportPanel
          onSuccess={() => { onImportComplete?.(); }}
          onClose={() => setShowImport(false)}
          batches={batchId && batchName ? [{ id: batchId, name: batchName }] : []}
          preSelectedBatchIds={batchId ? [batchId] : []}
        />
      )}

      {/* Enroll Student */}
      <div className="bg-white rounded-2xl p-6 card-shadow mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary">Enroll Student</h3>
          {batchId && (
            <button
              onClick={() => setShowImport(!showImport)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload size={14} />
              Import CSV
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchableCombobox
            options={availableStudents.map((s) => ({ value: s.id, label: `${s.name} (${s.email})` }))}
            value={selectedStudentId}
            onChange={onSelectedStudentIdChange}
            placeholder="Type to search students..."
            searchPlaceholder="Search by name, email, or phone..."
            emptyMessage={
              (enrollSearchDebounced?.length ?? 0) < 2
                ? 'Type at least 2 characters to search'
                : 'No students match'
            }
            className="flex-1"
            onSearchChange={onEnrollSearchChange}
            loading={searchingEnrollStudents}
          />
          <button
            onClick={onEnrollStudent}
            disabled={!selectedStudentId || enrolling}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enrolling ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Enroll Student
          </button>
        </div>
      </div>

      {/* Enrolled Students Table */}
      <div className="bg-white rounded-2xl card-shadow overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-primary">Enrolled Students ({studentsTotal ?? (Array.isArray(students) ? students.length : 0)})</h3>
              {selectedStudents.size > 0 && (
                <button
                  onClick={() => setShowBulkAdjust(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <CalendarPlus size={13} />
                  Update Access ({selectedStudents.size})
                </button>
              )}
            </div>
            {onStudentSearchChange && (
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={studentSearch ?? ''}
                  onChange={(e) => onStudentSearchChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>
        </div>
        {studentsLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 size={16} className="animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Loading students...</span>
          </div>
        ) : !Array.isArray(students) || students.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Users size={28} className="text-gray-400" />}
              title="No students enrolled"
              description="Use the dropdown above to enroll students in this batch."
            />
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3 p-4">
              {students.map((student: any) => {
                const isActive = student.isActive ?? true;
                return (
                  <div key={student.id} className="bg-white rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-primary">{student.name?.charAt(0) || '?'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-primary truncate">{student.name}</p>
                          {!isActive && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">Inactive</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{student.email}</p>
                      </div>
                      <button
                        onClick={() => onToggleActive(student.studentId, !isActive)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                        title={isActive ? 'Deactivate enrollment' : 'Activate enrollment'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                      <span>
                        Access: {(() => { const s = getAccessStatus(student); return <span className={s.color}>{s.label}</span>; })()}
                      </span>
                      <button
                        onClick={() => setExtendingStudent({ id: student.studentId, name: student.name, effectiveEndDate: student.extendedEndDate || batchEndDate })}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-primary border border-primary/20 rounded-md hover:bg-primary/5"
                      >
                        <CalendarPlus size={10} />
                        Update Access
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-3 sm:px-4 py-3 sm:py-4 w-8">
                      <input
                        type="checkbox"
                        checked={Array.isArray(students) && selectedStudents.size === students.length && students.length > 0}
                        onChange={() => {
                          if (Array.isArray(students) && selectedStudents.size === students.length) {
                            setSelectedStudents(new Set());
                          } else if (Array.isArray(students)) {
                            setSelectedStudents(new Set(students.map((s: any) => s.studentId)));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Access ends</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-3 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student: any) => {
                    const isActive = student.isActive ?? true;
                    const isChecked = selectedStudents.has(student.studentId);
                    const effectiveEnd = student.effectiveEndDate ?? student.extendedEndDate ?? batchEndDate ?? null;
                    return (
                      <tr key={student.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isChecked ? 'bg-primary/5' : ''}`}>
                        <td className="px-3 sm:px-4 py-3 sm:py-4">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const next = new Set(selectedStudents);
                              if (next.has(student.studentId)) {
                                next.delete(student.studentId);
                              } else {
                                next.add(student.studentId);
                              }
                              setSelectedStudents(next);
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-primary">{student.name}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-600">{student.email}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">
                          <AccessEndsBadge effectiveEnd={effectiveEnd} />
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <button
                            onClick={() => onToggleActive(student.studentId, !isActive)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                            title={isActive ? 'Deactivate enrollment' : 'Activate enrollment'}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                          </button>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <button
                            onClick={() => setExtendingStudent({ id: student.studentId, name: student.name, effectiveEndDate: student.extendedEndDate || batchEndDate })}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
                            title="Update Access"
                          >
                            <CalendarPlus size={12} />
                            Update Access
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>

        )}

        {onSetStudentsPage && studentsPage && studentsTotalPages && studentsTotalPages > 1 && (Array.isArray(students) && students.length > 0) && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2 sm:mb-0">
              <span className="hidden sm:inline">Page {studentsPage} of {studentsTotalPages} ({studentsTotal} students)</span>
              <span className="sm:hidden">{studentsPage}/{studentsTotalPages}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => onSetStudentsPage(studentsPage - 1)} disabled={studentsPage === 1} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
              <button onClick={() => onSetStudentsPage(studentsPage + 1)} disabled={studentsPage === studentsTotalPages} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
